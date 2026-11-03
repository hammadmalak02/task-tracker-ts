import type { Priority, Task, TaskId } from "./types.js";

export type ParseTaskResult =
  | { readonly ok: true; readonly task: Task }
  | { readonly ok: false; readonly errors: string[] };

function isPriority(value: unknown): value is Priority {
  return value === "low" || value === "medium" || value === "high";
}

function parseDate(value: unknown): Date | null {
  let date: Date;

  if (value instanceof Date) {
    date = new Date(value.getTime());
  } else if (typeof value === "string" && value.trim() !== "") {
    date = new Date(value);
  } else {
    return null;
  }

  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseTask(raw: unknown): ParseTaskResult {
  const errors: string[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ["Task must be an object"] };
  }

  const record = raw as Record<string, unknown>;

  const id =
    typeof record.id === "string" && record.id.trim() !== ""
      ? record.id.trim()
      : null;

  if (id === null) {
    errors.push("id must be a non-empty string");
  }

  const title =
    typeof record.title === "string" ? record.title.trim() : "";

  if (title === "") {
    errors.push("title must not be empty");
  } else if (title.length > 120) {
    errors.push("title must not exceed 120 characters");
  }

  const priority = record.priority;

  if (!isPriority(priority)) {
    errors.push("priority must be low, medium, or high");
  }

  const tags: string[] = [];

  if (!Array.isArray(record.tags)) {
    errors.push("tags must be an array of strings");
  } else {
    for (const tag of record.tags as unknown[]) {
      if (typeof tag !== "string") {
        errors.push("every tag must be a string");
      } else {
        tags.push(tag);
      }
    }
  }

  const createdAt = parseDate(record.createdAt);

  if (createdAt === null) {
    errors.push("createdAt must be a valid date");
  }

  let completedAt: Date | null = null;

  if (record.completedAt !== null) {
    completedAt = parseDate(record.completedAt);

    if (completedAt === null) {
      errors.push("completedAt must be a valid date or null");
    }
  }

  if (
    errors.length > 0 ||
    id === null ||
    !isPriority(priority) ||
    createdAt === null
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    task: {
      id: id as TaskId,
      title,
      priority,
      completedAt,
      createdAt,
      tags
    }
  };
}

export function parseTaskList(
  raw: unknown
): {
  readonly tasks: Task[];
  readonly rejected: {
    readonly index: number;
    readonly errors: string[];
  }[];
} {
  if (!Array.isArray(raw)) {
    return {
      tasks: [],
      rejected: [{ index: 0, errors: ["Expected an array of tasks"] }]
    };
  }

  const tasks: Task[] = [];
  const rejected: { index: number; errors: string[] }[] = [];

  raw.forEach((item: unknown, index: number) => {
    const result = parseTask(item);

    if (result.ok) {
      tasks.push(result.task);
    } else {
      rejected.push({ index, errors: result.errors });
    }
  });

  return { tasks, rejected };
}