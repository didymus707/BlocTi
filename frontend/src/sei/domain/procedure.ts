import type { TaskId } from "./ids";

// A procedure is the plan read as a set of rules: which steps must happen,
// how much each one matters, whether order is enforced, and how close to the
// estimate still counts as on time. A plain timed block is the simplest
// procedure: every task required, order free.

// how much breaking a rule matters; set by whoever writes the plan
export type Severity = "minor" | "major" | "critical";

export const SEVERITIES: readonly Severity[] = ["minor", "major", "critical"];

// what a task says about itself as a step
export interface StepRules {
  required: boolean; // must be completed
  severity: Severity;
}

// what a plan says about the block as a whole
export interface PlanRules {
  ordered: boolean; // steps must be finished in planned order
  timeTolerance: number; // 0.15 = within 15% of the estimate counts as on time
}

export const DEFAULT_STEP_RULES: StepRules = { required: true, severity: "major" };

export const DEFAULT_PLAN_RULES: PlanRules = { ordered: false, timeTolerance: 0.15 };

// the band has to stay narrower than "twice the estimate", where a time
// deviation reaches its full size
export const MAX_TIME_TOLERANCE = 0.5;

export interface ProcedureStep extends StepRules {
  taskId: TaskId;
  title: string;
  plannedSec: number; // 0 = no estimate, so no time rule
}

export interface Procedure extends PlanRules {
  steps: ProcedureStep[]; // in planned order
}

const isSeverity = (value: unknown): value is Severity =>
  SEVERITIES.includes(value as Severity);

// Rules arrive from storage and from other clients, so missing or malformed
// values fall back to the defaults instead of breaking a replay.
export const stepRulesOf = (source: Partial<StepRules> | undefined): StepRules => ({
  required:
    typeof source?.required === "boolean" ? source.required : DEFAULT_STEP_RULES.required,
  severity: isSeverity(source?.severity) ? source.severity : DEFAULT_STEP_RULES.severity,
});

// IMPORTANCE: the two step rules as one choice, the way a person would say
// it. The form offers these four; the two rules underneath allow two more
// (an optional step that is major or critical when finished out of order),
// which read back as "optional".
export type Importance = "critical" | "required" | "minor" | "optional";

export const IMPORTANCES: readonly Importance[] = ["critical", "required", "minor", "optional"];

export const DEFAULT_IMPORTANCE: Importance = "required";

export const RULES_FOR: Record<Importance, StepRules> = {
  critical: { required: true, severity: "critical" },
  required: { required: true, severity: "major" },
  minor: { required: true, severity: "minor" },
  // an optional step costs nothing when left out; its severity only prices
  // finishing it out of order
  optional: { required: false, severity: "minor" },
};

export const importanceOf = (source: Partial<StepRules> | undefined): Importance => {
  const { required, severity } = stepRulesOf(source);
  if (!required) return "optional";
  if (severity === "critical") return "critical";
  return severity === "minor" ? "minor" : "required";
};

export const planRulesOf = (source: Partial<PlanRules> | undefined): PlanRules => {
  const tolerance = source?.timeTolerance;
  return {
    ordered: typeof source?.ordered === "boolean" ? source.ordered : DEFAULT_PLAN_RULES.ordered,
    timeTolerance:
      typeof tolerance === "number" && Number.isFinite(tolerance)
        ? Math.min(MAX_TIME_TOLERANCE, Math.max(0, tolerance))
        : DEFAULT_PLAN_RULES.timeTolerance,
  };
};
