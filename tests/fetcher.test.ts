import { describe, expect, it, vi } from "vitest";
import {
    NetworkError,
    RequestTimeoutError,
    ValidationError,
    withRetry,
} from "../src/fetcher.js";

describe("withRetry", () => {

    it("retries a network error and then succeeds", async () => {
        let attempts = 0;

        const result = await withRetry(
            async () => {
                attempts += 1;

                if (attempts < 3) throw new NetworkError();

                return "success";
            },
            {
                baseDelayMs: 0,
                random: () => 0
            }
        );

        expect(result).toBe("success");
        expect(attempts).toBe(3);
    });

    it("stops after the maximum number of attempts", async () => {
        let attempts = 0;

        await expect(
            withRetry(
                async () => {
                    attempts += 1;
                    throw new NetworkError();
                },
                {
                    maxAttempts: 3,
                    baseDelayMs: 0
                }
            )
        ).rejects.toThrow("Network request failed");

        expect(attempts).toBe(3);
    });

    it("does not retry validation errors", async () => {
        let attempts = 0;

        await expect(
            withRetry(async () => {
                attempts += 1;
                throw new ValidationError();
            })
        ).rejects.toThrow("Response validation failed");

        expect(attempts).toBe(1);
    });

    it("times out an operation that takes too long", async () => {
        await expect(
            withRetry(
                (signal) =>
                    new Promise<string>((_, reject) => {
                        const timer = setTimeout(
                            () => reject(new NetworkError()),
                            100
                        );

                        signal.addEventListener(
                            "abort",
                            () => {
                                clearTimeout(timer);
                                reject(new Error("Operation aborted"));
                            },
                            { once: true }
                        );
                    }),
                {
                    maxAttempts: 1,
                    timeoutMs: 10
                }
            )
        ).rejects.toBeInstanceOf(RequestTimeoutError);
    });

    it("does not start a request if already aborted", async () => {
        const controller = new AbortController();
        controller.abort();

        const operation = vi.fn(async () => "success");

        await expect(
            withRetry(operation, {}, controller.signal)
        ).rejects.toThrow("Request aborted");

        expect(operation).not.toHaveBeenCalled();
    });

    it("error classes have default and custom messages", () => {
        expect(new NetworkError().message).toBe("Network request failed");
        expect(new NetworkError("Offline").message).toBe("Offline");
        expect(new NetworkError().name).toBe("NetworkError");

        expect(new RequestTimeoutError().message).toBe("Request timed out");
        expect(new RequestTimeoutError("Slow").message).toBe("Slow");
        expect(new RequestTimeoutError().name).toBe("RequestTimeoutError");

        expect(new ValidationError().message).toBe(
            "Response validation failed"
        );
        expect(new ValidationError("Bad data").message).toBe("Bad data");
        expect(new ValidationError().name).toBe("ValidationError");
    });

    it.each([0, -1, 1.5, Number.NaN])(
        "rejects invalid maxAttempts (%s)",
        async (maxAttempts) => {
            await expect(
                withRetry(async () => "x", { maxAttempts })
            ).rejects.toThrow("maxAttempts must be a positive integer");
        }
    );

    it.each([
        {
            options: { baseDelayMs: -1 },
            message: "baseDelayMs must be a non-negative finite number"
        },
        {
            options: { timeoutMs: 0 },
            message: "timeoutMs must be a positive finite number"
        },
        {
            options: { timeoutMs: -5 },
            message: "timeoutMs must be a positive finite number"
        }
    ])("rejects invalid options ($message)", async ({ options, message }) => {
        await expect(
            withRetry(async () => "x", options)
        ).rejects.toThrow(message);
    });

    it("retries after a timeout and then succeeds", async () => {
        let attempts = 0;

        const result = await withRetry(
            (signal) => {
                attempts += 1;
                if (attempts === 1) {
                    return new Promise<string>((_, reject) => {
                        signal.addEventListener(
                            "abort",
                            () => reject(new Error("Operation aborted")),
                            { once: true }
                        );
                    });
                }

                return Promise.resolve("success");
            },
            {
                maxAttempts: 2,
                timeoutMs: 10,
                baseDelayMs: 0,
                random: () => 0
            }
        );

        expect(result).toBe("success");
        expect(attempts).toBe(2);
    });

    it("times out even when the operation ignores the abort signal", async () => {
        await expect(
            withRetry(() => new Promise<string>(() => { }), {
                maxAttempts: 1,
                timeoutMs: 10
            })
        ).rejects.toBeInstanceOf(RequestTimeoutError);
    });

    it("succeeds with a live signal that never aborts", async () => {
        const controller = new AbortController();

        const result = await withRetry(
            async () => "ok",
            {},
            controller.signal
        );

        expect(result).toBe("ok");
    });

    it("retries with a live signal and then succeeds", async () => {
        const controller = new AbortController();
        let attempts = 0;

        const result = await withRetry(
            async () => {
                attempts += 1;

                if (attempts === 1) throw new NetworkError();

                return "ok";
            },
            { baseDelayMs: 0, random: () => 0 },
            controller.signal
        );

        expect(result).toBe("ok");
        expect(attempts).toBe(2);
    });

    it("stops when the parent aborts during the operation", async () => {
        const controller = new AbortController();
        let attempts = 0;

        const promise = withRetry(
            (signal) => {
                attempts += 1;

                return new Promise<string>((_, reject) => {
                    signal.addEventListener(
                        "abort",
                        () => reject(new Error("Operation aborted")),
                        { once: true }
                    );
                });
            },
            { maxAttempts: 3, timeoutMs: 1_000 },
            controller.signal
        );

        controller.abort(); 

        await expect(promise).rejects.toThrow("Request aborted");
        expect(attempts).toBe(1);
    });

    it("stops when the parent aborts during the retry delay", async () => {
        const controller = new AbortController();
        let attempts = 0;

        const promise = withRetry(
            async () => {
                attempts += 1;
                throw new NetworkError();
            },
            { maxAttempts: 3, baseDelayMs: 1_000, random: () => 0 },
            controller.signal
        );

        setTimeout(() => controller.abort(), 20);

        await expect(promise).rejects.toThrow("Request aborted");
        expect(attempts).toBe(1);
    });
});