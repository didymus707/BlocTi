import { describe, expect, it } from "vitest";
import { conformanceOf } from "../conformance";
import { computeMetrics, portfolioMetrics } from "../metrics";
import { projectBlock } from "../projection";
import {
  PLAN,
  PLAN_TASKS,
  T1,
  T2,
  T3,
  at,
  deepFreeze,
  ev,
  sequence,
  started,
} from "./builders";
import type { SeiEvent } from "../events";

const metricsAt = (events: SeiEvent[], nowSec: number) => {
  const projection = projectBlock(PLAN, PLAN_TASKS, events, at(nowSec));
  return computeMetrics(projection, at(nowSec));
};

// T1 600s, T2 300s, T3 900s, budget 1800s
const finishedInPlan = () =>
  sequence(
    ...started(0),
    ev.taskCompleted(T1, 600),
    ev.taskStarted(T2, 600),
    ev.taskCompleted(T2, 900),
    ev.taskStarted(T3, 900),
    ev.taskCompleted(T3, 1800),
    ev.blockCompleted(1800),
  );

describe("computeMetrics", () => {
  it("returns nulls for drift and fidelity before the block starts", () => {
    const m = metricsAt([], 100);
    expect(m).toMatchObject({
      hasStarted: false,
      isFinal: false,
      wallClockSec: 0,
      focusSec: 0,
      executionDriftSec: null,
      focusVarianceSec: null,
      fidelity: null,
      totalTasks: 3,
      plannedFocusSec: 1800,
    });
  });

  it("scores a block executed exactly to plan as perfect", () => {
    const m = metricsAt(finishedInPlan(), 5000);
    expect(m.isFinal).toBe(true);
    expect(m.focusSec).toBe(1800);
    expect(m.wallClockSec).toBe(1800);
    expect(m.executionDriftSec).toBe(0);
    expect(m.focusVarianceSec).toBe(0);
    expect(m.unaccountedSec).toBe(0);
    expect(m.completionRate).toBe(1);
    expect(m.fidelity).toMatchObject({
      isFinal: true,
      score: 1,
      verdict: "followed",
      deviations: [],
    });
  });

  it("reports live values so far while the block runs", () => {
    const m = metricsAt(sequence(...started(0), ev.taskPaused(T1, 100)), 400);
    expect(m.isFinal).toBe(false);
    expect(m.focusSec).toBe(100);
    expect(m.pauseSec).toBe(300);
    expect(m.wallClockSec).toBe(400);
    expect(m.executionDriftSec).toBe(400 - 1800);
  });

  it("separates observed and inferred pause time", () => {
    const m = metricsAt(
      sequence(
        ...started(0),
        ev.taskPaused(T1, 100, { evidence: "inferred" }),
        ev.taskResumed(T1, 400),
        ev.taskPaused(T1, 500),
        ev.taskResumed(T1, 600),
      ),
      600,
    );
    expect(m.pauseSec).toBe(400);
    expect(m.inferredPauseSec).toBe(300);
    expect(m.observedPauseSec).toBe(100);
    expect(m.unaccountedSec).toBe(0);
  });

  it("flags time that is neither focus nor a recorded pause as unaccounted", () => {
    // T1 completes at 600 but nothing else is recorded until the block ends at 900
    const m = metricsAt(
      sequence(...started(0), ev.taskCompleted(T1, 600), ev.blockCompleted(900)),
      900,
    );
    expect(m.focusSec).toBe(600);
    expect(m.wallClockSec).toBe(900);
    expect(m.unaccountedSec).toBe(300);
  });

  it("measures execution drift against the budget using the end time", () => {
    const m = metricsAt(
      sequence(...started(0), ev.blockPaused(100), ev.blockResumed(700), ev.terminated(2400)),
      9999,
    );
    expect(m.wallClockSec).toBe(2400);
    expect(m.executionDriftSec).toBe(600);
  });

  it("computes focus variance over completed tasks only", () => {
    // T1 overruns by 300; T2 is skipped after 100s; T3 never starts
    const m = metricsAt(
      sequence(
        ...started(0),
        ev.taskCompleted(T1, 900),
        ev.taskStarted(T2, 900),
        ev.taskSkipped(T2, 1000),
        ev.taskStarted(T3, 1000),
      ),
      1000,
    );
    expect(m.focusVarianceSec).toBe(300);
    expect(m.focusSec).toBe(1000);
    expect(m).toMatchObject({ completedTasks: 1, skippedTasks: 1, unfinishedTasks: 1 });
  });

  it("does not mutate the projection and is repeatable", () => {
    const projection = deepFreeze(
      projectBlock(PLAN, PLAN_TASKS, finishedInPlan(), at(2000)),
    );
    expect(computeMetrics(projection, at(2000))).toEqual(
      computeMetrics(projection, at(2000)),
    );
  });
});

// the checker has its own tests; these cover how metrics carry its report
describe("fidelity", () => {
  // T1 done on time, T2 skipped, T3 never done
  const skippedOne = () =>
    sequence(...started(0), ev.taskCompleted(T1, 600), ev.taskSkipped(T2, 660));

  it("is the conformance report of the projection", () => {
    const projection = projectBlock(PLAN, PLAN_TASKS, finishedInPlan(), at(1800));
    expect(computeMetrics(projection, at(1800)).fidelity).toEqual(
      conformanceOf(projection),
    );
  });

  it("names the deviation behind a lost point", () => {
    const m = metricsAt(sequence(...skippedOne(), ev.terminated(700)), 700);
    // three required major steps with estimates: 4 points each
    expect(m.fidelity).toMatchObject({
      isFinal: true,
      verdict: "major_deviations",
      pointsTotal: 12,
      pointsLost: 8,
    });
    expect(m.fidelity?.score).toBeCloseTo(4 / 12, 4);
    expect(m.fidelity?.deviations.map((d) => [d.kind, d.taskId])).toEqual([
      ["missed_step", T2],
      ["missed_step", T3],
    ]);
  });

  it("is provisional while the block runs: open steps are not judged yet", () => {
    const m = metricsAt(skippedOne(), 700);
    expect(m.fidelity).toMatchObject({ isFinal: false, pointsLost: 4 });
    expect(m.fidelity?.deviations.map((d) => d.taskId)).toEqual([T2]);
  });

  it("stays apart from the completion rate, which only counts tasks", () => {
    const m = metricsAt(sequence(...skippedOne(), ev.terminated(700)), 700);
    expect(m.completionRate).toBeCloseTo(1 / 3, 4);
  });
});

describe("portfolioMetrics", () => {
  it("rolls up focus across blocks but averages fidelity over finished blocks only", () => {
    const finished = metricsAt(finishedInPlan(), 2000);
    const live = metricsAt(sequence(...started(0)), 100);
    const idle = metricsAt([], 0);
    const p = portfolioMetrics([finished, live, idle]);
    expect(p).toMatchObject({
      blocks: 3,
      startedBlocks: 2,
      finishedBlocks: 1,
      liveBlocks: 1,
      focusSec: 1900,
      averageFidelity: 1,
      verdicts: { followed: 1, minor_deviations: 0, major_deviations: 0, not_followed: 0 },
      executionDriftSec: 0,
      completedTasks: 3,
      totalTasks: 9,
    });
  });

  it("counts finished blocks by verdict and averages their scores", () => {
    const followed = metricsAt(finishedInPlan(), 2000);
    // nothing done: every point lost
    const abandoned = metricsAt(sequence(...started(0), ev.terminated(100)), 100);
    const p = portfolioMetrics([followed, abandoned]);
    expect(p.averageFidelity).toBeCloseTo(0.5, 4);
    expect(p.verdicts).toEqual({
      followed: 1,
      minor_deviations: 0,
      major_deviations: 1,
      not_followed: 0,
    });
  });

  it("has no average fidelity until a block finishes", () => {
    expect(portfolioMetrics([metricsAt([], 0)]).averageFidelity).toBeNull();
  });
});
