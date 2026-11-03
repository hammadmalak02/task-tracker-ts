
export type CacheOptions = {
    readonly ttlMs: number;
    readonly now?: () => number;
};

type CacheEntry<T> = {
    readonly value: T;
    readonly expiresAt: number;
};

type InFlightRequest<T> = {
    readonly promise: Promise<T>;
    readonly version: number;
};

export type Cache<T> = {
    readonly get: (key: string) => Promise<T>;
    readonly invalidate: (key: string) => void;
    readonly clear: () => void;
};

export function createCache<T>(
    fetchFn: (key: string) => Promise<T>,
    options: CacheOptions
): Cache<T> {
    if (!Number.isFinite(options.ttlMs) || options.ttlMs < 0) {
        throw new RangeError("ttlMs must be a finite non-negative number");
    }

    const now = options.now ?? Date.now;

    const entries = new Map<string, CacheEntry<T>>();
    const inFlight = new Map<string, InFlightRequest<T>>();
    const versions = new Map<string, number>();

    function getVersion(key: string): number {
        return versions.get(key) ?? 0;
    }

    function updateVersion(key: string): number {
        const nextVersion = getVersion(key) + 1;
        versions.set(key, nextVersion);
        return nextVersion;
    }

    function fetchAndCache(key: string): Promise<T> {
        const existingRequest = inFlight.get(key);


        if (existingRequest?.version === getVersion(key)) {
            return existingRequest.promise;
        }

        const version = getVersion(key);

        const request = Promise.resolve()
            .then(() => fetchFn(key))
            .then((value) => {
                if (getVersion(key) === version) {
                    entries.set(key, {
                        value,
                        expiresAt: now() + options.ttlMs
                    });
                }

                return value;
            })
            .finally(() => {
                const currentRequest = inFlight.get(key);
                if (currentRequest?.promise === request) {
                    inFlight.delete(key);
                }
            });

        inFlight.set(key, { promise: request, version });

        return request;
    }

    function get(key: string): Promise<T> {
        const entry = entries.get(key);

        if (entry === undefined) {
            
            return fetchAndCache(key);
        }

        if (now() < entry.expiresAt) {

            return Promise.resolve(entry.value);
        }

        void fetchAndCache(key).catch(() => undefined);

        return Promise.resolve(entry.value);
    }

    function invalidate(key: string): void {
        entries.delete(key);
        updateVersion(key);
    }

    function clear(): void {
        entries.clear();

        for (const key of new Set([
            ...versions.keys(),
            ...inFlight.keys()
        ])) {
            updateVersion(key);
        }
    }

    return {
        get,
        invalidate,
        clear
    };
}
