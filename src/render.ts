
import {
    assertNever,
    type AsyncState,
    type Task
} from "./types.js";

export type RenderOptions = {
    readonly isOverdue?: (task: Task) => boolean;
};

export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
        switch (character) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&quot;";
            case "'":
                return "&#39;";
            default:
                return character;
        }
    });
}

function formatDate(date: Date): string {
    if (Number.isNaN(date.getTime())) {
        return "Invalid date";
    }

    return escapeHtml(date.toLocaleDateString());
}

export function renderTask(
    task: Task,
    options: RenderOptions = {}
): string {
    const completed = task.completedAt !== null;
    const overdue = !completed && (options.isOverdue?.(task) ?? false);

    const classes = [
        "task",
        completed ? "task-completed" : "task-open",
        overdue ? "task-overdue" : ""
    ]
        .filter(Boolean)
        .join(" ");

    const safePriority = escapeHtml(task.priority);

    const tags = task.tags
        .map(
            (tag) =>
                `<span class="task-tag">${escapeHtml(tag)}</span>`
        )
        .join("");

    const completedDate = completed
        ? `<time class="task-completed-at">Completed: ${formatDate(task.completedAt)}</time>`
        : "";

    return `
    <article class="${classes}" data-task-id="${escapeHtml(task.id)}">
      <h3 class="task-title">${escapeHtml(task.title)}</h3>

      <span class="task-priority priority-${safePriority}">
        ${safePriority}
      </span>

      <span class="task-status">
        ${completed ? "Completed" : "Open"}
      </span>

      <time class="task-created">
        Created: ${formatDate(task.createdAt)}
      </time>

      ${completedDate}

      <div class="task-tags">${tags}</div>
    </article>
  `;
}

export function renderTaskList(
    tasks: readonly Task[],
    options: RenderOptions = {}
): string {
    if (tasks.length === 0) {
        return '<p class="task-empty">No tasks available.</p>';
    }

    return `
    <section class="task-list">
      ${tasks.map((task) => renderTask(task, options)).join("")}
    </section>
  `;
}

export function renderAsyncState(
    state: AsyncState<Task[]>,
    options: RenderOptions = {}
): string {
    switch (state.status) {
        case "loading":
            return '<p class="task-loading">Loading tasks...</p>';

        case "error":
            return `
        <div class="task-error" role="alert">
          <p>${escapeHtml(state.message)}</p>
          <p>Please try again.</p>
        </div>
      `;

        case "empty":
            return '<p class="task-empty">No tasks available.</p>';

        case "success":
            return renderTaskList(state.data, options);

        default:
            return assertNever(state);
    }
}
