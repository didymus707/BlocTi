import { describe, expect, it } from "vitest";
import { computeMetrics } from "../../domain/metrics";
import { projectBlock } from "../../domain/projection";
import type { SeiEvent } from "../../domain/events";
import {
  PLAN,
  PLAN_TASKS,
  T1,
  T2,
  T3,
  at,
  ev,
  sequence,
  started,
} from "../../domain/__tests__/builders";
import { buildTrace } from "../trace";
import { completionNote, driftInsight, orderNote, timeAccuracyNote } from "../explain";

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

describe("explanations", () => {
  // T1 done 60s over, T2 skipped, T3 done on time; one switch
  const events = sequence(
    ...started(0),
    ev.taskSwitched(T1, T3, 300),
    ev.taskCompleted(T3, 1200),
    ev.taskStarted(T1, 1200),
    ev.taskCompleted(T1, 1560),
    ev.taskSkipped(T2, 1560),
    ev.blockCompleted(1560),
  );
  const p = project(events, 2000);

  it("reads completion in planned time", () => {
    expect(completionNote(p)).toBe("25m of 30m planned work done.");
  });

  it("reports the worst estimate miss", () => {
    expect(timeAccuracyNote(p)).toBe("Completed tasks landed within 1m of their estimates.");
  });

  it("counts switches", () => {
    expect(orderNote(p)).toBe("1 switch across 2 started tasks.");
    expect(orderNote(project(sequence(...started(0)), 10))).toBe("Worked in the planned order.");
  });

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
