import { Link } from "react-router";
import type { BlockActions, BlockView } from "../../sei/session/seiSessionContext";
import { RoundButton } from "../../ui/Button";
import { PauseIcon, PlayIcon } from "../../ui/icons";
import { Progress } from "../../ui/Progress";
import { formatClock, formatDuration } from "../../utils";

// The running session, pinned to the top of Today.
export const LiveStrip = ({ view, actions }: { view: BlockView; actions: BlockActions }) => {
  const { block, projection } = view;
  const task = projection.activeTaskId ? projection.taskStates[projection.activeTaskId] : null;
  const paused = projection.status === "paused";

  return (
    <section
      aria-label="Live session"
      className="flex flex-wrap items-center gap-6 rounded-tile border border-live-line bg-surface px-6 py-5"
    >
      <div className="flex min-w-0 flex-[999_1_320px] flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-bold uppercase tracking-[0.06em] ${
              paused ? "bg-amber-soft text-amber" : "bg-live-soft text-live"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${paused ? "bg-amber" : "bg-live"}`} aria-hidden="true" />
            {paused ? (projection.pauseKind === "block" ? "On a break" : "Paused") : "Live"}
          </span>
          <span className="truncate text-[13px] text-ink-2">{block.name}</span>
        </div>
        <span className="truncate text-lg font-semibold tracking-[-0.01em]">{task?.title ?? "Between tasks"}</span>
        {task && (
          <div className="flex items-center gap-3">
            <Progress
              value={task.progress}
              tone={paused ? "paused" : "live"}
              overRatio={task.plannedSec > 0 ? task.overrunSec / task.plannedSec : 0}
              height={6}
              className="flex-1"
              label="Task progress"
            />
            <span className="font-mono text-xs text-ink-2 tabular">
              {formatClock(task.elapsedSec)} / {formatDuration(task.plannedSec)}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 items-center justify-end gap-5">
        {task && (
          <span
            className={`font-mono text-[40px] font-medium tracking-[-0.02em] tabular ${task.overrunSec > 0 ? "text-over" : ""}`}
          >
            {task.overrunSec > 0 ? `+${formatClock(task.overrunSec)}` : formatClock(task.remainingSec)}
          </span>
        )}
        <div className="flex gap-2">
          {projection.status === "running" ? (
            <RoundButton label="Pause" onClick={() => actions.pauseTask()} disabled={!task}>
              <PauseIcon />
            </RoundButton>
          ) : (
            <RoundButton
              label="Resume"
              onClick={() => (projection.pauseKind === "block" ? actions.resumeBlock() : actions.resumeTask())}
            >
              <PlayIcon />
            </RoundButton>
          )}
          <Link
            to={`/block/${block.id}`}
            className="inline-flex h-11 items-center rounded-full border border-ink bg-ink px-4 text-sm font-semibold text-white no-underline hover:bg-ink-2"
          >
            Open
          </Link>
        </div>
      </div>
    </section>
  );
};
