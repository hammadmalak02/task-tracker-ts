
import {
    assertNever,
    type AsyncState,
    type Task,
    type TaskId
} from "./types.js";

export type TaskPatch = Partial<Omit<Task, "id">>;

export type StoreApi = {
    readonly saveTask: (task: Task) => Promise<Task>;
    readonly deleteTask: (id: TaskId) => Promise<void>;
};

export type StoreAction =
    | { readonly type: "replace"; readonly tasks: Task[] }
    | { readonly type: "add"; readonly task: Task }
    | { readonly type: "update"; readonly task: Task }
    | { readonly type: "delete"; readonly id: TaskId };

export type SuccessState = Extract<
    AsyncState<Task[]>,
    { status: "success" }
>;

export function reducer(
    state: SuccessState,
    action: StoreAction
): SuccessState {
    switch (action.type) {
        case "replace":
            return { status: "success", data: action.tasks };

        case "add":
            return {
                status: "success",
                data: [...state.data, action.task]
            };

        case "update":
            return {
                status: "success",
                data: state.data.map((task) =>
                    task.id === action.task.id ? action.task : task
                )
            };

        case "delete":
            return {
                status: "success",
                data: state.data.filter((task) => task.id !== action.id)
            };

        default:
            return assertNever(action);
    }
}

export type TaskStore = {
    readonly getState: () => AsyncState<Task[]>;
    readonly subscribe: (listener: () => void) => () => void;
    readonly addTask: (task: Task) => Promise<void>;
    readonly updateTask: (id: TaskId, patch: TaskPatch) => Promise<void>;
    readonly toggleComplete: (id: TaskId) => Promise<void>;
    readonly deleteTask: (id: TaskId) => Promise<void>;
};

type PendingOperation =
    | {
        type: "add";
        status: "pending" | "success" | "failed";
        readonly task: Task;
        savedTask?: Task;
    }
    | {
        type: "update";
        status: "pending" | "success" | "failed";
        readonly task: Task;
        savedTask?: Task;
    }
    | {
        type: "delete";
        status: "pending" | "success" | "failed";
    };

export function createTaskStore(
    api: StoreApi,
    initialTasks: Task[] = []
): TaskStore {
    let state: SuccessState = {
        status: "success",
        data: [...initialTasks]
    };

    const confirmedTasks = new Map<TaskId, Task>(
        initialTasks.map((task) => [task.id, task])
    );
    const operations = new Map<TaskId, PendingOperation[]>();

    const listeners = new Set<() => void>();

    function notify(): void {
        for (const listener of [...listeners]) {
            listener();
        }
    }

    function dispatch(action: StoreAction): void {
        state = reducer(state, action);
        notify();
    }

    function findTask(id: TaskId): Task | undefined {
        return state.data.find((task) => task.id === id);
    }

    function recomputeTask(id: TaskId): void {
        const taskOperations = operations.get(id) ?? [];
        let current = confirmedTasks.get(id);
        for (const operation of taskOperations) {
            if (operation.status === "failed") {
                continue;
            }

            switch (operation.type) {
                case "add":
                case "update":
                    current =
                        operation.status === "success"
                            ? (operation.savedTask ?? operation.task)
                            : operation.task;
                    break;

                case "delete":
                    current = undefined;
                    break;

                default:
                    assertNever(operation);
            }
        }

        const visibleTask = findTask(id);

        if (current === undefined) {
            if (visibleTask !== undefined) {
                dispatch({ type: "delete", id });
            }
            return;
        }

        if (visibleTask !== current) {
            if (visibleTask === undefined) {
                dispatch({ type: "add", task: current });
            } else {
                dispatch({ type: "update", task: current });
            }
        }
    }

    function settleOperation(
        id: TaskId,
        operation: PendingOperation,
        success: boolean,
        savedTask?: Task
    ): void {
        operation.status = success ? "success" : "failed";

        if (savedTask !== undefined && success) {
            if (operation.type === "add" || operation.type === "update") {
                operation.savedTask = savedTask;
            }
        }

        const taskOperations = operations.get(id);

        if (taskOperations === undefined) {
            return;
        }
        while (
            taskOperations.length > 0 &&
            taskOperations[0]?.status !== "pending"
        ) {
            const completed = taskOperations.shift();

            if (completed === undefined || completed.status === "failed") {
                continue;
            }

            switch (completed.type) {
                case "add":
                case "update":
                    confirmedTasks.set(
                        id,
                        completed.savedTask ?? completed.task
                    );
                    break;

                case "delete":
                    confirmedTasks.delete(id);
                    break;

                default:
                    assertNever(completed);
            }
        }

        if (taskOperations.length === 0) {
            operations.delete(id);
        }

        recomputeTask(id);
    }

    function enqueueOperation(
        id: TaskId,
        operation: PendingOperation
    ): void {
        const taskOperations = operations.get(id) ?? [];
        taskOperations.push(operation);
        operations.set(id, taskOperations);
    }

    async function addTask(task: Task): Promise<void> {
        const operation: PendingOperation = {
            type: "add",
            status: "pending",
            task
        };

        enqueueOperation(task.id, operation);
        recomputeTask(task.id);

        try {
            const saved = await api.saveTask(task);
            settleOperation(task.id, operation, true, saved);
        } catch (error: unknown) {
            settleOperation(task.id, operation, false);
            throw error;
        }
    }

    async function updateTask(
        id: TaskId,
        patch: TaskPatch
    ): Promise<void> {
        const previous = findTask(id);

        if (previous === undefined) {
            throw new Error("Task not found");
        }

        const updated: Task = {
            ...previous,
            ...patch,
            id
        };

        const operation: PendingOperation = {
            type: "update",
            status: "pending",
            task: updated
        };

        enqueueOperation(id, operation);
        recomputeTask(id);

        try {
            const saved = await api.saveTask(updated);
            settleOperation(id, operation, true, saved);
        } catch (error: unknown) {
            settleOperation(id, operation, false);
            throw error;
        }
    }

    async function toggleComplete(id: TaskId): Promise<void> {
        const task = findTask(id);

        if (task === undefined) {
            throw new Error("Task not found");
        }

        const completedAt =
            task.completedAt === null ? new Date() : null;

        await updateTask(id, { completedAt });
    }

    async function deleteTask(id: TaskId): Promise<void> {
        const previous = findTask(id);

        if (previous === undefined) {
            throw new Error("Task not found");
        }

        const operation: PendingOperation = {
            type: "delete",
            status: "pending"
        };

        enqueueOperation(id, operation);
        recomputeTask(id);

        try {
            await api.deleteTask(id);
            settleOperation(id, operation, true);
        } catch (error: unknown) {
            settleOperation(id, operation, false);
            throw error;
        }
    }

    return {
        getState: () => state,

        subscribe(listener) {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },

        addTask,
        updateTask,
        toggleComplete,
        deleteTask
    };
}
