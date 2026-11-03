
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSearch } from "../src/search.js";

function createDeferred<T>() {
    let resolve: (value: T) => void = () => { };
    let reject: (reason?: unknown) => void = () => { };

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}

describe("createSearch", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("should reject negative debounce values", () => {
        const fetchFn = vi.fn(async () => "result");

        expect(() =>
            createSearch(fetchFn, { debounceMs: -1 })
        ).toThrow(RangeError);
    });

    it("should reject non-finite debounce values", () => {
        const fetchFn = vi.fn(async () => "result");

        expect(() =>
            createSearch(fetchFn, { debounceMs: Infinity })
        ).toThrow(RangeError);

        expect(() =>
            createSearch(fetchFn, { debounceMs: NaN })
        ).toThrow(RangeError);
    });

    it("should wait for debounce time before searching", async () => {
        vi.useFakeTimers();

        const fetchFn = vi.fn(async () => "search result");
        const search = createSearch(fetchFn, { debounceMs: 300 });

        const result = search.search("typescript");

        expect(fetchFn).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(299);

        expect(fetchFn).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);

        await expect(result).resolves.toBe("search result");
        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(fetchFn).toHaveBeenCalledWith(
            "typescript",
            expect.any(AbortSignal)
        );
    });

    it("should cancel previous search when a new search starts", async () => {
        vi.useFakeTimers();

        const fetchFn = vi.fn(async (query: string) => `${query} result`);

        const search = createSearch(fetchFn, { debounceMs: 100 });

        const firstSearch = search.search("old query");
        const secondSearch = search.search("new query");

        await expect(firstSearch).resolves.toBeUndefined();

        await vi.advanceTimersByTimeAsync(100);

        await expect(secondSearch).resolves.toBe("new query result");

        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(fetchFn).toHaveBeenCalledWith(
            "new query",
            expect.any(AbortSignal)
        );
    });

    it("should cancel pending search before fetch starts", async () => {
        vi.useFakeTimers();

        const fetchFn = vi.fn(async () => "result");
        const search = createSearch(fetchFn, { debounceMs: 200 });

        const result = search.search("typescript");

        search.cancel();

        await expect(result).resolves.toBeUndefined();

        await vi.advanceTimersByTimeAsync(200);

        expect(fetchFn).not.toHaveBeenCalled();
    });


    it("should abort an active request when cancelled", async () => {
        vi.useFakeTimers();

        const deferred = createDeferred<string>();
        const signals: AbortSignal[] = [];

        const fetchFn = vi.fn(
            (query: string, signal: AbortSignal) => {
                expect(query).toBe("typescript");
                signals.push(signal);
                return deferred.promise;
            }
        );

        const search = createSearch(fetchFn, { debounceMs: 100 });

        const result = search.search("typescript");

        await vi.advanceTimersByTimeAsync(100);

        expect(fetchFn).toHaveBeenCalledTimes(1);

        const signal = signals[0];

        expect(signal).toBeDefined();
        expect(signal?.aborted).toBe(false);

        search.cancel();

        await expect(result).resolves.toBeUndefined();

        expect(signal?.aborted).toBe(true);

        deferred.resolve("late result");

        await Promise.resolve();
    });


    it("should ignore outdated results from previous requests", async () => {
        vi.useFakeTimers();

        const oldRequest = createDeferred<string>();
        const newRequest = createDeferred<string>();

        const fetchFn = vi.fn()
            .mockImplementationOnce(() => oldRequest.promise)
            .mockImplementationOnce(() => newRequest.promise);

        const search = createSearch(fetchFn, { debounceMs: 100 });

        const firstSearch = search.search("old query");

        await vi.advanceTimersByTimeAsync(100);

        const secondSearch = search.search("new query");

        await expect(firstSearch).resolves.toBeUndefined();

        await vi.advanceTimersByTimeAsync(100);

        oldRequest.resolve("old result");
        newRequest.resolve("new result");

        await expect(secondSearch).resolves.toBe("new result");

        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it("should reject when fetch function fails", async () => {
        vi.useFakeTimers();

        const error = new Error("Search failed");

        const fetchFn = vi.fn(async () => {
            throw error;
        });

        const search = createSearch(fetchFn, { debounceMs: 100 });

        const result = search.search("typescript");

        const assertion = expect(result).rejects.toBe(error);

        await vi.advanceTimersByTimeAsync(100);

        await assertion;
    });

    it("should catch synchronous errors from fetch function", async () => {
        vi.useFakeTimers();

        const error = new Error("Synchronous failure");

        const fetchFn = vi.fn((): Promise<string> => {
            throw error;
        });

        const search = createSearch(fetchFn, { debounceMs: 100 });

        const result = search.search("typescript");

        const assertion = expect(result).rejects.toBe(error);

        await vi.advanceTimersByTimeAsync(100);

        await assertion;
    });

    it("should do nothing when cancel is called without pending search", () => {
        const fetchFn = vi.fn(async () => "result");
        const search = createSearch(fetchFn, { debounceMs: 100 });

        expect(() => search.cancel()).not.toThrow();
    });
});
