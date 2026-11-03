
import { describe, expect, it } from "vitest";
import { calculateTaskStats } from "../src/stats.js";
import type { Task, TaskId } from "../src/types.js";

function createTask(overrides: Partial<Task> = {}): Task {
    return {
        id: "task-1" as TaskId,
        title: "Learn TypeScript",
        priority: "medium",
        completedAt: null,
        createdAt: new Date("2026-01-01T10:00:00Z"),
        tags: ["coding"],
        ...overrides
    };
}

describe("calculateTaskStats", () => {
    it("should return zero statistics for an empty task list", () => {
        expect(calculateTaskStats([])).toEqual({
            total: 0,
            completed: 0,
            open: 0,
            completionRate: 0,
            byPriority: {
                low: 0,
                medium: 0,
                high: 0
            },
            averageCompletionHours: 0
        });
    });

    it("should calculate total, completed, and open tasks", () => {
        const tasks = [
            createTask({ id: "1" as TaskId }),
            createTask({
                id: "2" as TaskId,
                completedAt: new Date("2026-01-02T10:00:00Z")
            }),
            createTask({ id: "3" as TaskId })
        ];

        const stats = calculateTaskStats(tasks);

        expect(stats.total).toBe(3);
        expect(stats.completed).toBe(1);
        expect(stats.open).toBe(2);
    });

    it("should calculate completion rate correctly", () => {
        const tasks = [
            createTask({
                id: "1" as TaskId,
                completedAt: new Date("2026-01-02T10:00:00Z")
            }),
            createTask({
                id: "2" as TaskId,
                completedAt: new Date("2026-01-03T10:00:00Z")
            }),
            createTask({ id: "3" as TaskId }),
            createTask({ id: "4" as TaskId })
        ];

        expect(calculateTaskStats(tasks).completionRate).toBe(50);
    });

    it("should count tasks by priority", () => {
        const tasks = [
            createTask({ id: "1" as TaskId, priority: "low" }),
            createTask({ id: "2" as TaskId, priority: "low" }),
            createTask({ id: "3" as TaskId, priority: "medium" }),
            createTask({ id: "4" as TaskId, priority: "high" }),
            createTask({ id: "5" as TaskId, priority: "high" })
        ];

        expect(calculateTaskStats(tasks).byPriority).toEqual({
            low: 2,
            medium: 1,
            high: 2
        });
    });

    it("should calculate average completion time in hours", () => {
        const tasks = [
            createTask({
                id: "1" as TaskId,
                completedAt: new Date("2026-01-01T14:00:00Z")
            }),
            createTask({
                id: "2" as TaskId,
                completedAt: new Date("2026-01-01T18:00:00Z")
            })
        ];

        expect(
            calculateTaskStats(tasks).averageCompletionHours
        ).toBe(6);
    });

    it("should return zero average when no tasks are completed", () => {
        const tasks = [
            createTask({ id: "1" as TaskId }),
            createTask({ id: "2" as TaskId })
        ];

        expect(
            calculateTaskStats(tasks).averageCompletionHours
        ).toBe(0);
    });

    it("should ignore invalid creation dates", () => {
        const tasks = [
            createTask({
                createdAt: new Date(Number.NaN),
                completedAt: new Date("2026-01-02T10:00:00Z")
            })
        ];

        const stats = calculateTaskStats(tasks);

        expect(stats.completed).toBe(1);
        expect(stats.averageCompletionHours).toBe(0);
    });

    it("should ignore invalid completion dates", () => {
        const tasks = [
            createTask({
                completedAt: new Date(Number.NaN)
            })
        ];

        expect(
            calculateTaskStats(tasks).averageCompletionHours
        ).toBe(0);
    });

    it("should ignore negative completion durations", () => {
        const tasks = [
            createTask({
                createdAt: new Date("2026-01-02T10:00:00Z"),
                completedAt: new Date("2026-01-01T10:00:00Z")
            })
        ];

        expect(
            calculateTaskStats(tasks).averageCompletionHours
        ).toBe(0);
    });

    it("should average only valid completion durations", () => {
        const tasks = [
            createTask({
                id: "1" as TaskId,
                completedAt: new Date("2026-01-01T14:00:00Z")
            }),
            createTask({
                id: "2" as TaskId,
                completedAt: new Date(Number.NaN)
            }),
            createTask({
                id: "3" as TaskId,
                completedAt: new Date("2026-01-01T18:00:00Z")
            })
        ];

        const stats = calculateTaskStats(tasks);

        expect(stats.completed).toBe(3);
        expect(stats.averageCompletionHours).toBe(6);
    });

    it("should count completed tasks even when duration is zero", () => {
        const tasks = [
            createTask({
                createdAt: new Date("2026-01-01T10:00:00Z"),
                completedAt: new Date("2026-01-01T10:00:00Z")
            })
        ];

        const stats = calculateTaskStats(tasks);

        expect(stats.completed).toBe(1);
        expect(stats.averageCompletionHours).toBe(0);
    });
});
