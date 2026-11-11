import { Link } from "react-router";
import type { BlockView } from "../../sei/session/seiSessionContext";
import { buildTrace } from "../../sei/view/trace";
import { StatusChip } from "../../ui/StatusChip";
import { TraceStrip } from "../../ui/TraceStrip";
import { formatDuration, formatHM, formatPercent, formatSignedDuration } from "../../utils";

export const BlockCard = ({ view, now }: { view: BlockView; now: string }) => {
  const { block, projection, metrics } = view;
  const tasks = projection.taskOrder.length;
  const isLive = projection.status === "running" || projection.status === "paused";
  const ended = projection.completedAt ?? projection.terminatedAt;

  const meta = [
    `${tasks} task${tasks === 1 ? "" : "s"}`,
    `${formatDuration(projection.plannedSec)} budget`,
    projection.startedAt && !ended && `started ${formatHM(projection.startedAt)}`,
    ended && `ended ${formatHM(ended)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      to={`/block/${block.id}`}
      className={`flex min-w-0 flex-col gap-3.5 rounded-tile border p-5 text-ink no-underline transition-colors hover:border-ink ${
        projection.status === "idle" ? "border-dashed border-line-strong bg-[#fcfcfb]" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-base font-semibold">{block.name}</span>
          <span className="text-xs text-muted">{meta}</span>
        </div>
        <StatusChip projection={projection} />
      </div>
      <TraceStrip trace={buildTrace(projection, now)} height={10} />
      <div className="flex justify-between gap-3 text-xs text-ink-2">
        {metrics.isFinal && metrics.fidelity ? (
          <>
            <span>
              Fidelity{" "}
              <strong className="font-mono text-ink">{formatPercent(metrics.fidelity.score)}</strong>
            </span>
            <span>
              Drift{" "}
              <strong className={`font-mono ${(metrics.executionDriftSec ?? 0) > 60 ? "text-over" : "text-ink"}`}>
                {formatSignedDuration(metrics.executionDriftSec ?? 0)}
              </strong>
            </span>
          </>
        ) : isLive ? (
          <>
            <span className="font-mono">
              {formatDuration(metrics.focusSec)} / {formatDuration(metrics.plannedFocusSec)}
            </span>
            <span>Fidelity after it ends</span>
          </>
        ) : (
          <>
            <span className="truncate">
              {projection.taskOrder
                .slice(0, 2)
                .map((id) => projection.taskStates[id]?.title)
                .join(" · ")}
            </span>
            <span className="font-semibold text-ink">Open →</span>
          </>
        )}
      </div>
    </Link>
  );
};

export const BlockGrid = ({ views, now }: { views: BlockView[]; now: string }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {views.map((v) => (
      <BlockCard key={v.block.id} view={v} now={now} />
    ))}
  </div>
);
