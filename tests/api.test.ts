import { describe, it, expect, vi } from "vitest";
import { createTaskApi, cloneTask } from "../src/api.js";
import { NetworkError } from "../src/fetcher.js";
import type { Task, TaskId } from "../src/types.js";

describe("api coverage extras", () => {
  it("uses default options when none given", async () => {
    vi.useFakeTimers();
    const api = createTaskApi(); 
    const promise = api.listTasks();
    await vi.runAllTimersAsync(); 
    expect(await promise).toHaveLength(2);
    vi.useRealTimers();
  });

  it("rejects if signal already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const api = createTaskApi({ delayMs: 0 });
    await expect(api.listTasks(controller.signal)).rejects.toThrow(
      "Request aborted"
    );
  });

  it("rejects if aborted while waiting", async () => {
    const controller = new AbortController();
    const api = createTaskApi({ delayMs: 1000, random: () => 1 });
    const promise = api.listTasks(controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow("Request aborted");
  });

  it("works with live signal that never aborts", async () => {
    const controller = new AbortController();
    const api = createTaskApi({ delayMs: 0 });
    expect(await api.listTasks(controller.signal)).toHaveLength(2);
  });

  it("throws NetworkError when shouldFail is true", async () => {
    const api = createTaskApi({ delayMs: 0, shouldFail: () => true });
    await expect(api.listTasks()).rejects.toBeInstanceOf(NetworkError);
  });

  it("cloneTask copies completedAt when set", () => {
    const done: Task = {
      id: "t" as TaskId,
      title: "Done",
      priority: "low",
      completedAt: new Date("2026-10-25T10:00:00Z"),
      createdAt: new Date("2026-10-20T09:00:00Z"),
      tags: ["x"]
    };
    const copy = cloneTask(done);
    expect(copy.completedAt).toEqual(done.completedAt);
    expect(copy.completedAt).not.toBe(done.completedAt); 
    expect(copy.tags).not.toBe(done.tags); 
  });
});