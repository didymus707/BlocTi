import type { TaskId } from "./ids";
import type { Procedure, ProcedureStep, Severity } from "./procedure";
import {
  orderedTaskStates,
  type BlockExecutionProjection,
} from "./projection";

// CONFORMANCE: did the run follow the procedure?
//
// The procedure is a list of rules and the projection is what happened. The
// checker compares the two and names every broken rule as a deviation. The
// score is a summary of that list, so every lost point traces back to one
// rule and one step.

// what breaking a rule costs; a convention, like audit grading
export const SEVERITY_POINTS: Record<Severity, number> = {
  minor: 1,
  major: 3,
  critical: 9,
};

interface DeviationBase {
  taskId: TaskId;
  title: string;
  severity: Severity;
  cost: number; // points lost
  at: string | null; // when it happened, to find it in the trace
}

// A required step was skipped, or was not completed when the block ended.
// It costs every point the step carried: a step that was not done was not
// done in order or on time either.
export interface MissedStep extends DeviationBase {
  kind: "missed_step";
  outcome: "skipped" | "not_done";
}

// a step was completed while an earlier required step was still open
export interface OutOfOrder extends DeviationBase {
  kind: "out_of_order";
  aheadOf: { taskId: TaskId; title: string };
}

// a completed step landed outside the tolerance band around its estimate
export interface OffEstimate extends DeviationBase {
  kind: "off_estimate";
  plannedSec: number;
  actualSec: number;
  size: number; // 0-1: how far outside the band
}

export type Deviation = MissedStep | OutOfOrder | OffEstimate;

export type DeviationKind = Deviation["kind"];

// decided by the worst deviation, not by the score
export type Verdict =
  | "followed"
  | "minor_deviations"
  | "major_deviations"
  | "not_followed";

export interface ConformanceReport {
  isFinal: boolean; // false = the block is still running; unfinished steps are not judged yet
  score: number; // 0-1
  verdict: Verdict;
  deviations: Deviation[]; // worst first, then in planned order
  ruleCount: number; // how many rules were in play
  pointsTotal: number; // what all of them are worth
  pointsLost: number;
}

const SEVERITY_RANK: Record<Severity, number> = { minor: 0, major: 1, critical: 2 };

const VERDICT_FOR: Record<Severity, Verdict> = {
  minor: "minor_deviations",
  major: "major_deviations",
  critical: "not_followed",
};

// read the frozen rules back out of a projection
export const procedureOf = (
  projection: BlockExecutionProjection,
): Procedure => ({
  ...projection.rules,
  steps: orderedTaskStates(projection).map((t) => ({
    taskId: t.taskId,
    title: t.title,
    plannedSec: t.plannedSec,
    required: t.required,
    severity: t.severity,
  })),
});

// Estimates are wrong by ratios (twice as long, half as long), so the
// distance is measured on a log scale: 0 inside the band, growing to 1 when
// the step took twice or half its estimate.
export const estimateDeviation = (
  plannedSec: number,
  actualSec: number,
  tolerance: number,
): number => {
  if (plannedSec <= 0) return 0; // no estimate, no rule
  if (actualSec <= 0) return 1;
  const off = Math.abs(Math.log2(actualSec / plannedSec));
  const band = Math.log2(1 + tolerance);
  // the small margin keeps a step that lands exactly on the edge on time
  if (off <= band + 1e-9) return 0;
  return Math.min(1, (off - band) / (1 - band));
};

// what each of a step's rules is worth
const rulePoints = (
  procedure: Procedure,
  step: ProcedureStep,
  index: number,
): number[] => {
  const points: number[] = [];
  // be completed
  if (step.required) points.push(SEVERITY_POINTS[step.severity]);
  // be finished in order; the first step has nothing to come after
  if (procedure.ordered && index > 0) points.push(SEVERITY_POINTS[step.severity]);
  // land near the estimate
  if (step.plannedSec > 0) points.push(SEVERITY_POINTS.minor);
  return points;
};

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

export const checkConformance = (
  procedure: Procedure,
  projection: BlockExecutionProjection,
): ConformanceReport => {
  const isFinal =
    projection.status === "completed" || projection.status === "terminated";
  const endedAt = projection.completedAt ?? projection.terminatedAt;
  const stateOf = (step: ProcedureStep) => projection.taskStates[step.taskId];
  const deviations: Deviation[] = [];
  let ruleCount = 0;
  let pointsTotal = 0;

  procedure.steps.forEach((step, index) => {
    const state = stateOf(step);
    const status = state?.status ?? "pending";
    const completed = status === "completed" && state !== undefined;
    // an optional step is only in play once it has been done
    if (!step.required && !completed) return;

    const worth = rulePoints(procedure, step, index);
    ruleCount += worth.length;
    pointsTotal += sum(worth);
    const base = { taskId: step.taskId, title: step.title };

    // RULE 1: required steps must be completed. A skip is final, so it
    // counts at once; anything else is only judged when the block has ended.
    if (!completed) {
      if (status === "skipped" || isFinal) {
        deviations.push({
          ...base,
          kind: "missed_step",
          outcome: status === "skipped" ? "skipped" : "not_done",
          severity: step.severity,
          cost: sum(worth),
          at: status === "skipped" ? (state?.finishedAt ?? null) : endedAt,
        });
      }
      return;
    }

    // RULE 2: steps must be finished in planned order. A step breaks it
    // when it is completed while an earlier required step is still open
    // (neither completed nor skipped at that moment). The moment decides,
    // so nothing that happens later can add or remove this deviation.
    // Switching between tasks breaks nothing, and a step skipped first is
    // rule 1's business only. Two steps closed in the same instant count
    // as in order.
    if (procedure.ordered) {
      const finishedAt = Date.parse(state.finishedAt ?? "");
      const overtaken = procedure.steps.slice(0, index).find((earlier) => {
        if (!earlier.required) return false;
        const closedAt = stateOf(earlier)?.finishedAt;
        return !closedAt || Date.parse(closedAt) > finishedAt;
      });
      if (overtaken) {
        deviations.push({
          ...base,
          kind: "out_of_order",
          aheadOf: { taskId: overtaken.taskId, title: overtaken.title },
          severity: step.severity,
          cost: SEVERITY_POINTS[step.severity],
          at: state.finishedAt,
        });
      }
    }

    // RULE 3: a completed step should land near its estimate
    const size = estimateDeviation(
      step.plannedSec,
      state.elapsedSec,
      procedure.timeTolerance,
    );
    if (size > 0) {
      deviations.push({
        ...base,
        kind: "off_estimate",
        plannedSec: step.plannedSec,
        actualSec: state.elapsedSec,
        size,
        severity: "minor",
        cost: size * SEVERITY_POINTS.minor,
        at: state.finishedAt,
      });
    }
  });

  // worst first; sort is stable, so equals stay in planned order
  deviations.sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );

  const pointsLost = sum(deviations.map((d) => d.cost));
  const worst = deviations[0]?.severity;

  return {
    isFinal,
    score: pointsTotal > 0 ? Math.max(0, 1 - pointsLost / pointsTotal) : 1,
    verdict: worst ? VERDICT_FOR[worst] : "followed",
    deviations,
    ruleCount,
    pointsTotal,
    pointsLost,
  };
};

// the usual case: check a run against the rules it was started with
export const conformanceOf = (
  projection: BlockExecutionProjection,
): ConformanceReport => checkConformance(procedureOf(projection), projection);
