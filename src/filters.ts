import type { Task } from "./types.js";

type SortDirection = "asc" | "desc";

type SortRule = {
  readonly by: keyof Task;
  readonly direction: SortDirection;
};

export function filterTasks(
  tasks: Task[],
  filters?: {
    priority?: Task["priority"];
    completed?: boolean;
    tags?: string[];
    createdAfter?: Date;
    createdBefore?: Date;
  }
): Task[] {
  if (!filters) return [...tasks];

  return tasks.filter((task) => {
    if (filters.priority && task.priority !== filters.priority) {
      return false;
    }

    if (filters.completed !== undefined) {
      const isCompleted = task.completedAt !== null;

      if (isCompleted !== filters.completed) {
        return false;
      }
    }

    if (filters.tags && filters.tags.length > 0) {
      const matchesTag = filters.tags.some((tag) =>
        task.tags.includes(tag)
      );

      if (!matchesTag) return false;
    }

    if (filters.createdAfter && task.createdAt < filters.createdAfter) {
      return false;
    }

    if (filters.createdBefore && task.createdAt > filters.createdBefore) {
      return false;
    }

    return true;
  });
}

const priorityOrder: Record<Task["priority"], number> = {
  low: 1,
  medium: 2,
  high: 3
};

function compareTasks(a: Task, b: Task, by: keyof Task): number {
  switch (by) {
    case "id":
      return a.id.localeCompare(b.id);

    case "title": {
      const titleA = a.title.toLowerCase();
      const titleB = b.title.toLowerCase();

      return titleA.localeCompare(titleB);
    }

    case "priority":
      return priorityOrder[a.priority] - priorityOrder[b.priority];

    case "createdAt":
      return a.createdAt.getTime() - b.createdAt.getTime();

    case "completedAt": {
      if (a.completedAt === null && b.completedAt === null) return 0;
      if (a.completedAt === null) return 1;
      if (b.completedAt === null) return -1;

      return a.completedAt.getTime() - b.completedAt.getTime();
    }

    case "tags": {
      const firstTagA = [...a.tags].sort()[0] ?? "";
      const firstTagB = [...b.tags].sort()[0] ?? "";

      const tagComparison = firstTagA.localeCompare(firstTagB);

      if (tagComparison !== 0) {
        return tagComparison;
      }

      return a.id.localeCompare(b.id);
    }
  }
}

export function sortTasks(
  tasks: Task[],
  by: keyof Task,
  direction: SortDirection = "asc"
): Task[] {
  return sortTasksBy(tasks, [{ by, direction }]);
}

export function sortTasksBy(
  tasks: Task[],
  rules: readonly SortRule[]
): Task[] {
  return [...tasks].sort((a, b) => {
    for (const rule of rules) {
      const comparison = compareTasks(a, b, rule.by);

      if (comparison !== 0) {
        if (
          rule.by === "completedAt" &&
          (a.completedAt === null || b.completedAt === null)
        ) {
          return comparison;
        }

        return rule.direction === "asc" ? comparison : -comparison;
      }
    }

    return 0;
  });
}

export function groupBy<T, K extends PropertyKey>(
  items: readonly T[],
  keyFn: (item: T) => K
): Partial<Record<K, T[]>> {
  const groups: Partial<Record<K, T[]>> = {};

  for (const item of items) {
    const key = keyFn(item);

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(item);
  }

  return groups;
}