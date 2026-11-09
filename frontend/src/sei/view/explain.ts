import type { ExecutionMetrics } from "../domain/metrics";
import {
  orderedTaskStates,
  type BlockExecutionProjection,
} from "../domain/projection";
import { formatDuration, formatSignedDuration, plural } from "../../utils";

// Plain-language readings of the metrics, shown next to the numbers.

export const completionNote = (projection: BlockExecutionProjection): string => {
  const tasks = orderedTaskStates(projection);
  const planned = tasks.reduce((acc, t) => acc + t.plannedSec, 0);
  if (planned === 0) {
    const done = tasks.filter((t) => t.status === "completed").length;
    return `${done} of ${tasks.length} tasks done.`;
  }
  const done = tasks
    .filter((t) => t.status === "completed")
    .reduce((acc, t) => acc + t.plannedSec, 0);
  return `${formatDuration(done)} of ${formatDuration(planned)} planned work done.`;
};

export const timeAccuracyNote = (projection: BlockExecutionProjection): string => {
  const measured = orderedTaskStates(projection).filter(
    (t) => t.status === "completed" && t.plannedSec > 0,
  );
  if (measured.length === 0) return "No completed task had an estimate to compare.";
  const worst = Math.max(...measured.map((t) => Math.abs(t.elapsedSec - t.plannedSec)));
  if (worst < 60) return "Completed tasks landed on their estimates.";
  return `Completed tasks landed within ${formatDuration(worst)} of their estimates.`;
};

export const orderNote = (projection: BlockExecutionProjection): string => {
  const started = orderedTaskStates(projection).filter((t) => t.startedAt !== null).length;
  if (projection.switchCount === 0) return "Worked in the planned order.";
  return `${plural(projection.switchCount, "switch", "switches")} across ${plural(started, "started task")}.`;
};

// One sentence that connects drift and variance: where did the time go?
export const driftInsight = (metrics: ExecutionMetrics): string | null => {
  const drift = metrics.executionDriftSec;
  const variance = metrics.focusVarianceSec;
  if (!metrics.isFinal || drift === null || variance === null) return null;
  if (Math.abs(drift) < 60) return "The block fit its budget.";
  if (drift < 0) return `Finished ${formatDuration(-drift)} inside the budget.`;
  if (variance >= drift / 2) {
    return `Tasks ran ${formatSignedDuration(variance)} over their estimates, which explains most of the ${formatDuration(drift)} overrun.`;
  }
  const estimates =
    Math.abs(variance) < 60
      ? "Estimates were on target"
      : `Estimates were close (${formatSignedDuration(variance)})`;
  return `${estimates} but the block ran ${formatDuration(drift)} long: the overrun came from pauses, not from the work.`;
};
