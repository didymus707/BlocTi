import { Link } from "react-router";
import { EmptyState, Page, PageHeader } from "../components/layout/Page";
import { portfolioMetrics } from "../sei/domain/metrics";
import { useSeiSession } from "../sei/session/seiSessionContext";
import { useSeiStore } from "../sei/store/seiStoreContext";
import { MetricTile } from "../ui/MetricTile";
import { Chip } from "../ui/StatusChip";
import { chipKind } from "../sei/view/status";
import { formatDuration, formatHM, formatPercent, formatShortDate, formatSignedDuration, plural } from "../utils";

const COLS = "grid grid-cols-[minmax(0,3fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4";

export const Reports = () => {
  const { blocks } = useSeiSession();
  const { status } = useSeiStore();
  const finished = blocks.filter((b) => !b.capturedByAgent && b.metrics.isFinal).reverse();
  const totals = portfolioMetrics(finished.map((b) => b.metrics));

  return (
    <Page>
      <PageHeader title="Reports" meta="Finished timed blocks. Open one for its full execution report." />
      {status === "loading" ? (
        <p className="text-sm text-muted">Loading reports…</p>
      ) : finished.length === 0 ? (
        <EmptyState title="No finished blocks yet" body="When a block completes or is stopped, its report appears here." />
      ) : (
        <>
          <section aria-label="Totals" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricTile
              label="Avg fidelity"
              value={totals.averageFidelity === null ? "—" : formatPercent(totals.averageFidelity)}
              hint={plural(finished.length, "block")}
            />
            <MetricTile
              label="Total drift"
              value={formatSignedDuration(totals.executionDriftSec)}
              tone={totals.executionDriftSec > 60 ? "over" : "default"}
              hint="wall clock vs budget"
            />
            <MetricTile label="Focus" value={formatDuration(totals.focusSec)} hint={`of ${formatDuration(totals.plannedFocusSec)} planned`} />
          </section>
          <div className="overflow-x-auto rounded-tile border border-line bg-surface">
            <div className="min-w-[640px]">
              <div className={`${COLS} label-caps border-b border-line px-5 py-3`}>
                <span>Block</span>
                <span>Status</span>
                <span>Fidelity</span>
                <span>Drift</span>
                <span>Focus</span>
              </div>
              {finished.map(({ block, projection, metrics }, i) => {
                const ended = projection.completedAt ?? projection.terminatedAt;
                const drift = metrics.executionDriftSec ?? 0;
                return (
                  <Link
                    key={block.id}
                    to={`/block/${block.id}`}
                    className={`${COLS} items-center px-5 py-3.5 text-sm text-ink no-underline hover:bg-paper ${
                      i < finished.length - 1 ? "border-b border-divider" : ""
                    }`}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-semibold">{block.name}</span>
                      <span className="text-xs text-muted">
                        {ended && `${formatShortDate(ended)} · ${formatHM(ended)}`}
                      </span>
                    </span>
                    <span>
                      <Chip kind={chipKind(projection)} />
                    </span>
                    <span className="font-mono">{metrics.fidelity ? formatPercent(metrics.fidelity.score) : "—"}</span>
                    <span className={`font-mono ${drift > 60 ? "text-over" : ""}`}>{formatSignedDuration(drift)}</span>
                    <span className="font-mono">{formatDuration(metrics.focusSec)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </Page>
  );
};
