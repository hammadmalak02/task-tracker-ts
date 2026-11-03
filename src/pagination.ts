
import type { AsyncState, Task } from "./types.js";

export type TaskPage = {
  readonly items: Task[];
  readonly nextCursor: string | null;
};

export type PageFetcher = (
  cursor: string | null,
  signal?: AbortSignal
) => Promise<TaskPage>;

export type PaginationResult = {
  readonly tasks: Task[];
  readonly nextCursor: string | null;
};

export type TaskPagination = {
  readonly getState: () => AsyncState<Task[]>;
  readonly getError: () => string | null;
  readonly isLoading: () => boolean;
  readonly hasMore: () => boolean;
  readonly loadMore: (signal?: AbortSignal) => Promise<void>;
};

function cloneTask(task: Task): Task {
  return {
    ...task,
    createdAt: new Date(task.createdAt),
    completedAt:
      task.completedAt === null ? null : new Date(task.completedAt),
    tags: [...task.tags]
  };
}

function abortError(): Error {
  return new Error("Request aborted");
}

export async function fetchTasksPage(
  cursor: string | null,
  fetcher: PageFetcher,
  signal?: AbortSignal
): Promise<TaskPage> {
  if (signal?.aborted) {
    throw abortError();
  }

  const page = await fetcher(cursor, signal);

  if (signal?.aborted) {
    throw abortError();
  }

  return {
    items: page.items.map(cloneTask),
    nextCursor: page.nextCursor
  };
}

export async function loadAllTasks(
  fetcher: PageFetcher,
  options: {
    readonly signal?: AbortSignal;
    readonly maxPages?: number;
  } = {}
): Promise<PaginationResult> {
  const maxPages = options.maxPages ?? 100;

  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new RangeError("maxPages must be a positive integer");
  }

  const tasksById = new Map<string, Task>();
  const visitedCursors = new Set<string>();
  let cursor: string | null = null;

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    if (options.signal?.aborted) {
      throw abortError();
    }

    const page = await fetchTasksPage(cursor, fetcher, options.signal);

    for (const task of page.items) {
      const existing = tasksById.get(task.id);

      if (
        existing === undefined ||
        task.createdAt.getTime() >= existing.createdAt.getTime()
      ) {
        tasksById.set(task.id, cloneTask(task));
      }
    }

    const nextCursor = page.nextCursor;

    if (nextCursor === null) {
      return {
        tasks: [...tasksById.values()],
        nextCursor: null
      };
    }

    if (visitedCursors.has(nextCursor)) {
      throw new Error("Pagination cursor repeated");
    }

    visitedCursors.add(nextCursor);
    cursor = nextCursor;
  }

  throw new Error("Maximum page limit reached");
}

export function createTaskPagination(
  fetcher: PageFetcher
): TaskPagination {
  let state: AsyncState<Task[]> = { status: "empty" };
  let cursor: string | null = null;
  let finished = false;
  let loading = false;
  let errorMessage: string | null = null;
  let pendingRequest: Promise<void> | undefined;

  const visitedCursors = new Set<string>();

  function getTasks(): Task[] {
    return state.status === "success" ? state.data : [];
  }

  function loadMore(signal?: AbortSignal): Promise<void> {
    if (pendingRequest) {
      return pendingRequest;
    }

    if (finished) {
      return Promise.resolve();
    }

    if (signal?.aborted) {
      return Promise.reject(abortError());
    }

    loading = true;
    errorMessage = null;

    if (getTasks().length === 0) {
      state = { status: "loading" };
    }

    const request = (async (): Promise<void> => {
      try {
        const page = await fetchTasksPage(cursor, fetcher, signal);

        if (signal?.aborted) {
          throw abortError();
        }

        const tasksById = new Map(
          getTasks().map((task) => [task.id, cloneTask(task)])
        );

        for (const task of page.items) {
          const existing = tasksById.get(task.id);

          if (
            existing === undefined ||
            task.createdAt.getTime() >= existing.createdAt.getTime()
          ) {
            tasksById.set(task.id, cloneTask(task));
          }
        }

        state =
          tasksById.size === 0
            ? { status: "empty" }
            : { status: "success", data: [...tasksById.values()] };

        if (page.nextCursor === null) {
          finished = true;
          cursor = null;
        } else {
          if (visitedCursors.has(page.nextCursor)) {
            throw new Error("Pagination cursor repeated");
          }

          visitedCursors.add(page.nextCursor);
          cursor = page.nextCursor;
        }
      } catch (error: unknown) {
        errorMessage =
          error instanceof Error ? error.message : "Failed to load tasks";
        if (getTasks().length === 0) {
          state = { status: "error", message: errorMessage };
        }

        throw error;
      } finally {
        loading = false;
        pendingRequest = undefined;
      }
    })();

    pendingRequest = request;
    return request;
  }

  return {
    getState: () => state,
    getError: () => errorMessage,
    isLoading: () => loading,
    hasMore: () => !finished,
    loadMore
  };
}
