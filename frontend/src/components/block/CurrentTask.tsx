import type { BlockActions, BlockView } from "../../sei/session/seiSessionContext";
import { Button } from "../../ui/Button";
import { BreakIcon, CheckIcon, PauseIcon, PlayIcon, SkipIcon, StopIcon } from "../../ui/icons";
import { Progress } from "../../ui/Progress";
import { formatClock, formatDuration } from "../../utils";

export const CurrentTaskCard = ({ view, actions }: { view: BlockView; actions: BlockActions }) => {
  const { projection } = view;
  const task = projection.activeTaskId ? projection.taskStates[projection.activeTaskId] : null;
  const index = task ? projection.taskOrder.indexOf(task.taskId) + 1 : 0;
  const onBreak = projection.status === "paused" && projection.pauseKind === "block";
  const taskPaused = projection.status === "paused" && projection.pauseKind === "task";
  const over = task ? task.overrunSec > 0 : false;

  const eyebrow = onBreak ? "On a break" : taskPaused ? "Paused" : `Now · task ${index} of ${projection.taskOrder.length}`;

  return (
    <section
      aria-label="Current task"
      className={`flex flex-col gap-5 rounded-section border bg-surface p-6 sm:p-7 ${
        projection.status === "running" ? "border-live-line" : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-col gap-2">
          <span
            className={`text-[11px] font-bold uppercase tracking-[0.08em] ${
              projection.status === "running" ? "text-live" : "text-amber"
            }`}
          >
            {eyebrow}
          </span>
          <span data-testid="current-task" className="text-[22px] font-semibold tracking-[-0.01em]">
            {task?.title ?? "Between tasks"}
          </span>
          {task && <span className="text-[13px] text-muted">{formatDuration(task.plannedSec)} planned</span>}
        </div>
        {task && (
          <div className="flex flex-col items-end gap-0.5">
            <span
              role="timer"
              className={`font-mono text-5xl font-medium leading-none tracking-[-0.03em] tabular sm:text-[64px] ${
                over ? "text-over" : ""
              }`}
            >
              {over ? `+${formatClock(task.overrunSec)}` : formatClock(task.remainingSec)}
            </span>
            <span className="text-xs text-muted">
              {over ? "over plan" : "left"} · <span data-testid="task-elapsed">{formatClock(task.elapsedSec)}</span> focused
            </span>
          </div>
        )}
      </div>

      {task && (
        <Progress
          value={task.progress}
          tone={projection.status === "running" ? "live" : "paused"}
          overRatio={task.plannedSec > 0 ? task.overrunSec / task.plannedSec : 0}
          label="Task progress"
        />
      )}

      <div className="flex flex-wrap gap-2.5">
        {onBreak ? (
          <Button variant="primary" icon={<PlayIcon size={16} />} onClick={() => actions.resumeBlock()}>
            End break
          </Button>
        ) : taskPaused ? (
          <>
            <Button variant="primary" icon={<PlayIcon size={16} />} onClick={() => actions.resumeTask()}>
              Resume
            </Button>
            <Button icon={<CheckIcon size={16} />} onClick={() => actions.completeTask()}>
              Complete task
            </Button>
          </>
        ) : task ? (
          <>
            <Button variant="primary" icon={<PauseIcon size={16} />} onClick={() => actions.pauseTask()}>
              Pause
            </Button>
            <Button icon={<CheckIcon size={16} />} onClick={() => actions.completeTask()}>
              Complete task
            </Button>
            <Button icon={<SkipIcon size={16} />} onClick={() => actions.skipTask()}>
              Skip
            </Button>
            <Button variant="quiet" icon={<BreakIcon size={16} />} onClick={() => actions.pauseBlock("break")}>
              Take a break
            </Button>
          </>
        ) : null}
        <Button
          variant="quiet"
          className="ml-auto"
          icon={<StopIcon size={16} />}
          onClick={() => actions.terminate("user_exit")}
        >
          Stop session
        </Button>
      </div>
    </section>
  );
};

export const ReadyCard = ({ view, actions }: { view: BlockView; actions: BlockActions }) => {
  const { projection, metrics } = view;
  const count = projection.taskOrder.length;
  return (
    <section aria-label="Ready" className="flex flex-col gap-5 rounded-section border border-dashed border-line-strong bg-surface p-6 sm:p-7">
      <div className="flex flex-col gap-2">
        <span className="label-caps">Ready</span>
        <span className="text-[22px] font-semibold tracking-[-0.01em]">
          {count === 0
            ? "Add a task to start"
            : `${count} task${count === 1 ? "" : "s"} · ${formatDuration(metrics.plannedFocusSec)} planned`}
        </span>
        <span className="text-[13px] leading-relaxed text-muted">
          Starting freezes the plan into the trace. From then on, BlocTi records what actually happens.
        </span>
      </div>
      <div>
        <Button variant="primary" icon={<PlayIcon size={16} />} disabled={count === 0} onClick={() => actions.start()}>
          Start session
        </Button>
      </div>
    </section>
  );
};
