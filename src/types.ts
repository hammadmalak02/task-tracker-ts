
export type TaskId = string & {
  readonly __brand: "TaskId";
};

export type Priority = "low" | "medium" | "high";

export type Task = {
  readonly id: TaskId;
  readonly title: string;
  readonly priority: Priority;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly tags: readonly string[];
};

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type AsyncState<T> =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "empty" }
  | { readonly status: "success"; readonly data: T };

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

export function mapAsyncState<T, U>(
  state: AsyncState<T>,
  transform: (value: T) => U
): AsyncState<U> {
  switch (state.status) {
    case "loading":
      return { status: "loading" };
    case "error":
      return { status: "error", message: state.message };
    case "empty":
      return { status: "empty" };
    case "success":
      return { status: "success", data: transform(state.data) };
    default:
      return assertNever(state);
  }
}
