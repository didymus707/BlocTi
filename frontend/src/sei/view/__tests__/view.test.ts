import { describe, expect, it } from "vitest";
import { conformanceOf, procedureOf } from "../../domain/conformance";
import { computeMetrics } from "../../domain/metrics";
import { projectBlock } from "../../domain/projection";
import type { SeiEvent } from "../../domain/events";
import {
  PLAN,
  PLAN_TASKS,
  SNAPSHOT_TASKS,
  T1,
  T2,
  T3,
  at,
  ev,
  sequence,
  started,
} from "../../domain/__tests__/builders";
import { buildTrace } from "../trace";
import {
  POINTS_KEY,
  describeDeviation,
  driftInsight,
  formatPoints,
  pointsSummary,
  procedureSummary,
} from "../explain";

const project = (events: SeiEvent[], nowSec: number) =>
  projectBlock(PLAN, PLAN_TASKS, events, at(nowSec));

const kinds = (events: SeiEvent[], nowSec: number) =>
  buildTrace(project(events, nowSec), at(nowSec)).segments.map((s) => [s.kind, s.taskId, s.seconds]);

describe("buildTrace", () => {
  it("draws only the plan, dashed, before the block starts", () => {
    expect(kinds([], 0)).toEqual([
      ["planned", T1, 600],
      ["planned", T2, 300],
      ["planned", T3, 900],
    ]);
  });

  it("shows live focus in blue, then what is left of the plan", () => {
    expect(kinds(sequence(...started(0)), 120)).toEqual([
      ["live", T1, 120],
      ["planned", T1, 480],
      ["planned", T2, 300],
      ["planned", T3, 900],
    ]);
  });

  it("separates observed pauses from inferred ones", () => {
    const events = sequence(
      ...started(0),
      ev.taskPaused(T1, 60),
      ev.taskResumed(T1, 90),
      ev.taskPaused(T1, 100, { evidence: "inferred" }),
      ev.taskResumed(T1, 130),
      ev.taskCompleted(T1, 200),
      ev.blockCompleted(200),
    );
    expect(kinds(events, 999)).toEqual([
      ["focus", T1, 60],
      ["paused", T1, 30],
      ["focus", T1, 10],
      ["inferred", T1, 30],
      ["focus", T1, 70],
    ]);
  });

  it("fills time no event covers with a gap and covers the whole wall clock", () => {
    const events = sequence(...started(0), ev.taskCompleted(T1, 60), ev.blockCompleted(100));
    const trace = buildTrace(project(events, 999), at(999));
    expect(trace.segments.map((s) => s.kind)).toEqual(["focus", "gap"]);
    expect(trace.totalSec).toBe(100);
    expect(trace.endAt).toBe(at(100));
  });

  it("alternates shades per task and keeps titles on focus", () => {
    const events = sequence(...started(0), ev.taskSwitched(T1, T2, 50), ev.taskSwitched(T2, T3, 80));
    const segs = buildTrace(project(events, 100), at(100), { includePlan: false }).segments;
    expect(segs.map((s) => [s.title, s.shade])).toEqual([
      ["Read", 0],
      ["Write", 1],
      ["Review", 2],
    ]);
  });

  it("places the budget marker by the block's budget", () => {
    expect(buildTrace(project(sequence(...started(0)), 10), at(10)).budgetAtSec).toBe(1800);
    expect(buildTrace(project([], 10), at(10)).budgetAtSec).toBeNull();
  });
});

describe("conformance in words", () => {
  // An ordered plan: Read 10m, Write 5m, Review 15m. Review is finished
  // first, Read then takes 15m, and Write is skipped.
  const events = sequence(
    ev.planned(0, SNAPSHOT_TASKS, { rules: { ordered: true, timeTolerance: 0.15 } }),
    ev.blockStarted(0),
    ev.taskStarted(T3, 0),
    ev.taskCompleted(T3, 900),
    ev.taskStarted(T1, 900),
    ev.taskCompleted(T1, 1800),
    ev.taskSkipped(T2, 1860),
    ev.blockCompleted(1860),
  );
  const p = project(events, 2000);
  const report = conformanceOf(p);

  it("describes each deviation in a sentence, worst first", () => {
    expect(report.deviations.map(describeDeviation)).toEqual([
      "Write was skipped.",
      "Review was finished while Read was still open.",
      "Read took 15m, 50% over its 10m estimate.",
    ]);
  });

  it("tells a step left unfinished apart from a skipped one", () => {
    const stopped = conformanceOf(project(sequence(...started(0), ev.terminated(60)), 60));
    expect(describeDeviation(stopped.deviations[0])).toBe(
      "Read was not finished when the block ended.",
    );
  });

  it("says which side of the estimate a step landed on", () => {
    const early = conformanceOf(project(sequence(...started(0), ev.taskCompleted(T1, 300)), 300));
    expect(describeDeviation(early.deviations[0])).toBe(
      "Read took 5m, 50% under its 10m estimate.",
    );
  });

  it("sums up where the score comes from", () => {
    // 18 points in play; lost 7 (Write) + 3 (Review) + 0.48 (Read)
    expect(pointsSummary(report)).toBe("Kept 7.5 of 18 points across 8 rules.");
    const clean = conformanceOf(project(sequence(...started(0)), 10));
    expect(pointsSummary(clean)).toBe("All 12 points kept across 6 rules.");
  });

  it("sums up the rules a run was checked against", () => {
    expect(procedureSummary(procedureOf(p))).toBe(
      "3 required steps · order enforced · on time within 15%",
    );
    expect(
      procedureSummary({
        ordered: false,
        timeTolerance: 0.25,
        steps: [
          { taskId: T1, title: "Read", plannedSec: 600, required: true, severity: "critical" },
          { taskId: T2, title: "Write", plannedSec: 300, required: false, severity: "minor" },
        ],
      }),
    ).toBe("1 required step · 1 critical · 1 optional · any order · on time within 25%");
    expect(POINTS_KEY).toBe("minor 1 · major 3 · critical 9");
  });

  it("formats points to one decimal", () => {
    expect(formatPoints(3)).toBe("3");
    expect(formatPoints(7.48)).toBe("7.5");
    expect(formatPoints(0.02)).toBe("<0.1");
    expect(formatPoints(0)).toBe("0");
  });
});

describe("explanations", () => {
  it("explains where the overrun came from", () => {
    const pauses = sequence(
      ...started(0),
      ev.taskCompleted(T1, 600),
      ev.taskStarted(T2, 600),
      ev.blockPaused(700),
      ev.blockResumed(1300),
      ev.taskCompleted(T2, 1500),
      ev.taskStarted(T3, 1500),
      ev.taskCompleted(T3, 2400),
      ev.blockCompleted(2400),
    );
    const m = computeMetrics(project(pauses, 2400), at(2400));
    expect(driftInsight(m)).toBe(
      "Estimates were on target but the block ran 10m long: the overrun came from pauses, not from the work.",
    );
    expect(driftInsight(computeMetrics(project(sequence(...started(0)), 10), at(10)))).toBeNull();
  });
});
