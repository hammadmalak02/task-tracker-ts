
import type { Task, Priority } from "./types.js";

export type TaskStats = {
    readonly total: number;
    readonly completed: number;
    readonly open: number;
    readonly completionRate: number;
    readonly byPriority: Readonly<Record<Priority, number>>;
    readonly averageCompletionHours: number;
};

export function calculateTaskStats(
    tasks: readonly Task[]
): TaskStats {
    const byPriority: Record<Priority, number> = {
        low: 0,
        medium: 0,
        high: 0
    };

    let completed = 0;
    let validCompletionCount = 0;
    let totalCompletionHours = 0;

    for (const task of tasks) {
        byPriority[task.priority] += 1;

        if (task.completedAt !== null) {
            completed += 1;

            const createdTime = task.createdAt.getTime();
            const completedTime = task.completedAt.getTime();

            if (
                Number.isFinite(createdTime) &&
                Number.isFinite(completedTime) &&
                completedTime >= createdTime
            ) {
                const completionHours =
                    (completedTime - createdTime) / (1000 * 60 * 60);

                totalCompletionHours += completionHours;
                validCompletionCount += 1;
            }
        }
    }

    const total = tasks.length;
    const open = total - completed;

    const completionRate =
        total === 0 ? 0 : (completed / total) * 100;

    const averageCompletionHours =
        validCompletionCount === 0
            ? 0
            : totalCompletionHours / validCompletionCount;

    return {
        total,
        completed,
        open,
        completionRate,
        byPriority,
        averageCompletionHours
    };
}
