
export type SearchOptions = {
    readonly debounceMs: number;
};

export type Search<T> = {
    readonly search: (query: string) => Promise<T | undefined>;
    readonly cancel: () => void;
};

type PendingSearch<T> = {
    readonly id: number;
    readonly resolve: (value: T | undefined) => void;
    readonly reject: (reason: unknown) => void;
    readonly controller: AbortController;
    timer: ReturnType<typeof setTimeout> | undefined;
};

export function createSearch<T>(
    fetchFn: (query: string, signal: AbortSignal) => Promise<T>,
    options: SearchOptions
): Search<T> {
    if (
        !Number.isFinite(options.debounceMs) ||
        options.debounceMs < 0
    ) {
        throw new RangeError(
            "debounceMs must be a finite non-negative number"
        );
    }

    let latestId = 0;
    let pending: PendingSearch<T> | undefined;

    function cancel(): void {
        if (pending === undefined) {
            return;
        }

        const previous = pending;
        pending = undefined;
        latestId++;

        if (previous.timer !== undefined) {
            clearTimeout(previous.timer);
        }

        previous.controller.abort();
        previous.resolve(undefined);
    }

    function search(query: string): Promise<T | undefined> {
        cancel();

        const id = ++latestId;
        const controller = new AbortController();

        return new Promise<T | undefined>((resolve, reject) => {
            const current: PendingSearch<T> = {
                id,
                resolve,
                reject,
                controller,
                timer: undefined
            };

            pending = current;

            current.timer = setTimeout(() => {
                current.timer = undefined;
                void Promise.resolve()
                    .then(() => {
                        if (
                            pending !== current ||
                            controller.signal.aborted
                        ) {
                            return undefined;
                        }

                        return fetchFn(query, controller.signal);
                    })
                    .then((result) => {
                        if (
                            pending !== current ||
                            current.id !== latestId ||
                            controller.signal.aborted
                        ) {
                            return;
                        }

                        pending = undefined;
                        resolve(result);
                    })
                    .catch((error: unknown) => {
                        if (
                            pending !== current ||
                            current.id !== latestId ||
                            controller.signal.aborted
                        ) {
                            return;
                        }

                        pending = undefined;
                        reject(error);
                    });
            }, options.debounceMs);
        });
    }

    return {
        search,
        cancel
    };
}
