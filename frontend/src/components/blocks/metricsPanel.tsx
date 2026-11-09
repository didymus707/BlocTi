import type { ReactNode } from "react";
import type { ExecutionMetrics } from "../../sei/domain/metrics";
import { formatDuration, formatPercent, formatSignedDuration } from "../../utils";

const Metric = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) => (
  <div aria-label={label} className="border border-gray-100 rounded-sm p-3">
    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400">{label}</p>
    <p className="text-lg font-semibold text-gray-900 tabular-nums">{value}</p>
    {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
  </div>
);

export const MetricsPanel = ({ metrics }: { metrics: ExecutionMetrics }) => {
  if (!metrics.hasStarted) return null;
  const soFar = metrics.isFinal ? undefined : "so far";
  const f = metrics.fidelity;

  return (
    <section aria-label="Execution metrics" className="mt-10">
      <h3 className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-400 mb-4">
        Execution Metrics {metrics.isFinal ? "" : "(live)"}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric
          label="Fidelity"
          value={f ? formatPercent(f.score) : "—"}
          hint={`completion rate ${formatPercent(metrics.completionRate)}`}
        />
        <Metric
          label="Execution Drift"
          value={
            metrics.executionDriftSec === null
              ? "—"
              : formatSignedDuration(metrics.executionDriftSec)
          }
          hint={soFar ?? "wall clock vs budget"}
        />
        <Metric
          label="Focus Variance"
          value={
            metrics.focusVarianceSec === null
              ? "—"
              : formatSignedDuration(metrics.focusVarianceSec)
          }
          hint="completed tasks vs estimate"
        />
        <Metric
          label="Focus Time"
          value={formatDuration(metrics.focusSec)}
          hint={`of ${formatDuration(metrics.plannedFocusSec)} planned`}
        />
        <Metric label="Wall Clock" value={formatDuration(metrics.wallClockSec)} hint={soFar} />
        <Metric
          label="Pauses"
          value={formatDuration(metrics.pauseSec)}
          hint={
            metrics.inferredPauseSec > 0
              ? `${formatDuration(metrics.inferredPauseSec)} inferred`
              : "all observed"
          }
        />
        <Metric
          label="Tasks"
          value={`${metrics.completedTasks}/${metrics.totalTasks}`}
          hint={`${metrics.skippedTasks} skipped`}
        />
        {metrics.unaccountedSec >= 60 && (
          <Metric
            label="Unaccounted"
            value={formatDuration(metrics.unaccountedSec)}
            hint="no events cover this time"
          />
        )}
      </div>
      {f && (
        <p aria-label="Fidelity breakdown" className="text-xs text-gray-500 mt-3">
          Fidelity = completion {formatPercent(f.completion)} × (50% + 50% ×
          adherence {formatPercent(f.adherence)}) · time accuracy{" "}
          {formatPercent(f.timeAccuracy)} · order {formatPercent(f.sequence)}
        </p>
      )}
    </section>
  );
};
