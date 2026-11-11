import {
  orderedTaskStates,
  type BlockExecutionProjection,
  type TaskExecutionState,
} from "./projection";

// Pure functions over a projection. Focus is the sum of running intervals,
// drift is wall clock minus budget, and
// fidelity = completion x (0.5 + 0.5 x adherence).

export const FIDELITY_WEIGHTS = {
  timeAccuracy: 0.6,
  sequence: 0.4,
  // share of the completion score that adherence can take away
  maxDeviationPenalty: 0.5,
} as const;

export interface FidelityBreakdown {
  score: number; // 0-1
  completion: number; // planned-time weighted
  timeAccuracy: number;
  sequence: number;
  adherence: number;
}

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
  fidelity: FidelityBreakdown | null;
}

const secondsBetween = (from: string, to: string) =>
  Math.max(0, (Date.parse(to) - Date.parse(from)) / 1000);

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const wallClockSec = (
  projection: BlockExecutionProjection,
  now: string,
): number => {
  if (!projection.startedAt) return 0;
  const end = projection.completedAt ?? projection.terminatedAt ?? now;
  return secondsBetween(projection.startedAt, end);
};

export const completionScore = (tasks: TaskExecutionState[]): number => {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((t) => t.status === "completed");
  const plannedTotal = sum(tasks.map((t) => t.plannedSec));
  if (plannedTotal === 0) return completed.length / tasks.length;
  return sum(completed.map((t) => t.plannedSec)) / plannedTotal;
};

export const timeAccuracyScore = (tasks: TaskExecutionState[]): number => {
  const measurable = tasks.filter(
    (t) => t.status === "completed" && t.plannedSec > 0,
  );
  if (measurable.length === 0) return 1;
  const weighted = measurable.map(
    (t) =>
      clamp01(1 - Math.abs(t.elapsedSec - t.plannedSec) / t.plannedSec) *
      t.plannedSec,
  );
  return sum(weighted) / sum(measurable.map((t) => t.plannedSec));
};

export const sequenceScore = (projection: BlockExecutionProjection): number => {
  const startedTasks = orderedTaskStates(projection).filter(
    (t) => t.startedAt !== null,
  ).length;
  return clamp01(1 - projection.switchCount / Math.max(1, startedTasks));
};

export const fidelity = (
  projection: BlockExecutionProjection,
): FidelityBreakdown => {
  const tasks = orderedTaskStates(projection);
  const completion = completionScore(tasks);
  const timeAccuracy = timeAccuracyScore(tasks);
  const sequence = sequenceScore(projection);
  const adherence =
    FIDELITY_WEIGHTS.timeAccuracy * timeAccuracy +
    FIDELITY_WEIGHTS.sequence * sequence;
  const penalty = FIDELITY_WEIGHTS.maxDeviationPenalty;
  return {
    score: completion * (1 - penalty + penalty * adherence),
    completion,
    timeAccuracy,
    sequence,
    adherence,
  };
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
    fidelity: hasStarted ? fidelity(projection) : null,
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
  completedTasks: number;
  totalTasks: number;
}

// roll-up across blocks for the overview; drift and fidelity only count
// finished blocks so a block in progress cannot drag the average around
export const portfolioMetrics = (metrics: ExecutionMetrics[]): PortfolioMetrics => {
  const finished = metrics.filter((m) => m.isFinal);
  const fidelities = finished
    .map((m) => m.fidelity?.score)
    .filter((s): s is number => s !== undefined);
  return {
    blocks: metrics.length,
    startedBlocks: metrics.filter((m) => m.hasStarted).length,
    finishedBlocks: finished.length,
    liveBlocks: metrics.filter((m) => m.hasStarted && !m.isFinal).length,
    focusSec: sum(metrics.map((m) => m.focusSec)),
    pauseSec: sum(metrics.map((m) => m.pauseSec)),
    plannedFocusSec: sum(metrics.map((m) => m.plannedFocusSec)),
    executionDriftSec: sum(finished.map((m) => m.executionDriftSec ?? 0)),
    averageFidelity: fidelities.length ? sum(fidelities) / fidelities.length : null,
    completedTasks: sum(metrics.map((m) => m.completedTasks)),
    totalTasks: sum(metrics.map((m) => m.totalTasks)),
  };
};
