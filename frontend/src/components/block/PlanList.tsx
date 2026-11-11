import { toast } from "react-toastify";
import type { TaskId } from "../../sei/domain/ids";
import { orderedTaskStates, type TaskExecutionState } from "../../sei/domain/projection";
import type { BlockActions, BlockView } from "../../sei/session/seiSessionContext";
import { useSeiStore } from "../../sei/store/seiStoreContext";
import { Button } from "../../ui/Button";
import { CloseIcon, PlusIcon } from "../../ui/icons";
import { Progress } from "../../ui/Progress";
import { TaskStateIcon } from "../../ui/TaskStateIcon";
import { formatClock, formatDuration } from "../../utils";

const warnIfRejected = (events: unknown[], message: string) => {
  if (events.length === 0) toast.warn(message);
};

export const PlanList = ({
  view,
  actions,
  onAddTask,
}: {
  view: BlockView;
  actions: BlockActions;
  onAddTask: () => void;
}) => {
  const { savePlan } = useSeiStore();
  const { block, tasks, projection } = view;
  const states = orderedTaskStates(projection);
  const isLive = projection.status === "running" || projection.status === "paused";
  const isIdle = projection.status === "idle";

  const removeTask = (taskId: TaskId) => {
    const remaining = tasks.filter((t) => t.id !== taskId);
    savePlan({ ...block, taskIds: remaining.map((t) => t.id) }, remaining);
    if (isLive) actions.replan();
  };

  const row = (task: TaskExecutionState) => {
    const isActive = projection.activeTaskId === task.taskId;
    const done = task.status === "completed" || task.status === "skipped";
    const touched = task.startedAt !== null || task.status !== "pending";
    const inPlan = tasks.some((t) => t.id === task.taskId);
    const tone = task.status === "running" ? "live" : task.status === "paused" ? "paused" : "recorded";
    return (
      <li
        key={task.taskId}
        className={`flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-divider px-5 py-3.5 last:border-b-0 ${isActive ? "bg-live-tint" : ""}`}
      >
        <TaskStateIcon status={task.status} />
        {/* on a phone the numbers and actions wrap under the title */}
        <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-1.5">
          <span
            className={`truncate text-sm ${isActive ? "font-semibold" : "font-medium"} ${
              task.status === "completed" ? "text-ink-2 line-through" : task.status === "skipped" ? "text-muted" : ""
            }`}
          >
            {task.title}
          </span>
          {task.status === "skipped" ? (
            <span className="text-xs text-muted">skipped{task.elapsedSec > 0 ? ` after ${formatDuration(task.elapsedSec)}` : ""}</span>
          ) : (
            <Progress
              value={task.status === "completed" ? 100 : task.progress}
              tone={tone}
              overRatio={task.plannedSec > 0 ? task.overrunSec / task.plannedSec : 0}
              height={4}
              label={`${task.title} progress`}
            />
          )}
        </div>
        <div className="ml-auto flex items-center gap-3.5 pl-[34px] sm:pl-0">
        <span className="whitespace-nowrap font-mono text-[13px] text-ink-2 tabular">
          {touched ? `${formatClock(task.elapsedSec)} / ` : ""}
          {formatDuration(task.plannedSec)}
        </span>
        <span className={`w-11 text-right font-mono text-xs ${task.overrunSec > 0 ? "font-semibold text-over" : "text-faint"}`}>
          {task.overrunSec >= 60 ? `+${formatDuration(task.overrunSec)}` : "—"}
        </span>
        <div className="flex shrink-0 items-center justify-end gap-1 sm:w-[132px]">
          {isLive && !done && !isActive && (
            <>
              <Button
                size="sm"
                variant="quiet"
                className="px-2 text-live"
                aria-label={`Switch to ${task.title}`}
                onClick={() => warnIfRejected(actions.switchTask(task.taskId), "Could not switch to this task.")}
              >
                Switch
              </Button>
              <Button
                size="sm"
                variant="quiet"
                className="px-2"
                aria-label={`Skip ${task.title}`}
                onClick={() => warnIfRejected(actions.skipTask(task.taskId), "Could not skip this task.")}
              >
                Skip
              </Button>
            </>
          )}
          {isIdle && (
            <Button
              size="sm"
              variant="quiet"
              className="px-2"
              aria-label={`Start with ${task.title}`}
              onClick={() => warnIfRejected(actions.start(task.taskId), "Could not start this task.")}
            >
              Start here
            </Button>
          )}
          {(isIdle || isLive) && !touched && inPlan && (
            <button
              type="button"
              aria-label={`Remove ${task.title}`}
              title={states.length === 1 ? "A block needs at least one task" : "Remove from plan"}
              disabled={states.length === 1}
              onClick={() => removeTask(task.taskId)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-faint hover:bg-sunken hover:text-ink disabled:opacity-40"
            >
              <CloseIcon size={15} />
            </button>
          )}
        </div>
        </div>
      </li>
    );
  };

  return (
    <section aria-label="Plan" className="overflow-hidden rounded-section border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="m-0 text-[15px] font-semibold">Plan</h2>
        <Button size="sm" variant="quiet" icon={<PlusIcon size={14} />} onClick={onAddTask}>
          Add task
        </Button>
      </div>
      {states.length === 0 ? (
        <p className="m-0 px-5 py-8 text-center text-sm text-muted">No tasks yet.</p>
      ) : (
        <ul aria-label="Tasks" className="m-0 list-none p-0">
          {states.map(row)}
        </ul>
      )}
    </section>
  );
};
