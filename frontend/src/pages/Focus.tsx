import { Link, useParams } from "react-router";
import { orderedTaskStates } from "../sei/domain/projection";
import { useSeiSession } from "../sei/session/seiSessionContext";
import { Button, RoundButton } from "../ui/Button";
import { CheckIcon, CloseIcon, LogoMark, PauseIcon, PlayIcon, SkipIcon } from "../ui/icons";
import { formatClock, formatDuration } from "../utils";

// Full-screen and dark: the only place the Night palette is used.
export const Focus = () => {
  const { id } = useParams<{ id: string }>();
  const { getBlock, activeBlockId, actionsFor } = useSeiSession();
  const view = getBlock(id ?? activeBlockId ?? undefined);
  const isLive = view && (view.projection.status === "running" || view.projection.status === "paused");

  const shell = "flex min-h-screen flex-col gap-10 bg-night px-6 py-7 text-night-ink sm:px-10 sm:pb-10";

  if (!view || !isLive) {
    return (
      <div className={`${shell} items-center justify-center text-center`}>
        <LogoMark size={48} />
        <p className="m-0 text-lg">Nothing is running right now.</p>
        <Link to={view ? `/block/${view.block.id}` : "/"} className="text-night-live-text">
          {view ? "Back to the block" : "Back to Today"}
        </Link>
      </div>
    );
  }

  const { block, projection, metrics } = view;
  const actions = actionsFor(block.id);
  const tasks = orderedTaskStates(projection);
  const task = projection.activeTaskId ? projection.taskStates[projection.activeTaskId] : null;
  const index = task ? projection.taskOrder.indexOf(task.taskId) + 1 : 0;
  const onBreak = projection.status === "paused" && projection.pauseKind === "block";
  const paused = projection.status === "paused";
  const over = task ? task.overrunSec > 0 : false;
  const next = tasks.find(
    (t) => t.taskId !== task?.taskId && t.status !== "completed" && t.status !== "skipped",
  );
  const timer = task ? (over ? `+${formatClock(task.overrunSec)}` : formatClock(task.remainingSec)) : "--:--";

  return (
    <div className={`${shell} justify-between`}>
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <LogoMark />
          <span className="truncate text-sm text-night-muted">{block.name}</span>
        </div>
        <Link
          to={`/block/${block.id}`}
          aria-label="Exit focus mode"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-night-line text-night-ink hover:bg-white/5"
        >
          <CloseIcon />
        </Link>
      </header>

      <section aria-label="Current focus" className="flex flex-col items-center gap-5 text-center">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-night-live-text">
          <span className={`h-2 w-2 rounded-full ${paused ? "bg-amber-mid" : "bg-night-live"}`} aria-hidden="true" />
          {onBreak ? "On a break" : paused ? "Paused" : `Focusing · task ${index} of ${tasks.length}`}
        </span>
        <h1 className="m-0 max-w-3xl text-[26px] font-semibold tracking-[-0.02em] sm:text-[34px]">
          {task?.title ?? "Between tasks"}
        </h1>
        <span
          role="timer"
          aria-label={over ? `${formatClock(task!.overrunSec)} over plan` : `${timer} left`}
          className={`font-mono text-[clamp(88px,16vw,240px)] font-light leading-none tracking-[-0.05em] tabular ${
            over ? "text-night-over" : ""
          }`}
        >
          {timer}
        </span>
        {task && (
          <span className="text-[15px] text-night-muted">
            {over ? "over" : "left of"} {formatDuration(task.plannedSec)} · {formatClock(task.elapsedSec)} focused
          </span>
        )}
      </section>

      <footer className="flex flex-col items-center gap-8">
        <div className="flex items-center gap-5">
          <Button
            className="rounded-full border-night-line bg-transparent text-night-ink hover:bg-white/5"
            icon={<SkipIcon size={16} />}
            disabled={!task || paused}
            onClick={() => actions.skipTask()}
          >
            Skip
          </Button>
          {paused ? (
            <RoundButton
              label={onBreak ? "End break" : "Resume"}
              tone="night-solid"
              diameter={80}
              onClick={() => (onBreak ? actions.resumeBlock() : actions.resumeTask())}
            >
              <PlayIcon size={28} />
            </RoundButton>
          ) : (
            <RoundButton label="Pause" tone="night-solid" diameter={80} disabled={!task} onClick={() => actions.pauseTask()}>
              <PauseIcon size={28} />
            </RoundButton>
          )}
          <Button
            className="rounded-full border-night-line bg-transparent text-night-ink hover:bg-white/5"
            icon={<CheckIcon size={16} />}
            disabled={!task || onBreak}
            onClick={() => actions.completeTask()}
          >
            Done
          </Button>
        </div>
        <div className="flex w-full max-w-[640px] flex-col gap-2.5">
          <div className="flex h-1 gap-[3px]" aria-hidden="true">
            {tasks.map((t, i) => {
              const fill =
                t.status === "completed" || t.status === "skipped"
                  ? "bg-night-ink"
                  : t.taskId === task?.taskId
                    ? ""
                    : "bg-night-line";
              return (
                <div
                  key={t.taskId}
                  className={`${fill} ${i === 0 ? "rounded-l-full" : ""} ${i === tasks.length - 1 ? "rounded-r-full" : ""}`}
                  style={{
                    flex: `${Math.max(t.plannedSec, 1)} 1 0`,
                    background:
                      t.taskId === task?.taskId
                        ? `linear-gradient(to right, var(--color-night-live) ${Math.min(100, t.progress)}%, var(--color-night-line) ${Math.min(100, t.progress)}%)`
                        : undefined,
                  }}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-[13px] text-night-muted">
            <span>
              Block {formatDuration(metrics.focusSec)} of {formatDuration(metrics.plannedFocusSec)}
            </span>
            {next && (
              <span>
                Next: {next.title} · {formatDuration(next.plannedSec)}
              </span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
