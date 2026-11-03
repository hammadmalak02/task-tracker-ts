
import { describe, expect, it, vi } from "vitest";
import {
    escapeHtml,
    renderTask,
    renderTaskList,
    renderAsyncState
} from "../src/render.js";
import type { Task, TaskId, AsyncState } from "../src/types.js";

function createTask(overrides: Partial<Task> = {}): Task {
    return {
        id: "task-1" as TaskId,
        title: "Learn TypeScript",
        priority: "medium",
        completedAt: null,
        createdAt: new Date("2026-01-01T10:00:00Z"),
        tags: ["coding", "learning"],
        ...overrides
    };
}

describe("escapeHtml", () => {
    it("should escape HTML special characters", () => {
        expect(escapeHtml(`<div class="test">It's & fun</div>`))
            .toBe("&lt;div class=&quot;test&quot;&gt;It&#39;s &amp; fun&lt;/div&gt;");
    });

    it("should return normal text unchanged", () => {
        expect(escapeHtml("Hello World")).toBe("Hello World");
    });

    it("should handle empty strings", () => {
        expect(escapeHtml("")).toBe("");
    });
});

describe("renderTask", () => {
    it("should render an open task", () => {
        const html = renderTask(createTask());

        expect(html).toContain('class="task task-open"');
        expect(html).toContain("Learn TypeScript");
        expect(html).toContain("medium");
        expect(html).toContain("Open");
    });

    it("should render a completed task", () => {
        const task = createTask({
            completedAt: new Date("2026-01-02T10:00:00Z")
        });

        const html = renderTask(task);

        expect(html).toContain("task-completed");
        expect(html).toContain("Completed");
        expect(html).toContain("task-completed-at");
    });

    it("should escape task title, ID, priority, and tags", () => {
        const task = createTask({
            id: 'task"<script>' as TaskId,
            title: '<script>alert("xss")</script>',
            priority: "high",
            tags: ['<img src=x>', "safe"]
        });

        const html = renderTask(task);

        expect(html).toContain(
            "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
        );
        expect(html).toContain('task&quot;&lt;script&gt;');
        expect(html).toContain("&lt;img src=x&gt;");

        expect(html).not.toContain("<script>");
        expect(html).not.toContain("<img src=x>");
    });

    it("should mark task overdue when callback returns true", () => {
        const task = createTask();
        const isOverdue = vi.fn(() => true);

        const html = renderTask(task, { isOverdue });

        expect(html).toContain("task-overdue");
        expect(isOverdue).toHaveBeenCalledWith(task);
    });

    it("should not mark completed task as overdue", () => {
        const task = createTask({
            completedAt: new Date("2026-01-02T10:00:00Z")
        });

        const isOverdue = vi.fn(() => true);

        const html = renderTask(task, { isOverdue });

        expect(html).not.toContain("task-overdue");
        expect(isOverdue).not.toHaveBeenCalled();
    });

    it("should not mark task overdue when callback returns false", () => {
        const html = renderTask(createTask(), {
            isOverdue: () => false
        });

        expect(html).not.toContain("task-overdue");
    });

    it("should display invalid date safely", () => {
        const task = createTask({
            createdAt: new Date(Number.NaN)
        });

        const html = renderTask(task);

        expect(html).toContain("Invalid date");
    });
});

describe("renderTaskList", () => {
    it("should render an empty message when no tasks exist", () => {
        expect(renderTaskList([])).toBe(
            '<p class="task-empty">No tasks available.</p>'
        );
    });

    it("should render multiple tasks", () => {
        const tasks = [
            createTask({ id: "task-1" as TaskId }),
            createTask({
                id: "task-2" as TaskId,
                title: "Learn JavaScript"
            })
        ];

        const html = renderTaskList(tasks);

        expect(html).toContain('class="task-list"');
        expect(html).toContain("Learn TypeScript");
        expect(html).toContain("Learn JavaScript");
    });

    it("should pass render options to each task", () => {
        const tasks = [
            createTask({ id: "task-1" as TaskId }),
            createTask({ id: "task-2" as TaskId })
        ];

        const isOverdue = vi.fn(() => true);

        const html = renderTaskList(tasks, { isOverdue });

        expect(isOverdue).toHaveBeenCalledTimes(2);
        expect(html.match(/task-overdue/g)).toHaveLength(2);
    });
});

describe("renderAsyncState", () => {
    it("should render loading state", () => {
        const state: AsyncState<Task[]> = {
            status: "loading"
        };

        expect(renderAsyncState(state)).toContain("Loading tasks...");
    });

    it("should render error state safely", () => {
        const state: AsyncState<Task[]> = {
            status: "error",
            message: '<script>alert("error")</script>'
        };

        const html = renderAsyncState(state);

        expect(html).toContain(
            "&lt;script&gt;alert(&quot;error&quot;)&lt;/script&gt;"
        );
        expect(html).toContain('role="alert"');
        expect(html).not.toContain("<script>");
    });

    it("should render empty state", () => {
        const state: AsyncState<Task[]> = {
            status: "empty"
        };

        expect(renderAsyncState(state)).toContain(
            "No tasks available."
        );
    });

    it("should render successful state with tasks", () => {
        const state: AsyncState<Task[]> = {
            status: "success",
            data: [createTask()]
        };

        const html = renderAsyncState(state);

        expect(html).toContain("Learn TypeScript");
        expect(html).toContain("task-list");
    });

    it("should render successful state with no tasks", () => {
        const state: AsyncState<Task[]> = {
            status: "success",
            data: []
        };

        expect(renderAsyncState(state)).toContain(
            "No tasks available."
        );
    });

    it("should pass render options to successful state", () => {
        const state: AsyncState<Task[]> = {
            status: "success",
            data: [createTask()]
        };

        const isOverdue = vi.fn(() => true);

        const html = renderAsyncState(state, { isOverdue });

        expect(html).toContain("task-overdue");
        expect(isOverdue).toHaveBeenCalledTimes(1);
    });
});
