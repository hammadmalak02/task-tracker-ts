import { describe, expect, it, vi } from "vitest";
import type { Task, TaskId } from "../src/types.js";
import {
    fetchTasksPage,
    loadAllTasks,
    createTaskPagination,
    type PageFetcher,
    type TaskPage
} from "../src/pagination.js";

function makeTask(
    id: string,
    title: string,
    createdAt: string
): Task {
    return {
        id: id as TaskId,
        title,
        priority: "medium",
        completedAt: null,
        createdAt: new Date(createdAt),
        tags: []
    };
}

describe("pagination", () => {


    it("loads tasks across multiple pages", async () => {
        const first = makeTask("1", "First", "2026-01-01");
        const second = makeTask("2", "Second", "2026-01-02");

        const fetcher: PageFetcher = async (cursor) =>
            cursor === null
                ? { items: [first], nextCursor: "page-2" }
                : { items: [second], nextCursor: null };

        const result = await loadAllTasks(fetcher);

        expect(result.tasks.map((task) => task.id)).toEqual(["1", "2"]);
        expect(result.nextCursor).toBeNull();
    });

    it("removes overlapping tasks and keeps the newer version", async () => {
        const oldTask = makeTask("1", "Old title", "2026-01-01");
        const newerTask = makeTask("1", "New title", "2026-01-02");

        const fetcher: PageFetcher = async (cursor) =>
            cursor === null
                ? { items: [oldTask], nextCursor: "next" }
                : { items: [newerTask], nextCursor: null };

        const result = await loadAllTasks(fetcher);

        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0]?.title).toBe("New title");
    });

    it("stops when a cursor repeats", async () => {
        const fetcher: PageFetcher = async () => ({
            items: [],
            nextCursor: "same"
        });

        await expect(loadAllTasks(fetcher)).rejects.toThrow(
            "Pagination cursor repeated"
        );
    });

    it("stops when the page limit is reached", async () => {
        const fetcher: PageFetcher = async (cursor) => ({
            items: [],
            nextCursor: cursor === null ? "page-2" : "page-3"
        });

        await expect(
            loadAllTasks(fetcher, { maxPages: 2 })
        ).rejects.toThrow("Maximum page limit reached");
    });

    it("returns a cloned page", async () => {
        const task = makeTask("1", "Task", "2026-01-01");

        const page = await fetchTasksPage(null, async () => ({
            items: [task],
            nextCursor: null
        }));

        expect(page.items[0]).not.toBe(task);
        expect(page.items[0]).toEqual(task);
    });

    it("clones completedAt when task is completed", async () => {
        const done: Task = {
            ...makeTask("1", "Done", "2026-01-01"),
            completedAt: new Date("2026-01-05T10:00:00Z")
        };

        const page = await fetchTasksPage(null, async () => ({
            items: [done],
            nextCursor: null
        }));

        expect(page.items[0]?.completedAt).toEqual(done.completedAt);
        expect(page.items[0]?.completedAt).not.toBe(done.completedAt);
    });

    it("keeps the newer task when the older one arrives later", async () => {
        const newerTask = makeTask("1", "New title", "2026-01-02");
        const olderTask = makeTask("1", "Old title", "2026-01-01");

        const fetcher: PageFetcher = async (cursor) =>
            cursor === null
                ? { items: [newerTask], nextCursor: "next" }
                : { items: [olderTask], nextCursor: null };

        const result = await loadAllTasks(fetcher);

        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0]?.title).toBe("New title");
    });

    it("lets the later task win when createdAt is equal", async () => {
        const a = makeTask("1", "First version", "2026-01-01");
        const b = makeTask("1", "Second version", "2026-01-01");

        const fetcher: PageFetcher = async (cursor) =>
            cursor === null
                ? { items: [a], nextCursor: "next" }
                : { items: [b], nextCursor: null };

        const result = await loadAllTasks(fetcher);

        expect(result.tasks[0]?.title).toBe("Second version");
    });

    it("stops when a cursor repeats later in the chain", async () => {
        const fetcher: PageFetcher = async (cursor) => ({
            items: [],
            nextCursor:
                cursor === null ? "a" : cursor === "a" ? "b" : "a"
        });

        await expect(loadAllTasks(fetcher)).rejects.toThrow(
            "Pagination cursor repeated"
        );
    });

    it.each([0, -1, 1.5, Number.NaN])(
        "rejects invalid maxPages (%s)",
        async (maxPages) => {
            const fetcher: PageFetcher = async () => ({
                items: [],
                nextCursor: null
            });

            await expect(
                loadAllTasks(fetcher, { maxPages })
            ).rejects.toThrow("maxPages must be a positive integer");
        }
    );

    it("fetchTasksPage throws if already aborted, fetcher not called", async () => {
        const controller = new AbortController();
        controller.abort();

        const emptyPage: TaskPage = { items: [], nextCursor: null };
        const fetcher = vi.fn(async () => emptyPage);

        await expect(
            fetchTasksPage(null, fetcher, controller.signal)
        ).rejects.toThrow("Request aborted");

        expect(fetcher).not.toHaveBeenCalled();
    });

    it("fetchTasksPage throws if aborted during fetch", async () => {
        const controller = new AbortController();

        const fetcher: PageFetcher = async () => {
            controller.abort(); 
            return { items: [], nextCursor: null };
        };

        await expect(
            fetchTasksPage(null, fetcher, controller.signal)
        ).rejects.toThrow("Request aborted");
    });

    it("loadAllTasks throws if signal already aborted", async () => {
        const controller = new AbortController();
        controller.abort();

        const emptyPage: TaskPage = { items: [], nextCursor: null };
        const fetcher = vi.fn(async () => emptyPage);

        await expect(
            loadAllTasks(fetcher, { signal: controller.signal })
        ).rejects.toThrow("Request aborted");

        expect(fetcher).not.toHaveBeenCalled();
    });
});

describe("createTaskPagination", () => {
    it("starts with an empty state", () => {
        const pagination = createTaskPagination(async () => ({
            items: [],
            nextCursor: null
        }));

        expect(pagination.getState()).toEqual({ status: "empty" });
        expect(pagination.getError()).toBeNull();
        expect(pagination.isLoading()).toBe(false);
        expect(pagination.hasMore()).toBe(true);
    });

    it("loads the first page successfully", async () => {
        const task = makeTask("1", "First task", "2026-01-01");

        const pagination = createTaskPagination(async () => ({
            items: [task],
            nextCursor: null
        }));

        await pagination.loadMore();

        expect(pagination.getState()).toMatchObject({
            status: "success",
            data: [{ id: "1", title: "First task" }]
        });
        expect(pagination.isLoading()).toBe(false);
        expect(pagination.hasMore()).toBe(false);
    });

    it("loads multiple pages", async () => {
        const first = makeTask("1", "First", "2026-01-01");
        const second = makeTask("2", "Second", "2026-01-02");

        const fetcher: PageFetcher = async (cursor) =>
            cursor === null
                ? { items: [first], nextCursor: "next" }
                : { items: [second], nextCursor: null };

        const pagination = createTaskPagination(fetcher);

        await pagination.loadMore();

        expect(pagination.getState().status).toBe("success");
        expect(pagination.hasMore()).toBe(true);

        await pagination.loadMore();

        expect(pagination.getState()).toMatchObject({
            status: "success",
            data: [
                { id: "1", title: "First" },
                { id: "2", title: "Second" }
            ]
        });

        expect(pagination.hasMore()).toBe(false);
    });

    it("keeps the newer version of duplicate tasks", async () => {
        const oldTask = makeTask("1", "Old", "2026-01-01");
        const newTask = makeTask("1", "New", "2026-01-02");

        const fetcher: PageFetcher = async (cursor) =>
            cursor === null
                ? { items: [oldTask], nextCursor: "next" }
                : { items: [newTask], nextCursor: null };

        const pagination = createTaskPagination(fetcher);

        await pagination.loadMore();
        await pagination.loadMore();

        expect(pagination.getState()).toMatchObject({
            status: "success",
            data: [{ id: "1", title: "New" }]
        });
    });

    it("keeps the previous task when an older duplicate arrives", async () => {
        const newer = makeTask("1", "New", "2026-01-02");
        const older = makeTask("1", "Old", "2026-01-01");

        const fetcher: PageFetcher = async (cursor) =>
            cursor === null
                ? { items: [newer], nextCursor: "next" }
                : { items: [older], nextCursor: null };

        const pagination = createTaskPagination(fetcher);

        await pagination.loadMore();
        await pagination.loadMore();

        expect(pagination.getState()).toMatchObject({
            status: "success",
            data: [{ id: "1", title: "New" }]
        });
    });

    it("sets empty state when no tasks are returned", async () => {
        const pagination = createTaskPagination(async () => ({
            items: [],
            nextCursor: null
        }));

        await pagination.loadMore();

        expect(pagination.getState()).toEqual({ status: "empty" });
        expect(pagination.hasMore()).toBe(false);
    });

    it("sets error state when the first request fails", async () => {
        const pagination = createTaskPagination(async () => {
            throw new Error("Network failed");
        });

        await expect(pagination.loadMore()).rejects.toThrow(
            "Network failed"
        );

        expect(pagination.getState()).toEqual({
            status: "error",
            message: "Network failed"
        });

        expect(pagination.getError()).toBe("Network failed");
        expect(pagination.isLoading()).toBe(false);
    });

    it("uses fallback message for non-Error failures", async () => {
        const pagination = createTaskPagination(async () => {
            throw "Something went wrong";
        });

        await expect(pagination.loadMore()).rejects.toBe(
            "Something went wrong"
        );

        expect(pagination.getError()).toBe("Failed to load tasks");
        expect(pagination.getState()).toEqual({
            status: "error",
            message: "Failed to load tasks"
        });
    });

    it("preserves previously loaded tasks when next page fails", async () => {
        const task = makeTask("1", "First", "2026-01-01");

        const fetcher: PageFetcher = async (cursor) => {
            if (cursor === null) {
                return { items: [task], nextCursor: "next" };
            }

            throw new Error("Second page failed");
        };

        const pagination = createTaskPagination(fetcher);

        await pagination.loadMore();

        await expect(pagination.loadMore()).rejects.toThrow(
            "Second page failed"
        );

        expect(pagination.getState()).toMatchObject({
            status: "success",
            data: [{ id: "1", title: "First" }]
        });

        expect(pagination.getError()).toBe("Second page failed");
        expect(pagination.isLoading()).toBe(false);
    });

    it("rejects when signal is already aborted", async () => {
        const controller = new AbortController();
        controller.abort();

        const fetcher = vi.fn(async () => ({
            items: [],
            nextCursor: null
        }));

        const pagination = createTaskPagination(fetcher);

        await expect(
            pagination.loadMore(controller.signal)
        ).rejects.toThrow("Request aborted");

        expect(fetcher).not.toHaveBeenCalled();
        expect(pagination.isLoading()).toBe(false);
    });

    it("detects a repeated cursor", async () => {
        const fetcher: PageFetcher = async () => ({
            items: [],
            nextCursor: "same"
        });

        const pagination = createTaskPagination(fetcher);

        await pagination.loadMore();

        await expect(pagination.loadMore()).rejects.toThrow(
            "Pagination cursor repeated"
        );

        expect(pagination.getError()).toBe("Pagination cursor repeated");
        expect(pagination.isLoading()).toBe(false);
    });

    it("reuses an already pending request", async () => {
        const task = makeTask("1", "First", "2026-01-01");

        let resolvePage: ((page: TaskPage) => void) | undefined;

        const fetcher: PageFetcher = () =>
            new Promise<TaskPage>((resolve) => {
                resolvePage = resolve;
            });

        const pagination = createTaskPagination(fetcher);

        const firstRequest = pagination.loadMore();
        const secondRequest = pagination.loadMore();

        expect(firstRequest).toBe(secondRequest);
        expect(pagination.isLoading()).toBe(true);

        resolvePage?.({
            items: [task],
            nextCursor: null
        });

        await firstRequest;

        expect(pagination.isLoading()).toBe(false);
        expect(pagination.getState()).toMatchObject({
            status: "success",
            data: [{ id: "1" }]
        });
    });

    it("does not fetch again after pagination finishes", async () => {
        const fetcher = vi.fn(async () => ({
            items: [makeTask("1", "First", "2026-01-01")],
            nextCursor: null
        }));

        const pagination = createTaskPagination(fetcher);

        await pagination.loadMore();
        await pagination.loadMore();

        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(pagination.hasMore()).toBe(false);
    });
});
