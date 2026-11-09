import { Link } from "react-router";
import type { BlockView } from "../../sei/session/seiSessionContext";
import { buildTrace } from "../../sei/view/trace";
import { TraceStrip } from "../../ui/TraceStrip";
import { formatDuration, formatHM } from "../../utils";

const COLS = "grid grid-cols-[minmax(0,3fr)_minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4";

export const AgentSessionTable = ({ views, now }: { views: BlockView[]; now: string }) => (
  <div className="overflow-x-auto rounded-tile border border-line bg-surface">
    <div className="min-w-[640px]">
      <div className={`${COLS} label-caps border-b border-line px-5 py-3`}>
        <span>Session</span>
        <span>Trace</span>
        <span>Turns</span>
        <span>Agent time</span>
      </div>
      {views.map(({ block, projection, metrics }, i) => {
        const end = projection.completedAt ?? projection.terminatedAt;
        return (
          <Link
            key={block.id}
            to={`/block/${block.id}`}
            className={`${COLS} items-center px-5 py-3.5 text-sm text-ink no-underline hover:bg-paper ${
              i < views.length - 1 ? "border-b border-divider" : ""
            }`}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-semibold">{block.name}</span>
              <span className="text-xs text-muted">
                {projection.startedAt ? formatHM(projection.startedAt) : "—"}
                {end ? ` – ${formatHM(end)}` : projection.startedAt ? " – now" : ""}
              </span>
            </span>
            <TraceStrip trace={buildTrace(projection, now, { includePlan: false })} height={8} />
            <span className="font-mono">
              {metrics.completedTasks}/{metrics.totalTasks}
            </span>
            <span className="font-mono">{formatDuration(metrics.focusSec)}</span>
          </Link>
        );
      })}
    </div>
  </div>
);
