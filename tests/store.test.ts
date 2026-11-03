import { describe, expect, it, vi } from "vitest";

import { createTaskStore, reducer } from "../src/store.js";

import type { Task, TaskId } from "../src/types.js";

function makeTask(): Task {
    return {
        id: "task-1" as TaskId,
        title: "Learn TypeScript",
        priority: "high",
        completedAt: null,
        createdAt: new Date("2026-10-20T09:00:00Z"),
        tags: ["learning"]
    };
}

function makeApi() {
    return {
        saveTask: vi.fn(async (task: Task) => task),
        deleteTask: vi.fn(async () => undefined)
    };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}

describe("createTaskStore", () => {

    it("adds a task immediately", async () => {
        const api = makeApi();
        const task = makeTask();
        const store = createTaskStore(api);

        const operation = store.addTask(task);

        expect(store.getState()).toMatchObject({
            status: "success",
            data: [task]
        });

        await operation;
        expect(api.saveTask).toHaveBeenCalledOnce();
    });

    it("rolls back a failed update", async () => {
        const task = makeTask();
        const api = makeApi();

        api.saveTask.mockRejectedValueOnce(new Error("Offline"));

        const store = createTaskStore(api, [task]);

        await expect(
            store.updateTask(task.id, { title: "Changed title" })
        ).rejects.toThrow("Offline");

        expect(store.getState()).toMatchObject({
            status: "success",
            data: [task]
        });
    });

    it("rolls back a failed deletion", async () => {
        const task = makeTask();
        const api = makeApi();

        api.deleteTask.mockRejectedValueOnce(new Error("Offline"));

        const store = createTaskStore(api, [task]);

        await expect(store.deleteTask(task.id)).rejects.toThrow("Offline");

        expect(store.getState()).toMatchObject({
            status: "success",
            data: [task]
        });
    });

    it("notifies subscribers when the state changes", async () => {
        const api = makeApi();
        const listener = vi.fn();
        const store = createTaskStore(api);

        store.subscribe(listener);
        await store.addTask(makeTask());

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not notify after unsubscribe", async () => {
        const api = makeApi();
        const listener = vi.fn();
        const store = createTaskStore(api);

        const unsubscribe = store.subscribe(listener);
        unsubscribe();

        await store.addTask(makeTask());

        expect(listener).not.toHaveBeenCalled();
    });

    it("toggles completion", async () => {
        const task = makeTask();
        const api = makeApi();
        const store = createTaskStore(api, [task]);

        await store.toggleComplete(task.id);

        const state = store.getState();

        expect(state.status).toBe("success");

        if (state.status === "success") {
            expect(state.data[0]?.completedAt).toBeInstanceOf(Date);
        }
    });

    it("rolls back a failed task addition", async () => {
        const api = makeApi();
        const task = makeTask();

        api.saveTask.mockRejectedValueOnce(new Error("Offline"));

        const store = createTaskStore(api);

        await expect(store.addTask(task)).rejects.toThrow("Offline");

        expect(store.getState()).toMatchObject({
            status: "success",
            data: []
        });
    });

    it("throws when updating a task that does not exist", async () => {
        const store = createTaskStore(makeApi());

        await expect(
            store.updateTask("missing-task" as TaskId, {
                title: "Updated title"
            })
        ).rejects.toThrow("Task not found");
    });

    it("throws when deleting a task that does not exist", async () => {
        const store = createTaskStore(makeApi());

        await expect(
            store.deleteTask("missing-task" as TaskId)
        ).rejects.toThrow("Task not found");
    });

    it("throws when toggling a task that does not exist", async () => {
        const store = createTaskStore(makeApi());

        await expect(
            store.toggleComplete("missing-task" as TaskId)
        ).rejects.toThrow("Task not found");
    });

    it("marks a completed task as incomplete", async () => {
        const task: Task = {
            ...makeTask(),
            completedAt: new Date("2026-10-21T10:00:00Z")
        };

        const api = makeApi();
        const store = createTaskStore(api, [task]);

        await store.toggleComplete(task.id);

        const state = store.getState();

        expect(state.status).toBe("success");

        if (state.status === "success") {
            expect(state.data[0]?.completedAt).toBeNull();
        }
    });

    it("reducer replaces all tasks", () => {
        const next = reducer(
            { status: "success", data: [] },
            { type: "replace", tasks: [makeTask()] }
        );

        expect(next.data).toHaveLength(1);
    });

    it("reducer throws on unknown action", () => {
        expect(() =>
            reducer(
                { status: "success", data: [] },
                { type: "nope" } as never
            )
        ).toThrow();
    });

    it("ignores stale save result when a newer update happened", async () => {
        const task = makeTask();
        const api = makeApi();
        const slow = deferred<Task>();
        api.saveTask.mockImplementationOnce(() => slow.promise);

        const store = createTaskStore(api, [task]);

        const first = store.updateTask(task.id, { title: "first" });
        await store.updateTask(task.id, { title: "second" });
        slow.resolve({ ...task, title: "first" });
        await first;

        const state = store.getState();
        expect(state.status === "success" && state.data[0]?.title).toBe(
            "second"
        );
    });

    it("does not roll back a stale failed update", async () => {
        const task = makeTask();
        const api = makeApi();
        const slow = deferred<Task>();

        api.saveTask.mockImplementationOnce(() => slow.promise);

        const store = createTaskStore(api, [task]);

        const first = store.updateTask(task.id, { title: "first" });
        const firstResult = expect(first).rejects.toThrow("Offline");

        await store.updateTask(task.id, { title: "second" });

        slow.reject(new Error("Offline"));
        await firstResult;

        const state = store.getState();
        expect(state.status === "success" && state.data[0]?.title).toBe(
            "second"
        );
    });

    it("ignores stale add result when a newer update happened", async () => {
        const task = makeTask();
        const api = makeApi();
        const slow = deferred<Task>();

        api.saveTask.mockImplementationOnce(() => slow.promise);

        const store = createTaskStore(api);

        const adding = store.addTask(task);
        await store.updateTask(task.id, { title: "newer" });

        slow.resolve(task);
        await adding;

        const state = store.getState();
        expect(state.status === "success" && state.data[0]?.title).toBe(
            "newer"
        );
    });

    it("does not remove task when stale add fails", async () => {
        const task = makeTask();
        const api = makeApi();
        const slow = deferred<Task>();

        api.saveTask.mockImplementationOnce(() => slow.promise);

        const store = createTaskStore(api);

        const adding = store.addTask(task);
        const addingResult = expect(adding).rejects.toThrow("Offline");

        await store.updateTask(task.id, { title: "newer" });

        slow.reject(new Error("Offline"));
        await addingResult;

        const state = store.getState();
        expect(state.status === "success" && state.data).toHaveLength(1);
    });

    it("does not re-add task when stale delete fails", async () => {
        const task = makeTask();
        const api = makeApi();
        const slow = deferred<undefined>();

        api.deleteTask.mockImplementationOnce(() => slow.promise);

        const store = createTaskStore(api, [task]);

        const deleting = store.deleteTask(task.id);
        const deletingResult = expect(deleting).rejects.toThrow("Offline");

        await store.addTask(task);

        slow.reject(new Error("Offline"));
        await deletingResult;

        const state = store.getState();
        expect(state.status === "success" && state.data).toHaveLength(1);
    });
});