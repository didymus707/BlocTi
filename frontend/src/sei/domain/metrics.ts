import {
  conformanceOf,
  type ConformanceReport,
  type Verdict,
} from "./conformance";
import { orderedTaskStates, type BlockExecutionProjection } from "./projection";

// Pure functions over a projection. Focus is the sum of running intervals,
// drift is wall clock minus budget, and fidelity is the conformance report:
// the run checked against the rules it was started with.

// Execution Metrics
export interface ExecutionMetrics {
  isFinal: boolean;
  hasStarted: boolean;
  plannedSec: number; // block budget
  plannedFocusSec: number; // sum of task plans
  focusSec: number;
  wallClockSec: number;
  pauseSec: number;
  observedPauseSec: number;
  inferredPauseSec: number;
  unaccountedSec: number;
  executionDriftSec: number | null; // wall clock - budget
  focusVarianceSec: number | null; // completed tasks: actual - planned
  totalTasks: number;
  completedTasks: number;
  skippedTasks: number;
  unfinishedTasks: number;
  completionRate: number; // count ratio, for comparison with fidelity
  fidelity: ConformanceReport | null; // null until the block starts
}

const secondsBetween = (from: string, to: string) =>
  Math.max(0, (Date.parse(to) - Date.parse(from)) / 1000);

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);

export const wallClockSec = (
  projection: BlockExecutionProjection,
  now: string,
): number => {
  if (!projection.startedAt) return 0;
  const end = projection.completedAt ?? projection.terminatedAt ?? now;
  return secondsBetween(projection.startedAt, end);
};

export const computeMetrics = (
  projection: BlockExecutionProjection,
  now: string,
): ExecutionMetrics => {
  const tasks = orderedTaskStates(projection);
  const hasStarted = projection.startedAt !== null;
  const completed = tasks.filter((t) => t.status === "completed");
  const skipped = tasks.filter((t) => t.status === "skipped");

  const focusSec = sum(tasks.map((t) => t.elapsedSec));
  const wall = wallClockSec(projection, now);
  const pauseSec = projection.pausedSec;

  return {
    isFinal:
      projection.status === "completed" || projection.status === "terminated",
    hasStarted,
    plannedSec: projection.plannedSec,
    plannedFocusSec: sum(tasks.map((t) => t.plannedSec)),
    focusSec,
    wallClockSec: wall,
    pauseSec,
    observedPauseSec: pauseSec - projection.inferredPausedSec,
    inferredPauseSec: projection.inferredPausedSec,
    unaccountedSec: Math.max(0, wall - focusSec - pauseSec),
    executionDriftSec: hasStarted ? wall - projection.plannedSec : null,
    focusVarianceSec: hasStarted
      ? sum(completed.map((t) => t.elapsedSec - t.plannedSec))
      : null,
    totalTasks: tasks.length,
    completedTasks: completed.length,
    skippedTasks: skipped.length,
    unfinishedTasks: tasks.length - completed.length - skipped.length,
    completionRate: tasks.length ? completed.length / tasks.length : 0,
    fidelity: hasStarted ? conformanceOf(projection) : null,
  };
};

export interface PortfolioMetrics {
  blocks: number;
  startedBlocks: number;
  finishedBlocks: number;
  liveBlocks: number;
  focusSec: number;
  pauseSec: number;
  plannedFocusSec: number;
  executionDriftSec: number; // finished blocks only
  averageFidelity: number | null; // finished blocks only
  verdicts: Record<Verdict, number>; // finished blocks only
  completedTasks: number;
  totalTasks: number;
}

// roll-up across blocks for the overview; drift and fidelity only count
// finished blocks so a block in progress cannot drag the average around
export const portfolioMetrics = (metrics: ExecutionMetrics[]): PortfolioMetrics => {
  const finished = metrics.filter((m) => m.isFinal);
  const reports = finished
    .map((m) => m.fidelity)
    .filter((f): f is ConformanceReport => f !== null);
  const verdicts: Record<Verdict, number> = {
    followed: 0,
    minor_deviations: 0,
    major_deviations: 0,
    not_followed: 0,
  };
  for (const report of reports) verdicts[report.verdict] += 1;
  return {
    blocks: metrics.length,
    startedBlocks: metrics.filter((m) => m.hasStarted).length,
    finishedBlocks: finished.length,
    liveBlocks: metrics.filter((m) => m.hasStarted && !m.isFinal).length,
    focusSec: sum(metrics.map((m) => m.focusSec)),
    pauseSec: sum(metrics.map((m) => m.pauseSec)),
    plannedFocusSec: sum(metrics.map((m) => m.plannedFocusSec)),
    executionDriftSec: sum(finished.map((m) => m.executionDriftSec ?? 0)),
    averageFidelity: reports.length
      ? sum(reports.map((r) => r.score)) / reports.length
      : null,
    verdicts,
    completedTasks: sum(metrics.map((m) => m.completedTasks)),
    totalTasks: sum(metrics.map((m) => m.totalTasks)),
  };
};
