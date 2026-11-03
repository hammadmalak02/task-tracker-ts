import { describe, expect, it } from "vitest";
import type { Task, TaskId } from "../src/types.js";
import {
  filterTasks,
  groupBy,
  sortTasks,
  sortTasksBy
} from "../src/filters.js";

const tasks: Task[] = [
  {
    id: "a" as TaskId,
    title: "beta",
    priority: "low",
    completedAt: null,
    createdAt: new Date("2026-01-01"),
    tags: ["work"]
  },
  {
    id: "b" as TaskId,
    title: "Alpha",
    priority: "high",
    completedAt: new Date("2026-01-03"),
    createdAt: new Date("2026-01-02"),
    tags: ["study", "work"]
  },
  {
    id: "c" as TaskId,
    title: "Gamma",
    priority: "medium",
    completedAt: null,
    createdAt: new Date("2026-01-03"),
    tags: ["study"]
  }
];

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id: id as TaskId,
    title: "task",
    priority: "medium",
    completedAt: null,
    createdAt: new Date("2026-01-01"),
    tags: [],
    ...overrides
  };
}


function ids(list: Task[]): string[] {
  return list.map((task) => task.id);
}

describe("filterTasks", () => {
  it("returns all tasks when no filters are supplied", () => {
    expect(filterTasks(tasks)).toHaveLength(3);
  });


  it("returns a copy, not the same array", () => {
    expect(filterTasks(tasks)).not.toBe(tasks);
  });

  it("filters by priority and completion together", () => {
    expect(
      filterTasks(tasks, {
        priority: "high",
        completed: true
      }).map((task) => task.id)
    ).toEqual(["b"]);
  });

  it("filters tasks by priority only", () => {
    expect(
      filterTasks(tasks, { priority: "medium" }).map((task) => task.id)
    ).toEqual(["c"]);
  });

  it("filters high priority tasks", () => {
    expect(
      filterTasks(tasks, { priority: "high" }).map((task) => task.id)
    ).toEqual(["b"]);
  });

  it("returns empty array when priority does not match", () => {
    const noHigh = tasks.filter((task) => task.priority !== "high");

    expect(filterTasks(noHigh, { priority: "high" })).toEqual([]);
  });

  it("filters completed tasks", () => {
    expect(
      filterTasks(tasks, { completed: true }).map((task) => task.id)
    ).toEqual(["b"]);
  });

  it("filters uncompleted tasks", () => {
    expect(
      filterTasks(tasks, { completed: false }).map((task) => task.id)
    ).toEqual(["a", "c"]);
  });

  it("matches any requested tag", () => {
    expect(filterTasks(tasks, { tags: ["study"] })).toHaveLength(2);
  });

  it("matches multiple tags using OR logic", () => {
    expect(
      filterTasks(tasks, { tags: ["study", "work"] })
    ).toHaveLength(3);
  });

  it("returns all tasks when tags array is empty", () => {
    expect(filterTasks(tasks, { tags: [] })).toHaveLength(3);
  });

  it("returns empty array when no requested tag matches", () => {
    expect(
      filterTasks(tasks, { tags: ["personal"] })
    ).toHaveLength(0);
  });

  it("filters by creation date range", () => {
    expect(
      filterTasks(tasks, {
        createdAfter: new Date("2026-01-01"),
        createdBefore: new Date("2026-01-02")
      }).map((task) => task.id)
    ).toEqual(["a", "b"]);
  });

  it("excludes tasks created before createdAfter", () => {
    expect(
      filterTasks(tasks, {
        createdAfter: new Date("2026-01-02")
      }).map((task) => task.id)
    ).toEqual(["b", "c"]);
  });

  it("excludes tasks created after createdBefore", () => {
    expect(
      filterTasks(tasks, {
        createdBefore: new Date("2026-01-02")
      }).map((task) => task.id)
    ).toEqual(["a", "b"]);
  });

  it("includes tasks exactly on date boundaries", () => {
    expect(
      filterTasks(tasks, {
        createdAfter: new Date("2026-01-01"),
        createdBefore: new Date("2026-01-01")
      }).map((task) => task.id)
    ).toEqual(["a"]);
  });

  it("combines priority, tags and date filters", () => {
    expect(
      filterTasks(tasks, {
        priority: "high",
        tags: ["study"],
        createdAfter: new Date("2026-01-02")
      }).map((task) => task.id)
    ).toEqual(["b"]);
  });
});

describe("sortTasks", () => {
  it("sorts titles without case sensitivity", () => {
    expect(
      sortTasks(tasks, "title", "asc").map((task) => task.title)
    ).toEqual(["Alpha", "beta", "Gamma"]);
  });

  it("sorts titles in descending order", () => {
    expect(
      sortTasks(tasks, "title", "desc").map((task) => task.title)
    ).toEqual(["Gamma", "beta", "Alpha"]);
  });

  it("sorts ascending when no direction is given", () => {
    expect(
      sortTasks(tasks, "title").map((task) => task.title)
    ).toEqual(["Alpha", "beta", "Gamma"]);
  });

  it("sorts priorities by low, medium, high", () => {
    expect(
      sortTasks(tasks, "priority", "asc").map((task) => task.priority)
    ).toEqual(["low", "medium", "high"]);
  });

  it("sorts priorities in descending order", () => {
    expect(
      sortTasks(tasks, "priority", "desc").map((task) => task.priority)
    ).toEqual(["high", "medium", "low"]);
  });

  it("places uncompleted tasks last when sorting completion dates", () => {
    expect(
      sortTasks(tasks, "completedAt", "asc").map((task) => task.id)
    ).toEqual(["b", "a", "c"]);
  });

  it("keeps uncompleted tasks last in descending completion order", () => {
    expect(
      sortTasks(tasks, "completedAt", "desc").map((task) => task.id)
    ).toEqual(["b", "a", "c"]);
  });

  it("moves a null completedAt behind a date when null is first in the input", () => {
    const done = makeTask("done", { completedAt: new Date("2026-01-05") });
    const pending = makeTask("pending");

    expect(ids(sortTasks([pending, done], "completedAt", "asc"))).toEqual([
      "done",
      "pending"
    ]);
  });

  it("keeps a null completedAt behind a date when null is second in the input", () => {
    const done = makeTask("done", { completedAt: new Date("2026-01-05") });
    const pending = makeTask("pending");

    expect(ids(sortTasks([done, pending], "completedAt", "asc"))).toEqual([
      "done",
      "pending"
    ]);
  });

  it("sorts creation dates in ascending order", () => {
    expect(
      sortTasks(tasks, "createdAt", "asc").map((task) => task.id)
    ).toEqual(["a", "b", "c"]);
  });

  it("sorts creation dates in descending order", () => {
    expect(
      sortTasks(tasks, "createdAt", "desc").map((task) => task.id)
    ).toEqual(["c", "b", "a"]);
  });

  it("sorts by first tag, then by id when first tags match", () => {
    expect(
      sortTasks(tasks, "tags", "asc").map((task) => task.id)
    ).toEqual(["b", "c", "a"]);
  });

  it("sorts tasks with no tags before tagged tasks", () => {
    const empty = makeTask("empty", { tags: [] });
    const tagged = makeTask("tagged", { tags: ["a"] });

    expect(ids(sortTasks([tagged, empty], "tags", "asc"))).toEqual([
      "empty",
      "tagged"
    ]);
  });

  it("breaks ties between equal first tags by id, and reverses in desc", () => {
    const second = makeTask("b", { tags: ["x"] });
    const first = makeTask("a", { tags: ["x"] });

    expect(ids(sortTasks([second, first], "tags", "asc"))).toEqual(["a", "b"]);
    expect(ids(sortTasks([first, second], "tags", "desc"))).toEqual(["b", "a"]);
  });

  it("sorts by id", () => {
    const [third, first, second] = tasks;

    if (!third || !first || !second) {
      throw new Error("Expected at least three tasks");
    }

    const shuffled = [third, first, second];

    expect(ids(sortTasks(shuffled, "id", "asc"))).toEqual(["a", "b", "c"]);
    expect(ids(sortTasks(shuffled, "id", "desc"))).toEqual(["c", "b", "a"]);
  });

  it("treats titles that differ only by case as equal", () => {
    const lower = makeTask("x", { title: "alpha" });
    const upper = makeTask("y", { title: "Alpha" });

    expect(ids(sortTasks([lower, upper], "title", "asc"))).toEqual(["x", "y"]);
    expect(ids(sortTasks([upper, lower], "title", "asc"))).toEqual(["y", "x"]);
  });

  it("falls through to the next rule when titles are equal ignoring case", () => {
    const lower = makeTask("x", { title: "alpha" });
    const upper = makeTask("y", { title: "Alpha" });

    const sorted = sortTasksBy([lower, upper], [
      { by: "title", direction: "asc" },
      { by: "id", direction: "desc" }
    ]);

    expect(ids(sorted)).toEqual(["y", "x"]);
  });

  it("does not mutate the input array", () => {
    const original = [...tasks];

    sortTasks(tasks, "title", "desc");

    expect(tasks).toEqual(original);
  });

  it("preserves original order when sorting values are equal", () => {
    const samePriority = tasks.map((task) => ({
      ...task,
      priority: "low" as const
    }));

    expect(
      sortTasks(samePriority, "priority", "asc").map((task) => task.id)
    ).toEqual(["a", "b", "c"]);
  });

  it("supports multiple sort keys", () => {
    const sorted = sortTasksBy(tasks, [
      { by: "priority", direction: "asc" },
      { by: "title", direction: "desc" }
    ]);

    expect(sorted.map((task) => task.id)).toEqual(["a", "c", "b"]);
  });

  it("supports multiple sort keys when first key is equal", () => {
    const samePriority = tasks.map((task) => ({
      ...task,
      priority: "low" as const
    }));

    const sorted = sortTasksBy(samePriority, [
      { by: "priority", direction: "asc" },
      { by: "title", direction: "asc" }
    ]);

    expect(sorted.map((task) => task.id)).toEqual(["b", "a", "c"]);
  });

  it("preserves original order when no sort rules are supplied", () => {
    expect(
      sortTasksBy(tasks, []).map((task) => task.id)
    ).toEqual(["a", "b", "c"]);
  });

  it("rejects invalid sort keys at compile time", () => {
    // @ts-expect-error "unknownKey" is not a Task property
    sortTasks(tasks, "unknownKey", "asc");
  });
});

describe("groupBy", () => {
  it("groups tasks by priority", () => {
    const grouped = groupBy(tasks, (task) => task.priority);

    expect(grouped.low?.map((task) => task.id)).toEqual(["a"]);
    expect(grouped.high?.map((task) => task.id)).toEqual(["b"]);
    expect(grouped.medium?.map((task) => task.id)).toEqual(["c"]);
  });

  it("groups multiple items under the same key", () => {
    const grouped = groupBy(tasks, (task) =>
      task.completedAt === null ? "pending" : "completed"
    );

    expect(grouped.pending?.map((task) => task.id)).toEqual(["a", "c"]);
    expect(grouped.completed?.map((task) => task.id)).toEqual(["b"]);
  });

  it("returns empty object for empty input", () => {
    const grouped = groupBy([], (item: string) => item);

    expect(Object.keys(grouped)).toEqual([]);
  });

  it("supports grouping by tags", () => {
    const grouped = groupBy(tasks, (task) => task.tags[0] ?? "untagged");

    expect(grouped.work?.map((task) => task.id)).toEqual(["a"]);
    expect(grouped.study?.map((task) => task.id)).toEqual(["b", "c"]);
  });
});