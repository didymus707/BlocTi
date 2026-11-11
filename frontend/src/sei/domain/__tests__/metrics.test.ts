import { describe, expect, it } from "vitest";
import type { TaskSnapshot } from "../events";
import type { TaskId } from "../ids";
import { computeMetrics, fidelity, portfolioMetrics } from "../metrics";
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
    expect(m.fidelity).toEqual({
      score: 1,
      completion: 1,
      timeAccuracy: 1,
      sequence: 1,
      adherence: 1,
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

describe("fidelity", () => {
  const A = "A" as TaskId;
  const B = "B" as TaskId;
  const C = "C" as TaskId;
  const abc: TaskSnapshot[] = [
    { taskId: A, title: "A", plannedDuration: 1800 },
    { taskId: B, title: "B", plannedDuration: 600 },
    { taskId: C, title: "C", plannedDuration: 1200 },
  ];
  const projectAbc = (events: SeiEvent[], nowSec: number) =>
    projectBlock(PLAN, [], events, at(nowSec));

  it("matches the worked example: A 30m, B 10m skipped, C 20m", () => {
    const events = sequence(
      ev.planned(0, abc, { plannedDuration: 3600 }),
      ev.blockStarted(0),
      ev.taskStarted(A, 0),
      ev.taskSkipped(B, 10),
      ev.taskSwitched(A, C, 900),
      ev.taskCompleted(C, 2700),
      ev.taskStarted(A, 2700),
      ev.taskCompleted(A, 3600),
      ev.blockCompleted(3600),
    );
    const f = fidelity(projectAbc(events, 3600));
    expect(f.completion).toBeCloseTo(0.8333, 4);
    expect(f.timeAccuracy).toBeCloseTo(0.8, 4);
    expect(f.sequence).toBeCloseTo(0.5, 4);
    expect(f.adherence).toBeCloseTo(0.68, 4);
    expect(f.score).toBeCloseTo(0.7, 4);
    // the plain completion rate would have said 2/3
    const m = computeMetrics(projectAbc(events, 3600), at(3600));
    expect(m.completionRate).toBeCloseTo(2 / 3, 4);
    expect(m.focusVarianceSec).toBe(600);
  });

  it("weights completion by planned time, not task count", () => {
    const skipBig = sequence(
      ev.planned(0, abc),
      ev.blockStarted(0),
      ev.taskStarted(A, 0),
      ev.taskSkipped(A, 0),
      ev.taskStarted(B, 0),
      ev.taskCompleted(B, 600),
      ev.taskStarted(C, 600),
      ev.taskCompleted(C, 1800),
    );
    const skipSmall = sequence(
      ev.planned(0, abc),
      ev.blockStarted(0),
      ev.taskStarted(A, 0),
      ev.taskCompleted(A, 1800),
      ev.taskStarted(B, 1800),
      ev.taskSkipped(B, 1800),
      ev.taskStarted(C, 1800),
      ev.taskCompleted(C, 3000),
    );
    expect(fidelity(projectAbc(skipBig, 3000)).completion).toBeCloseTo(1800 / 3600, 4);
    expect(fidelity(projectAbc(skipSmall, 3000)).completion).toBeCloseTo(3000 / 3600, 4);
  });

  it("penalises overrun and underrun symmetrically", () => {
    const one: TaskSnapshot[] = [{ taskId: A, title: "A", plannedDuration: 1000 }];
    const finishAt = (sec: number) =>
      fidelity(
        projectAbc(
          sequence(
            ev.planned(0, one),
            ev.blockStarted(0),
            ev.taskStarted(A, 0),
            ev.taskCompleted(A, sec),
          ),
          sec,
        ),
      ).timeAccuracy;
    expect(finishAt(1000)).toBe(1);
    expect(finishAt(1500)).toBeCloseTo(0.5, 4);
    expect(finishAt(500)).toBeCloseTo(0.5, 4);
    expect(finishAt(2500)).toBe(0);
  });

  it("does not count auto-advance as an order deviation", () => {
    expect(fidelity(projectBlock(PLAN, PLAN_TASKS, finishedInPlan(), at(1800))).sequence).toBe(1);
  });

  it("scores zero when nothing was completed, however tidy the trace", () => {
    const f = fidelity(projectBlock(PLAN, PLAN_TASKS, sequence(...started(0), ev.terminated(100)), at(100)));
    expect(f.score).toBe(0);
    expect(f.sequence).toBe(1);
  });

  it("falls back to counts and skips time accuracy for inferred zero-duration plans", () => {
    const inferred: TaskSnapshot[] = [
      { taskId: A, title: "prompt 1", plannedDuration: 0 },
      { taskId: B, title: "prompt 2", plannedDuration: 0 },
    ];
    const f = fidelity(
      projectAbc(
        sequence(
          ev.planned(0, inferred, { plannedDuration: 0 }),
          ev.blockStarted(0),
          ev.taskStarted(A, 0),
          ev.taskCompleted(A, 300),
          ev.taskStarted(B, 300),
        ),
        400,
      ),
    );
    expect(f.completion).toBe(0.5);
    expect(f.timeAccuracy).toBe(1);
    expect(f.score).toBeCloseTo(0.5, 4);
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
      executionDriftSec: 0,
      completedTasks: 3,
      totalTasks: 9,
    });
  });

  it("has no average fidelity until a block finishes", () => {
    expect(portfolioMetrics([metricsAt([], 0)]).averageFidelity).toBeNull();
  });
});
