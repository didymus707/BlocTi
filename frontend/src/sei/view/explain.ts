import {
  SEVERITY_POINTS,
  type ConformanceReport,
  type Deviation,
  type DeviationKind,
  type Verdict,
} from "../domain/conformance";
import type { ExecutionMetrics } from "../domain/metrics";
import {
  SEVERITIES,
  type Importance,
  type Procedure,
  type Severity,
} from "../domain/procedure";
import { formatDuration, formatSignedDuration, plural } from "../../utils";

// Plain-language readings of the metrics, shown next to the numbers.

export const VERDICT_LABEL: Record<Verdict, string> = {
  followed: "Followed",
  minor_deviations: "Minor deviations",
  major_deviations: "Major deviations",
  not_followed: "Not followed",
};

export const VERDICT_NOTE: Record<Verdict, string> = {
  followed: "Every rule in the plan held.",
  minor_deviations: "Nothing worse than a minor rule was broken.",
  major_deviations: "At least one major rule was broken.",
  not_followed: "A critical rule was broken, so the plan was not followed, whatever the score.",
};

export const DEVIATION_LABEL: Record<DeviationKind, string> = {
  missed_step: "Missed step",
  out_of_order: "Out of order",
  off_estimate: "Off estimate",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  minor: "Minor",
  major: "Major",
  critical: "Critical",
};

export const IMPORTANCE_LABEL: Record<Importance, string> = {
  critical: "Critical",
  required: "Required",
  minor: "Minor",
  optional: "Optional",
};

// what leaving the task undone does to the verdict
export const IMPORTANCE_NOTE: Record<Importance, string> = {
  critical: "Missing it means the plan was not followed.",
  required: "Missing it is a major deviation.",
  minor: "Missing it is a minor deviation.",
  optional: "Costs nothing when left out.",
};

// 3 -> "3", 0.48 -> "0.5", 0.02 -> "<0.1"
export const formatPoints = (points: number): string => {
  const rounded = Math.round(points * 10) / 10;
  return rounded === 0 && points > 0 ? "<0.1" : String(rounded);
};

export const describeDeviation = (deviation: Deviation): string => {
  switch (deviation.kind) {
    case "missed_step":
      return deviation.outcome === "skipped"
        ? `${deviation.title} was skipped.`
        : `${deviation.title} was not finished when the block ended.`;
    case "out_of_order":
      return `${deviation.title} was finished while ${deviation.aheadOf.title} was still open.`;
    case "off_estimate": {
      const { plannedSec, actualSec } = deviation;
      const percent = Math.round((Math.abs(actualSec - plannedSec) / plannedSec) * 100);
      const direction = actualSec > plannedSec ? "over" : "under";
      return `${deviation.title} took ${formatDuration(actualSec)}, ${percent}% ${direction} its ${formatDuration(plannedSec)} estimate.`;
    }
  }
};

// where the score comes from, in one line
export const pointsSummary = (report: ConformanceReport): string => {
  const rules = plural(report.ruleCount, "rule");
  if (report.pointsTotal === 0) return "This plan has no rules to check.";
  if (report.pointsLost === 0) {
    return `All ${formatPoints(report.pointsTotal)} points kept across ${rules}.`;
  }
  const kept = report.pointsTotal - report.pointsLost;
  return `Kept ${formatPoints(kept)} of ${formatPoints(report.pointsTotal)} points across ${rules}.`;
};

// what the run was checked against
export const procedureSummary = (procedure: Procedure): string => {
  const required = procedure.steps.filter((s) => s.required).length;
  const optional = procedure.steps.length - required;
  const critical = procedure.steps.filter((s) => s.required && s.severity === "critical").length;
  return [
    plural(required, "required step"),
    critical > 0 && `${critical} critical`,
    optional > 0 && `${optional} optional`,
    procedure.ordered ? "order enforced" : "any order",
    `on time within ${Math.round(procedure.timeTolerance * 100)}%`,
  ]
    .filter(Boolean)
    .join(" · ");
};

// what breaking a rule costs: "minor 1 · major 3 · critical 9"
export const POINTS_KEY = SEVERITIES.map(
  (severity) => `${severity} ${SEVERITY_POINTS[severity]}`,
).join(" · ");

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
