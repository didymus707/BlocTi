import { describe, expect, it } from "vitest";
import {
  checkConformance,
  conformanceOf,
  estimateDeviation,
  procedureOf,
  SEVERITY_POINTS,
} from "../conformance";
import type { TaskSnapshot } from "../events";
import type { TaskId } from "../ids";
import type { PlanRules, Severity } from "../procedure";
import { projectBlock } from "../projection";
import { PLAN, PLAN_TASKS, T1, T2, T3, T4, at, ev, sequence } from "./builders";

const MIN = 60;
const FREE: PlanRules = { ordered: false, timeTolerance: 0.15 };
const ORDERED: PlanRules = { ordered: true, timeTolerance: 0.15 };

// A, B and C at 20 minutes each: required and major unless a test says otherwise
const step = (
  taskId: TaskId,
  title: string,
  rules: { required?: boolean; severity?: Severity; minutes?: number } = {},
): TaskSnapshot => ({
  taskId,
  title,
  plannedDuration: (rules.minutes ?? 20) * MIN,
  required: rules.required ?? true,
  severity: rules.severity ?? "major",
});
const A = step(T1, "A");
const B = step(T2, "B");
const C = step(T3, "C");

type Events = Parameters<typeof sequence>;

// a task worked from one minute to another, start to finish
const done = (taskId: TaskId, fromMin: number, toMin: number): Events => [
  ev.taskStarted(taskId, fromMin * MIN),
  ev.taskCompleted(taskId, toMin * MIN),
];

const run = (
  steps: TaskSnapshot[],
  rules: PlanRules,
  events: Events,
  nowMin = 120,
) =>
  projectBlock(
    PLAN,
    PLAN_TASKS,
    sequence(ev.planned(0, steps, { rules }), ev.blockStarted(0), ...events),
    at(nowMin * MIN),
  );

const check = (...args: Parameters<typeof run>) => conformanceOf(run(...args));

// every step on its estimate, in planned order, block completed
const BY_THE_BOOK: Events = [
  ...done(T1, 0, 20),
  ...done(T2, 20, 40),
  ...done(T3, 40, 60),
  ev.blockCompleted(60 * MIN),
];

describe("estimateDeviation", () => {
  it("is 0 when there is no estimate to compare against", () => {
    expect(estimateDeviation(0, 500, 0.15)).toBe(0);
  });

  it("is 0 inside the tolerance band, on both sides", () => {
    expect(estimateDeviation(600, 600, 0.15)).toBe(0);
    expect(estimateDeviation(600, 690, 0.15)).toBe(0); // exactly 15% over
    expect(estimateDeviation(600, 522, 0.15)).toBe(0); // 1 / 1.15 = 0.87
  });

  it("grows from 0 at the edge of the band to 1 at twice the estimate", () => {
    expect(estimateDeviation(600, 700, 0.15)).toBeCloseTo(0.026, 2);
    expect(estimateDeviation(600, 900, 0.15)).toBeCloseTo(0.48, 2);
    expect(estimateDeviation(600, 1200, 0.15)).toBe(1);
  });

  it("is capped at 1 however far off the step was", () => {
    expect(estimateDeviation(600, 6000, 0.15)).toBe(1);
    expect(estimateDeviation(600, 0, 0.15)).toBe(1);
  });

  it("treats too fast like too slow: half the time is as far off as double", () => {
    expect(estimateDeviation(600, 300, 0.15)).toBe(1);
    expect(estimateDeviation(600, 400, 0.15)).toBeCloseTo(estimateDeviation(600, 900, 0.15), 10);
  });

  it("forgives more with a wider band and nothing with none", () => {
    expect(estimateDeviation(600, 720, 0.25)).toBe(0);
    expect(estimateDeviation(600, 720, 0.15)).toBeGreaterThan(0);
    expect(estimateDeviation(600, 601, 0)).toBeGreaterThan(0);
  });
});

describe("procedureOf", () => {
  it("reads the frozen rules and the steps in planned order", () => {
    const steps = [A, step(T2, "B", { required: false, severity: "minor", minutes: 0 }), C];
    expect(procedureOf(run(steps, ORDERED, []))).toEqual({
      ordered: true,
      timeTolerance: 0.15,
      steps: [
        { taskId: T1, title: "A", plannedSec: 1200, required: true, severity: "major" },
        { taskId: T2, title: "B", plannedSec: 0, required: false, severity: "minor" },
        { taskId: T3, title: "C", plannedSec: 1200, required: true, severity: "major" },
      ],
    });
  });
});

describe("checkConformance", () => {
  describe("a run that follows the procedure", () => {
    it("is followed, at 100%, with nothing to list", () => {
      expect(check([A, B, C], ORDERED, BY_THE_BOOK)).toMatchObject({
        isFinal: true,
        score: 1,
        verdict: "followed",
        deviations: [],
        pointsLost: 0,
      });
    });

    it("counts every rule the procedure contains", () => {
      // free order: 3 required steps (3 pts each) + 3 estimates (1 pt each)
      expect(check([A, B, C], FREE, BY_THE_BOOK)).toMatchObject({ ruleCount: 6, pointsTotal: 12 });
      // ordered: plus one order rule for every step after the first
      expect(check([A, B, C], ORDERED, BY_THE_BOOK)).toMatchObject({ ruleCount: 8, pointsTotal: 18 });
    });

    it("scores 100% when the procedure has no rules at all", () => {
      const loose = [A, B].map((s) => ({ ...s, required: false, plannedDuration: 0 }));
      expect(check(loose, FREE, [ev.blockCompleted(60)])).toMatchObject({
        score: 1,
        verdict: "followed",
        ruleCount: 0,
        pointsTotal: 0,
      });
    });
  });

  describe("rule 1: required steps must be completed", () => {
    it("counts a skipped step at once, even while the block is live", () => {
      const report = check([A, B, C], FREE, [...done(T1, 0, 20), ev.taskSkipped(T2, 21 * MIN)], 25);
      expect(report.isFinal).toBe(false);
      expect(report.deviations).toEqual([
        {
          kind: "missed_step",
          outcome: "skipped",
          taskId: T2,
          title: "B",
          severity: "major",
          cost: 4, // 3 for not doing it + 1 for the estimate it could not meet
          at: at(21 * MIN),
        },
      ]);
    });

    it("does not judge unfinished steps while the block is live", () => {
      const report = check([A, B, C], FREE, done(T1, 0, 20), 25);
      expect(report).toMatchObject({ isFinal: false, deviations: [], score: 1, verdict: "followed" });
    });

    it("counts every unfinished required step once the block has ended", () => {
      const report = check([A, B, C], FREE, [...done(T1, 0, 20), ev.blockCompleted(30 * MIN)]);
      expect(report.deviations).toMatchObject([
        { kind: "missed_step", outcome: "not_done", taskId: T2, at: at(30 * MIN) },
        { kind: "missed_step", outcome: "not_done", taskId: T3, at: at(30 * MIN) },
      ]);
      expect(report.pointsLost).toBe(8);
      expect(report.score).toBeCloseTo(4 / 12, 10);
    });

    it("judges a terminated session the same way", () => {
      const report = check([A, B], FREE, [...done(T1, 0, 20), ev.terminated(25 * MIN)]);
      expect(report.isFinal).toBe(true);
      expect(report.deviations).toMatchObject([
        { kind: "missed_step", outcome: "not_done", taskId: T2, cost: 4, at: at(25 * MIN) },
      ]);
    });

    it("a step started but never finished is still missed", () => {
      const report = check([A, B], FREE, [
        ...done(T1, 0, 20),
        ev.taskStarted(T2, 20 * MIN),
        ev.blockCompleted(30 * MIN),
      ]);
      expect(report.deviations).toMatchObject([{ kind: "missed_step", outcome: "not_done", taskId: T2 }]);
    });

    it("lets an optional step be skipped or left undone", () => {
      const steps = [A, step(T2, "B", { required: false }), step(T3, "C", { required: false })];
      const report = check(steps, FREE, [
        ...done(T1, 0, 20),
        ev.taskSkipped(T2, 20 * MIN),
        ev.blockCompleted(20 * MIN),
      ]);
      // only A was in play: 3 for doing it + 1 for its estimate
      expect(report).toMatchObject({ deviations: [], score: 1, verdict: "followed", pointsTotal: 4 });
    });

    it("checks an optional step like any other once it has been done", () => {
      const steps = [A, step(T2, "B", { required: false })];
      const report = check(steps, ORDERED, [
        ...done(T2, 0, 40), // optional, but done first and in twice the time
        ...done(T1, 40, 60),
        ev.blockCompleted(60 * MIN),
      ]);
      expect(report.deviations.map((d) => [d.kind, d.title])).toEqual([
        ["out_of_order", "B"],
        ["off_estimate", "B"],
      ]);
      expect(report.pointsTotal).toBe(4 + 3 + 1);
    });

    it("charges by severity: minor 1, major 3, critical 9", () => {
      const steps = [
        step(T1, "A", { severity: "minor", minutes: 0 }),
        step(T2, "B", { severity: "major", minutes: 0 }),
        step(T3, "C", { severity: "critical", minutes: 0 }),
      ];
      const report = check(steps, FREE, [ev.blockCompleted(60)]);
      expect(report.deviations.map((d) => [d.title, d.cost])).toEqual([
        ["C", SEVERITY_POINTS.critical],
        ["B", SEVERITY_POINTS.major],
        ["A", SEVERITY_POINTS.minor],
      ]);
      expect(report.pointsLost).toBe(13);
    });

    it("takes every point the step carried: done, in order and on time", () => {
      const report = check([A, B, C], ORDERED, [
        ...done(T1, 0, 20),
        ev.taskSkipped(T2, 20 * MIN),
        ...done(T3, 20, 40),
        ev.blockCompleted(40 * MIN),
      ]);
      expect(report.deviations).toMatchObject([{ kind: "missed_step", taskId: T2, cost: 3 + 3 + 1 }]);
    });
  });

  describe("rule 2: steps must be finished in order", () => {
    // C is finished before B
    const C_BEFORE_B: Events = [
      ...done(T1, 0, 20),
      ...done(T3, 20, 40),
      ...done(T2, 40, 60),
      ev.blockCompleted(60 * MIN),
    ];

    it("flags the step that was finished early, and names the step it passed", () => {
      const report = check([A, B, C], ORDERED, C_BEFORE_B);
      expect(report.deviations).toEqual([
        {
          kind: "out_of_order",
          taskId: T3,
          title: "C",
          aheadOf: { taskId: T2, title: "B" },
          severity: "major",
          cost: 3,
          at: at(40 * MIN),
        },
      ]);
      expect(report.verdict).toBe("major_deviations");
      expect(report.score).toBeCloseTo(15 / 18, 10);
    });

    it("is not checked when the plan leaves order free", () => {
      expect(check([A, B, C], FREE, C_BEFORE_B)).toMatchObject({ deviations: [], verdict: "followed" });
    });

    it("flags every step finished while an earlier one was open", () => {
      // B and C are both done before A
      const report = check([A, B, C], ORDERED, [
        ...done(T2, 0, 20),
        ...done(T3, 20, 40),
        ...done(T1, 40, 60),
        ev.blockCompleted(60 * MIN),
      ]);
      expect(report.deviations).toMatchObject([
        { kind: "out_of_order", taskId: T2, aheadOf: { taskId: T1 } },
        { kind: "out_of_order", taskId: T3, aheadOf: { taskId: T1 } },
      ]);
    });

    it("does not treat switching between tasks as breaking the order", () => {
      const report = check([A, B, C], ORDERED, [
        ev.taskStarted(T1, 0),
        ev.taskSwitched(T1, T2, 5 * MIN),
        ev.taskSwitched(T2, T1, 10 * MIN),
        ev.taskCompleted(T1, 25 * MIN), // 5 + 15 minutes of A
        ev.taskStarted(T2, 25 * MIN),
        ev.taskCompleted(T2, 40 * MIN), // 5 + 15 minutes of B
        ...done(T3, 40, 60),
        ev.blockCompleted(60 * MIN),
      ]);
      expect(report).toMatchObject({ deviations: [], verdict: "followed", score: 1 });
    });

    it("a step skipped first is closed, so moving on is in order", () => {
      const report = check([A, B, C], ORDERED, [
        ev.taskSkipped(T1, 0),
        ...done(T2, 0, 20),
        ...done(T3, 20, 40),
        ev.blockCompleted(40 * MIN),
      ]);
      // the skip is rule 1's business; it is not counted a second time here
      expect(report.deviations).toMatchObject([{ kind: "missed_step", taskId: T1 }]);
    });

    it("moving past an open step and skipping it afterwards is two deviations", () => {
      const report = check([A, B, C], ORDERED, [
        ...done(T1, 0, 20),
        ...done(T3, 20, 40), // B is still open here
        ev.taskSkipped(T2, 41 * MIN),
        ev.blockCompleted(41 * MIN),
      ]);
      expect(report.deviations.map((d) => [d.kind, d.title])).toEqual([
        ["missed_step", "B"],
        ["out_of_order", "C"],
      ]);
    });

    it("shows up the moment it happens, while the block is still live", () => {
      const report = check([A, B, C], ORDERED, done(T2, 0, 20), 25);
      expect(report.isFinal).toBe(false);
      expect(report.deviations).toMatchObject([
        { kind: "out_of_order", taskId: T2, aheadOf: { taskId: T1 }, at: at(20 * MIN) },
      ]);
    });

    it("does not wait for an optional step", () => {
      const steps = [A, step(T2, "B", { required: false }), C];
      const report = check(steps, ORDERED, [
        ...done(T1, 0, 20),
        ...done(T3, 20, 40), // optional B is open, and that is fine
        ...done(T2, 40, 60),
        ev.blockCompleted(60 * MIN),
      ]);
      expect(report.deviations).toEqual([]);
    });

    it("charges the severity of the step that jumped", () => {
      const steps = [A, B, step(T3, "C", { severity: "critical" })];
      const report = check(steps, ORDERED, C_BEFORE_B);
      expect(report.deviations).toMatchObject([{ kind: "out_of_order", taskId: T3, cost: 9 }]);
      expect(report.verdict).toBe("not_followed");
    });
  });

  describe("rule 3: completed steps should land near their estimate", () => {
    it("flags a step outside the band, with its planned and actual time", () => {
      const report = check([A, B, C], FREE, [
        ...done(T1, 0, 20),
        ...done(T2, 20, 50), // 30 minutes against 20
        ...done(T3, 50, 70),
        ev.blockCompleted(70 * MIN),
      ]);
      expect(report.deviations).toHaveLength(1);
      expect(report.deviations[0]).toMatchObject({
        kind: "off_estimate",
        taskId: T2,
        plannedSec: 1200,
        actualSec: 1800,
        severity: "minor",
        at: at(50 * MIN),
      });
      expect(report.deviations[0].cost).toBeCloseTo(0.48, 2);
      expect(report.verdict).toBe("minor_deviations");
    });

    it("measures focus time, so a pause does not count against the estimate", () => {
      const report = check([A], FREE, [
        ev.taskStarted(T1, 0),
        ev.taskPaused(T1, 10 * MIN),
        ev.taskResumed(T1, 40 * MIN),
        ev.taskCompleted(T1, 50 * MIN), // 20 minutes of focus in 50 on the clock
        ev.blockCompleted(50 * MIN),
      ]);
      expect(report.deviations).toEqual([]);
    });

    it("has no time rule for a step without an estimate", () => {
      const report = check([step(T1, "A", { minutes: 0 })], FREE, [
        ...done(T1, 0, 45),
        ev.blockCompleted(45 * MIN),
      ]);
      expect(report).toMatchObject({ deviations: [], ruleCount: 1, pointsTotal: 3 });
    });

    it("uses the plan's own tolerance", () => {
      const events: Events = [...done(T1, 0, 24), ev.blockCompleted(24 * MIN)]; // 20% over
      expect(check([A], FREE, events).deviations).toHaveLength(1);
      expect(check([A], { ordered: false, timeTolerance: 0.25 }, events).deviations).toEqual([]);
    });

    it("never costs more than one point, whatever the step's severity", () => {
      const report = check([step(T1, "A", { severity: "critical" })], FREE, [
        ...done(T1, 0, 90),
        ev.blockCompleted(90 * MIN),
      ]);
      expect(report.deviations).toMatchObject([{ kind: "off_estimate", severity: "minor", cost: 1 }]);
      expect(report.verdict).toBe("minor_deviations");
    });
  });

  describe("score and verdict", () => {
    it("works the example in the spec: 18 points, 7.48 lost, 58%", () => {
      const report = check([A, B, C], ORDERED, [
        ...done(T1, 0, 20),
        ...done(T2, 20, 50),
        ev.taskSkipped(T3, 50 * MIN),
        ev.blockCompleted(50 * MIN),
      ]);
      expect(report.pointsTotal).toBe(18);
      expect(report.pointsLost).toBeCloseTo(7.48, 2);
      expect(report.score).toBeCloseTo(0.584, 3);
      expect(report.verdict).toBe("major_deviations");
      // worst first
      expect(report.deviations.map((d) => d.kind)).toEqual(["missed_step", "off_estimate"]);
    });

    it("takes the verdict from the worst deviation, not from the score", () => {
      // nine steps done and one critical step skipped
      const steps = [
        ...Array.from({ length: 9 }, (_, i) =>
          step(`step-${i}` as TaskId, `Step ${i}`, { severity: "critical", minutes: 0 }),
        ),
        step(T4, "Safety check", { severity: "critical", minutes: 0 }),
      ];
      const events: Events = [
        ...steps.slice(0, 9).flatMap((s, i) => done(s.taskId, i, i + 1)),
        ev.taskSkipped(T4, 9 * MIN),
        ev.blockCompleted(9 * MIN),
      ];
      const report = check(steps, FREE, events);
      expect(report.score).toBeCloseTo(0.9, 10);
      expect(report.verdict).toBe("not_followed");
    });

    it("scores 0% when the block ends with nothing done", () => {
      const report = check([A, B, C], ORDERED, [ev.blockCompleted(60 * MIN)]);
      expect(report).toMatchObject({ pointsTotal: 18, pointsLost: 18, score: 0 });
    });

    it("adds up several kinds of deviation in one run", () => {
      // C first and far too long, then B far too long, A never done
      const report = check([A, B, C], ORDERED, [
        ...done(T3, 0, 60),
        ...done(T2, 60, 120),
        ev.blockCompleted(120 * MIN),
      ]);
      // worst first, then in planned order
      expect(report.deviations.map((d) => [d.kind, d.title, d.cost])).toEqual([
        ["missed_step", "A", 4],
        ["out_of_order", "B", 3],
        ["out_of_order", "C", 3],
        ["off_estimate", "B", 1],
        ["off_estimate", "C", 1],
      ]);
      expect(report.score).toBeCloseTo(6 / 18, 10);
    });

    it.each(["minor", "major", "critical"] as const)(
      "never scores a %s step done badly below the same step skipped",
      (severity) => {
        const steps = [A, step(T2, "B", { severity }), C];
        const doneBadly = check(steps, ORDERED, [
          ...done(T1, 0, 20),
          ...done(T3, 20, 40),
          ...done(T2, 40, 100), // out of order and three times the estimate
          ev.blockCompleted(100 * MIN),
        ]);
        const skipped = check(steps, ORDERED, [
          ...done(T1, 0, 20),
          ...done(T3, 20, 40),
          ev.taskSkipped(T2, 41 * MIN),
          ev.blockCompleted(41 * MIN),
        ]);
        expect(doneBadly.score).toBeGreaterThan(skipped.score);
      },
    );

    it("is judged by the rules the block started with, not a later replan", () => {
      const p = projectBlock(
        PLAN,
        PLAN_TASKS,
        sequence(
          ev.planned(0, [A, B, C], { rules: FREE }),
          ev.blockStarted(0),
          ...done(T1, 0, 20),
          ev.planned(20 * MIN, [A, B, C], { rules: ORDERED }),
          ...done(T3, 20, 40),
          ...done(T2, 40, 60),
          ev.blockCompleted(60 * MIN),
        ),
        at(60 * MIN),
      );
      expect(conformanceOf(p)).toMatchObject({ deviations: [], pointsTotal: 12 });
    });
  });

  describe("checking a run against a procedure it did not start with", () => {
    it("treats a step the run never saw as not done", () => {
      const projection = run([A, B], FREE, [
        ...done(T1, 0, 20),
        ...done(T2, 20, 40),
        ev.blockCompleted(40 * MIN),
      ]);
      const stricter = {
        ...procedureOf(projection),
        steps: [
          ...procedureOf(projection).steps,
          { taskId: T4, title: "Sign off", plannedSec: 0, required: true, severity: "critical" as const },
        ],
      };
      expect(checkConformance(stricter, projection)).toMatchObject({
        verdict: "not_followed",
        deviations: [{ kind: "missed_step", outcome: "not_done", taskId: T4, cost: 9 }],
      });
    });
  });
});
