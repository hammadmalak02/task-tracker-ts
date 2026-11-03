
import { describe, expect, it } from "vitest";
import { parseTask, parseTaskList } from "../src/validation.js";

const validTask = {
  id: "task-1",
  title: "Finish assignment",
  priority: "high",
  completedAt: null,
  createdAt: "2026-10-24T10:00:00.000Z",
  tags: ["study", "typescript"]
};

describe("parseTask", () => {
  it("accepts a valid task", () => {
    const result = parseTask(validTask);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.task.title).toBe("Finish assignment");
      expect(result.task.completedAt).toBeNull();
      expect(result.task.tags).toEqual(["study", "typescript"]);
    }
  });

  it("rejects an empty title", () => {
    const result = parseTask({ ...validTask, title: "   " });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContain("title must not be empty");
    }
  });

  it("rejects a title longer than 120 characters", () => {
    const result = parseTask({ ...validTask, title: "a".repeat(121) });

    expect(result.ok).toBe(false);
  });

  it("rejects an unsupported priority", () => {
    const result = parseTask({ ...validTask, priority: "urgent" });

    expect(result.ok).toBe(false);
  });

  it("rejects invalid creation dates", () => {
    const result = parseTask({ ...validTask, createdAt: "not-a-date" });

    expect(result.ok).toBe(false);
  });

  it("rejects non-string tags", () => {
    const result = parseTask({ ...validTask, tags: ["valid", 123] });

    expect(result.ok).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(parseTask(null).ok).toBe(false);
    expect(parseTask("task").ok).toBe(false);
  });

  it("collects multiple validation errors", () => {
    const result = parseTask({
      ...validTask,
      title: "",
      priority: "urgent",
      createdAt: "invalid"
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("parseTaskList", () => {
  it("keeps valid tasks and reports invalid items", () => {
    const result = parseTaskList([
      validTask,
      { ...validTask, title: "" }
    ]);

    expect(result.tasks).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.index).toBe(1);
  });

  it("handles non-array input", () => {
    const result = parseTaskList(null);

    expect(result.tasks).toEqual([]);
    expect(result.rejected).toHaveLength(1);
  });
});
