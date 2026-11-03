
export class NetworkError extends Error {
  constructor(message = "Network request failed") {
    super(message);
    this.name = "NetworkError";
  }
}

export class RequestTimeoutError extends Error {
  constructor(message = "Request timed out", options?: ErrorOptions) {
    super(message, options);
    this.name = "RequestTimeoutError";
  }
}

export class ValidationError extends Error {
  constructor(message = "Response validation failed") {
    super(message);
    this.name = "ValidationError";
  }
}

export type RetryOptions = {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  readonly timeoutMs?: number;
  readonly random?: () => number;
};

function abortError(cause?: unknown): Error {
  return new Error(
    "Request aborted",
    cause === undefined ? undefined : { cause }
  );
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort(): void {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(abortError());
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function runAttempt<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parentSignal?: AbortSignal
): Promise<T> {
  if (parentSignal?.aborted) {
    throw abortError();
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  let rejectOnAbort: ((reason: Error) => void) | undefined;

  const abortPromise = new Promise<never>((_, reject) => {
    rejectOnAbort = reject;
  });

  const abortFromParent = (): void => {
    controller.abort();
    rejectOnAbort?.(abortError());
  };

  parentSignal?.addEventListener("abort", abortFromParent, {
    once: true
  });

  if (parentSignal?.aborted) {
    abortFromParent();
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new RequestTimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      timeoutPromise,
      abortPromise
    ]);
  } catch (error: unknown) {
    if (timedOut) {
      throw new RequestTimeoutError("Request timed out", { cause: error });
    }

    if (parentSignal?.aborted) {
      throw abortError(error);
    }

    throw error;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }

    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}

export async function withRetry<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions = {},
  parentSignal?: AbortSignal
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 200;
  const timeoutMs = options.timeoutMs ?? 2_000;
  const random = options.random ?? Math.random;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError("maxAttempts must be a positive integer");
  }

  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
    throw new RangeError("baseDelayMs must be a non-negative finite number");
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be a positive finite number");
  }

  if (parentSignal?.aborted) {
    throw abortError();
  }

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await runAttempt(operation, timeoutMs, parentSignal);
    } catch (error: unknown) {
      if (parentSignal?.aborted) {
        throw abortError(error);
      }

      const retryable =
        error instanceof NetworkError ||
        error instanceof RequestTimeoutError;

      if (!retryable || attempt === maxAttempts) {
        throw error;
      }

      const randomValue = random();

      if (
        !Number.isFinite(randomValue) ||
        randomValue < 0 ||
        randomValue >= 1
      ) {
        throw new RangeError("random must return a number from 0 to less than 1");
      }

      const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.floor(randomValue * baseDelayMs);

      await wait(exponentialDelay + jitter, parentSignal);
    }
  }
}
