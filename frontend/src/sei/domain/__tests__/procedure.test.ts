import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMPORTANCE,
  DEFAULT_PLAN_RULES,
  DEFAULT_STEP_RULES,
  IMPORTANCES,
  MAX_TIME_TOLERANCE,
  RULES_FOR,
  importanceOf,
  planRulesOf,
  stepRulesOf,
} from "../procedure";

describe("stepRulesOf", () => {
  it("defaults to a required, major step", () => {
    expect(stepRulesOf(undefined)).toEqual({ required: true, severity: "major" });
    expect(stepRulesOf({})).toEqual(DEFAULT_STEP_RULES);
  });

  it("keeps the values a plan sets", () => {
    expect(stepRulesOf({ required: false, severity: "minor" })).toEqual({
      required: false,
      severity: "minor",
    });
    expect(stepRulesOf({ severity: "critical" })).toEqual({
      required: true,
      severity: "critical",
    });
  });

  it("returns only the rule fields, whatever else the source carries", () => {
    const task = { id: "t", name: "Read", required: false, severity: "minor" as const };
    expect(stepRulesOf(task)).toEqual({ required: false, severity: "minor" });
  });

  it("falls back to the defaults for malformed values", () => {
    const malformed = { required: "yes", severity: "urgent" } as unknown as Parameters<
      typeof stepRulesOf
    >[0];
    expect(stepRulesOf(malformed)).toEqual(DEFAULT_STEP_RULES);
  });
});

describe("importance", () => {
  it("stands for a pair of step rules and reads back from them", () => {
    for (const importance of IMPORTANCES) {
      expect(importanceOf(RULES_FOR[importance])).toBe(importance);
    }
  });

  it("is 'required' for a task that says nothing, matching the default rules", () => {
    expect(importanceOf(undefined)).toBe(DEFAULT_IMPORTANCE);
    expect(RULES_FOR[DEFAULT_IMPORTANCE]).toEqual(DEFAULT_STEP_RULES);
  });

  it("reads any step that need not be done as optional, whatever its severity", () => {
    expect(importanceOf({ required: false, severity: "critical" })).toBe("optional");
  });
});

describe("planRulesOf", () => {
  it("defaults to free order and a 15% time band", () => {
    expect(planRulesOf(undefined)).toEqual({ ordered: false, timeTolerance: 0.15 });
    expect(planRulesOf({})).toEqual(DEFAULT_PLAN_RULES);
  });

  it("keeps the values a plan sets", () => {
    expect(planRulesOf({ ordered: true, timeTolerance: 0.25 })).toEqual({
      ordered: true,
      timeTolerance: 0.25,
    });
  });

  it("clamps the tolerance to 0..50%", () => {
    expect(planRulesOf({ timeTolerance: -1 }).timeTolerance).toBe(0);
    expect(planRulesOf({ timeTolerance: 3 }).timeTolerance).toBe(MAX_TIME_TOLERANCE);
  });

  it("falls back to the defaults for malformed values", () => {
    const malformed = { ordered: 1, timeTolerance: Number.NaN } as unknown as Parameters<
      typeof planRulesOf
    >[0];
    expect(planRulesOf(malformed)).toEqual(DEFAULT_PLAN_RULES);
  });
});
