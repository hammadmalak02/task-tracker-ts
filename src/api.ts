import type { Task, TaskId } from "./types.js";
import { NetworkError } from "./fetcher.js";

export type TaskApi = {
  readonly listTasks: (signal?: AbortSignal) => Promise<Task[]>;
};

export type ApiOptions = {
  readonly delayMs?: number;
  readonly random?: () => number;
  readonly shouldFail?: () => boolean;
  readonly tasks?: readonly Task[];
};

const sampleTasks: Task[] = [
  {
    id: "task-1" as TaskId,
    title: "Learn TypeScript",
    priority: "high",
    completedAt: null,
    createdAt: new Date("2026-10-20T09:00:00Z"),
    tags: ["learning", "typescript"]
  },
  {
    id: "task-2" as TaskId,
    title: "Write unit tests",
    priority: "medium",
    completedAt: null,
    createdAt: new Date("2026-10-21T09:00:00Z"),
    tags: ["testing"]
  }
];

function wait(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Request aborted"));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    function onAbort(): void {
      clearTimeout(timer);
      reject(new Error("Request aborted"));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function cloneTask(task: Task): Task {
  return {
    ...task,
    createdAt: new Date(task.createdAt),
    completedAt:
      task.completedAt === null ? null : new Date(task.completedAt),
    tags: [...task.tags]
  };
}

export function createTaskApi(options: ApiOptions = {}): TaskApi {
  const delayMs = options.delayMs ?? 300;
  const random = options.random ?? Math.random;
  const shouldFail = options.shouldFail ?? (() => false);
  const tasks = options.tasks ?? sampleTasks;

  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new RangeError("delayMs must be a non-negative finite number");
  }

  return {
    async listTasks(signal?: AbortSignal): Promise<Task[]> {
      const randomValue = random();

      if (
        !Number.isFinite(randomValue) ||
        randomValue < 0 ||
        randomValue > 1
      ) {
        throw new RangeError("random must return a number from 0 to 1");
      }

      const delay = Math.floor(randomValue * (delayMs + 1));

      await wait(delay, signal);

      if (shouldFail()) {
        throw new NetworkError();
      }

      return tasks.map(cloneTask);
    }
  };
}