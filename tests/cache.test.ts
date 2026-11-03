
import { describe, it, expect, vi } from "vitest";
import { createCache } from "../src/cache.js";

function createDeferred<T>() {
    let resolve: (value: T) => void = () => { };
    let reject: (reason?: unknown) => void = () => { };

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}

describe("createCache", () => {
    it("should reject negative TTL values", () => {
        const fetchFn = vi.fn(async () => "data");

        expect(() =>
            createCache(fetchFn, { ttlMs: -1 })
        ).toThrow(RangeError);
    });

    it("should reject non-finite TTL values", () => {
        const fetchFn = vi.fn(async () => "data");

        expect(() =>
            createCache(fetchFn, { ttlMs: Infinity })
        ).toThrow(RangeError);

        expect(() =>
            createCache(fetchFn, { ttlMs: NaN })
        ).toThrow(RangeError);
    });

    it("should fetch data when cache is empty", async () => {
        const fetchFn = vi.fn(async () => "fresh data");
        const cache = createCache(fetchFn, { ttlMs: 1000 });

        await expect(cache.get("tasks")).resolves.toBe("fresh data");

        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(fetchFn).toHaveBeenCalledWith("tasks");
    });

    it("should return cached data without fetching again", async () => {
        const fetchFn = vi.fn(async () => "task data");
        const cache = createCache(fetchFn, { ttlMs: 1000 });

        await cache.get("tasks");

        await expect(cache.get("tasks")).resolves.toBe("task data");

        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it("should cache different keys separately", async () => {
        const fetchFn = vi.fn(async (key: string) => `${key} data`);
        const cache = createCache(fetchFn, { ttlMs: 1000 });

        await expect(cache.get("tasks")).resolves.toBe("tasks data");
        await expect(cache.get("users")).resolves.toBe("users data");

        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it("should deduplicate simultaneous requests for the same key", async () => {
        const deferred = createDeferred<string>();
        const fetchFn = vi.fn(() => deferred.promise);

        const cache = createCache(fetchFn, { ttlMs: 1000 });

        const firstRequest = cache.get("tasks");
        const secondRequest = cache.get("tasks");

        expect(fetchFn).toHaveBeenCalledTimes(0);

        await Promise.resolve();

        expect(fetchFn).toHaveBeenCalledTimes(1);

        deferred.resolve("shared data");

        await expect(firstRequest).resolves.toBe("shared data");
        await expect(secondRequest).resolves.toBe("shared data");

        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it("should return stale data while refreshing expired cache", async () => {
        let currentTime = 1000;

        const fetchFn = vi.fn()
            .mockResolvedValueOnce("old data")
            .mockResolvedValueOnce("new data");

        const cache = createCache(fetchFn, {
            ttlMs: 100,
            now: () => currentTime
        });

        await cache.get("tasks");

        currentTime = 1200;

        await expect(cache.get("tasks")).resolves.toBe("old data");

        expect(fetchFn).toHaveBeenCalledTimes(2);

        await expect(cache.get("tasks")).resolves.toBe("new data");

        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it("should keep stale data when background refresh fails", async () => {
        let currentTime = 1000;

        const fetchFn = vi.fn()
            .mockResolvedValueOnce("old data")
            .mockRejectedValueOnce(new Error("Network error"))
            .mockResolvedValueOnce("new data");

        const cache = createCache(fetchFn, {
            ttlMs: 100,
            now: () => currentTime
        });

        await cache.get("tasks");

        currentTime = 1200;


        await expect(cache.get("tasks")).resolves.toBe("old data");

        await new Promise((resolve) => setTimeout(resolve, 0));

        await expect(cache.get("tasks")).resolves.toBe("old data");

        expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    it("should invalidate a specific cache key", async () => {
        const fetchFn = vi.fn()
            .mockResolvedValueOnce("old data")
            .mockResolvedValueOnce("new data");

        const cache = createCache(fetchFn, { ttlMs: 1000 });

        await cache.get("tasks");
        cache.invalidate("tasks");

        await expect(cache.get("tasks")).resolves.toBe("new data");

        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it("should prevent an old request from overwriting invalidated data", async () => {
        const oldRequest = createDeferred<string>();

        const fetchFn = vi.fn()
            .mockImplementationOnce(() => oldRequest.promise)
            .mockResolvedValueOnce("new data");

        const cache = createCache(fetchFn, { ttlMs: 1000 });

        const firstRequest = cache.get("tasks");

        await Promise.resolve();

        cache.invalidate("tasks");

        await expect(cache.get("tasks")).resolves.toBe("new data");

        oldRequest.resolve("old data");

        await expect(firstRequest).resolves.toBe("old data");

        await expect(cache.get("tasks")).resolves.toBe("new data");

        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it("should clear all cached entries", async () => {
        const fetchFn = vi.fn(async (key: string) => `${key} data`);
        const cache = createCache(fetchFn, { ttlMs: 1000 });

        await cache.get("tasks");
        await cache.get("users");

        cache.clear();

        await cache.get("tasks");
        await cache.get("users");

        expect(fetchFn).toHaveBeenCalledTimes(4);
    });

    it("should prevent an old request from overwriting data after clear", async () => {
        const oldRequest = createDeferred<string>();

        const fetchFn = vi.fn()
            .mockImplementationOnce(() => oldRequest.promise)
            .mockResolvedValueOnce("new data");

        const cache = createCache(fetchFn, { ttlMs: 1000 });

        const firstRequest = cache.get("tasks");

        await Promise.resolve();

        cache.clear();

        await expect(cache.get("tasks")).resolves.toBe("new data");

        oldRequest.resolve("old data");

        await expect(firstRequest).resolves.toBe("old data");

        await expect(cache.get("tasks")).resolves.toBe("new data");

        expect(fetchFn).toHaveBeenCalledTimes(2);
    });
});
