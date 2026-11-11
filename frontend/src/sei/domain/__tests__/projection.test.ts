import { afterAll, describe, expect, it } from "vitest";
import { SEI_EVENT_TYPES } from "../events";
import { projectBlock } from "../projection";
import {
  OTHER_BLOCK,
  PLAN,
  PLAN_TASKS,
  SESSION,
  SNAPSHOT_TASKS,
  T1,
  T2,
  T3,
  T4,
  at,
  deepFreeze,
  ev,
  sequence,
  started,
  usedEventTypes,
} from "./builders";
import type { SeiEvent } from "../events";

const project = (events: SeiEvent[], nowSec: number, tasks = PLAN_TASKS) =>
  projectBlock(PLAN, tasks, events, at(nowSec));

describe("projectBlock", () => {
  describe("before anything happens", () => {
    it("is idle and seeds tasks from the plan in order", () => {
      const p = project([], 100);
      expect(p.status).toBe("idle");
      expect(p.activeTaskId).toBeNull();
      expect(p.taskOrder).toEqual([T1, T2, T3]);
      expect(p.taskStates[T2]).toMatchObject({
        status: "pending",
        title: "Write",
        plannedSec: 300,
        elapsedSec: 0,
        remainingSec: 300,
        progress: 0,
      });
      expect(p.plannedSec).toBe(1800);
    });

    it("orders tasks by plan order, not array order", () => {
      const shuffled = [PLAN_TASKS[2], PLAN_TASKS[0], PLAN_TASKS[1]];
      expect(project([], 0, shuffled).taskOrder).toEqual([T1, T2, T3]);
    });
  });

  describe("start", () => {
    it("runs the first task and counts live focus time up to now", () => {
      const p = project(sequence(...started(0)), 120);
      expect(p.status).toBe("running");
      expect(p.sessionId).toBe(SESSION);
      expect(p.startedAt).toBe(at(0));
      expect(p.activeTaskId).toBe(T1);
      expect(p.taskStates[T1]).toMatchObject({
        status: "running",
        elapsedSec: 120,
        remainingSec: 480,
        progress: 20,
        startedAt: at(0),
      });
    });

    it("ignores a second BlockStarted", () => {
      const p = project(sequence(...started(0), ev.blockStarted(50)), 60);
      expect(p.startedAt).toBe(at(0));
      expect(p.taskStates[T1].elapsedSec).toBe(60);
    });

    it("treats TaskStarted without BlockStarted as the start of the block", () => {
      const p = project(sequence(ev.taskStarted(T1, 10)), 40);
      expect(p.status).toBe("running");
      expect(p.startedAt).toBe(at(10));
      expect(p.taskStates[T1].elapsedSec).toBe(30);
    });
  });

  describe("pause and resume (task)", () => {
    it("stops the focus clock while paused and counts pause time live", () => {
      const p = project(sequence(...started(0), ev.taskPaused(T1, 60)), 300);
      expect(p.status).toBe("paused");
      expect(p.isPaused).toBe(true);
      expect(p.pauseKind).toBe("task");
      expect(p.pausedSince).toBe(at(60));
      expect(p.pauseCount).toBe(1);
      expect(p.taskStates[T1]).toMatchObject({
        status: "paused",
        elapsedSec: 60,
        remainingSec: 540,
        progress: 10,
      });
      expect(p.pausedSec).toBe(240);
    });

    it("resumes the clock and closes the pause interval", () => {
      const p = project(
        sequence(...started(0), ev.taskPaused(T1, 60), ev.taskResumed(T1, 100)),
        160,
      );
      expect(p.status).toBe("running");
      expect(p.isPaused).toBe(false);
      expect(p.pauseKind).toBeNull();
      expect(p.pausedSince).toBeNull();
      expect(p.taskStates[T1].elapsedSec).toBe(120);
      expect(p.pausedSec).toBe(40);
    });

    it("sums several pause/resume cycles", () => {
      const p = project(
        sequence(
          ...started(0),
          ev.taskPaused(T1, 10),
          ev.taskResumed(T1, 20),
          ev.taskPaused(T1, 50),
          ev.taskResumed(T1, 80),
        ),
        100,
      );
      // focus: 0-10, 20-50, 80-100 = 60; paused: 10 + 30 = 40
      expect(p.taskStates[T1].elapsedSec).toBe(60);
      expect(p.pausedSec).toBe(40);
      expect(p.pauseCount).toBe(2);
    });

    it("ignores a TaskResumed while already running (does not restart the segment)", () => {
      const p = project(sequence(...started(0), ev.taskResumed(T1, 50)), 100);
      expect(p.taskStates[T1].elapsedSec).toBe(100);
    });

    it("ignores a TaskPaused for a task that is not active", () => {
      const p = project(sequence(...started(0), ev.taskPaused(T2, 50)), 100);
      expect(p.status).toBe("running");
      expect(p.taskStates[T1].elapsedSec).toBe(100);
      expect(p.taskStates[T2].status).toBe("pending");
    });

    it("tracks inferred pause time separately from observed pause time", () => {
      const p = project(
        sequence(
          ...started(0),
          ev.taskPaused(T1, 10, { evidence: "inferred", actor: "agent" }),
          ev.taskResumed(T1, 40),
          ev.taskPaused(T1, 50),
          ev.taskResumed(T1, 60),
        ),
        60,
      );
      expect(p.pausedSec).toBe(40);
      expect(p.inferredPausedSec).toBe(30);
    });
  });

  describe("pause and resume (block)", () => {
    it("pauses the active task when the block pauses", () => {
      const p = project(sequence(...started(0), ev.blockPaused(60)), 90);
      expect(p.status).toBe("paused");
      expect(p.pauseKind).toBe("block");
      expect(p.taskStates[T1]).toMatchObject({ status: "paused", elapsedSec: 60 });
      expect(p.pausedSec).toBe(30);
    });

    it("resumes the active task when the block resumes", () => {
      const p = project(
        sequence(...started(0), ev.blockPaused(60), ev.blockResumed(90)),
        120,
      );
      expect(p.status).toBe("running");
      expect(p.pauseKind).toBeNull();
      expect(p.taskStates[T1]).toMatchObject({ status: "running", elapsedSec: 90 });
      expect(p.pausedSec).toBe(30);
    });

    it("ignores BlockPaused before the block starts", () => {
      const p = project(sequence(ev.blockPaused(10)), 20);
      expect(p.status).toBe("idle");
      expect(p.pauseCount).toBe(0);
    });

    it("ignores BlockResumed when nothing is paused", () => {
      const p = project(sequence(...started(0), ev.blockResumed(50)), 100);
      expect(p.taskStates[T1].elapsedSec).toBe(100);
      expect(p.pausedSec).toBe(0);
    });
  });

  describe("complete", () => {
    it("closes the segment, marks the task done and frees the active slot", () => {
      const p = project(sequence(...started(0), ev.taskCompleted(T1, 500)), 900);
      expect(p.activeTaskId).toBeNull();
      expect(p.status).toBe("running");
      expect(p.taskStates[T1]).toMatchObject({
        status: "completed",
        elapsedSec: 500,
        remainingSec: 0,
        progress: 100,
        finishedAt: at(500),
      });
    });

    it("auto-advances when the next TaskStarted follows", () => {
      const p = project(
        sequence(...started(0), ev.taskCompleted(T1, 600), ev.taskStarted(T2, 600)),
        660,
      );
      expect(p.activeTaskId).toBe(T2);
      expect(p.taskStates[T1].elapsedSec).toBe(600);
      expect(p.taskStates[T2]).toMatchObject({ status: "running", elapsedSec: 60 });
    });

    it("records overrun when a task runs past its plan", () => {
      const p = project(sequence(...started(0), ev.taskCompleted(T1, 700)), 700);
      expect(p.taskStates[T1]).toMatchObject({
        elapsedSec: 700,
        overrunSec: 100,
        remainingSec: 0,
        progress: 100,
      });
    });

    it("can complete a paused task without counting the pause as focus", () => {
      const p = project(
        sequence(...started(0), ev.taskPaused(T1, 100), ev.taskCompleted(T1, 200)),
        300,
      );
      expect(p.status).toBe("running");
      expect(p.isPaused).toBe(false);
      expect(p.taskStates[T1].elapsedSec).toBe(100);
      expect(p.pausedSec).toBe(100);
    });

    it("ignores completing a task twice", () => {
      const p = project(
        sequence(...started(0), ev.taskCompleted(T1, 100), ev.taskCompleted(T1, 200)),
        300,
      );
      expect(p.taskStates[T1].finishedAt).toBe(at(100));
    });

    it("ignores TaskStarted for a finished task", () => {
      const p = project(
        sequence(...started(0), ev.taskCompleted(T1, 100), ev.taskStarted(T1, 150)),
        300,
      );
      expect(p.taskStates[T1]).toMatchObject({ status: "completed", elapsedSec: 100 });
      expect(p.activeTaskId).toBeNull();
    });
  });

  describe("skip", () => {
    it("skips the active task, keeping its focus time but nothing remaining", () => {
      const p = project(sequence(...started(0), ev.taskSkipped(T1, 120)), 300);
      expect(p.activeTaskId).toBeNull();
      expect(p.taskStates[T1]).toMatchObject({
        status: "skipped",
        elapsedSec: 120,
        remainingSec: 0,
        progress: 20,
        finishedAt: at(120),
      });
    });

    it("skips a pending task without touching the active one", () => {
      const p = project(sequence(...started(0), ev.taskSkipped(T3, 50)), 100);
      expect(p.activeTaskId).toBe(T1);
      expect(p.taskStates[T1].elapsedSec).toBe(100);
      expect(p.taskStates[T3]).toMatchObject({ status: "skipped", elapsedSec: 0 });
    });

    it("skipping a paused active task closes the pause", () => {
      const p = project(
        sequence(...started(0), ev.taskPaused(T1, 30), ev.taskSkipped(T1, 50)),
        100,
      );
      expect(p.isPaused).toBe(false);
      expect(p.status).toBe("running");
      expect(p.pausedSec).toBe(20);
    });
  });

  describe("switch", () => {
    it("moves focus to another task and puts the first back to pending", () => {
      const p = project(sequence(...started(0), ev.taskSwitched(T1, T3, 100)), 160);
      expect(p.activeTaskId).toBe(T3);
      expect(p.switchCount).toBe(1);
      expect(p.taskStates[T1]).toMatchObject({
        status: "pending",
        elapsedSec: 100,
        startedAt: at(0),
      });
      expect(p.taskStates[T3]).toMatchObject({
        status: "running",
        elapsedSec: 60,
        startedAt: at(100),
      });
    });

    it("accumulates time across switching back and forth", () => {
      const p = project(
        sequence(
          ...started(0),
          ev.taskSwitched(T1, T3, 100),
          ev.taskSwitched(T3, T1, 200),
        ),
        250,
      );
      expect(p.taskStates[T1].elapsedSec).toBe(150);
      expect(p.taskStates[T3].elapsedSec).toBe(100);
      expect(p.taskStates[T3].status).toBe("pending");
      expect(p.switchCount).toBe(2);
    });

    it("switching while paused ends the pause and starts the new task", () => {
      const p = project(
        sequence(...started(0), ev.taskPaused(T1, 50), ev.taskSwitched(T1, T3, 80)),
        100,
      );
      expect(p.status).toBe("running");
      expect(p.taskStates[T1]).toMatchObject({ status: "pending", elapsedSec: 50 });
      expect(p.taskStates[T3].elapsedSec).toBe(20);
      expect(p.pausedSec).toBe(30);
    });

    it("ignores a switch whose from-task is not the active task", () => {
      const p = project(sequence(...started(0), ev.taskSwitched(T2, T3, 50)), 100);
      expect(p.activeTaskId).toBe(T1);
      expect(p.switchCount).toBe(0);
    });

    it("ignores a switch to a finished task", () => {
      const p = project(
        sequence(
          ...started(0),
          ev.taskSkipped(T3, 10),
          ev.taskSwitched(T1, T3, 50),
        ),
        100,
      );
      expect(p.activeTaskId).toBe(T1);
      expect(p.taskStates[T3].status).toBe("skipped");
    });

    it("a TaskStarted while another task runs closes the other task's segment", () => {
      const p = project(sequence(...started(0), ev.taskStarted(T2, 40)), 100);
      expect(p.activeTaskId).toBe(T2);
      expect(p.taskStates[T1]).toMatchObject({ status: "pending", elapsedSec: 40 });
      expect(p.taskStates[T2].elapsedSec).toBe(60);
    });
  });

  describe("block completion", () => {
    it("completes the block and stops all clocks", () => {
      const p = project(
        sequence(
          ...started(0),
          ev.taskCompleted(T1, 600),
          ev.taskStarted(T2, 600),
          ev.taskCompleted(T2, 900),
          ev.taskStarted(T3, 900),
          ev.taskCompleted(T3, 1800),
          ev.blockCompleted(1800),
        ),
        5000,
      );
      expect(p.status).toBe("completed");
      expect(p.completedAt).toBe(at(1800));
      expect(p.activeTaskId).toBeNull();
      expect(p.taskStates[T3].elapsedSec).toBe(900);
    });

    it("ignores everything after BlockCompleted", () => {
      const p = project(
        sequence(
          ...started(0),
          ev.taskCompleted(T1, 100),
          ev.blockCompleted(100),
          ev.taskStarted(T2, 200),
          ev.blockPaused(300),
        ),
        400,
      );
      expect(p.status).toBe("completed");
      expect(p.taskStates[T2].status).toBe("pending");
      expect(p.pauseCount).toBe(0);
      expect(p.eventCount).toBe(5);
    });

    it("completing the block while a task runs keeps that task's focus time", () => {
      const p = project(sequence(...started(0), ev.blockCompleted(300)), 900);
      expect(p.taskStates[T1]).toMatchObject({ status: "pending", elapsedSec: 300 });
    });
  });

  describe("session termination", () => {
    it("keeps focus time up to the termination (no time is lost)", () => {
      const p = project(sequence(...started(0), ev.terminated(300)), 1000);
      expect(p.status).toBe("terminated");
      expect(p.terminatedAt).toBe(at(300));
      expect(p.terminationReason).toBe("user_exit");
      expect(p.activeTaskId).toBeNull();
      expect(p.taskStates[T1]).toMatchObject({ status: "pending", elapsedSec: 300 });
    });

    it("closes an open pause at termination", () => {
      const p = project(
        sequence(...started(0), ev.blockPaused(100), ev.terminated(400, "interrupted")),
        1000,
      );
      expect(p.pausedSec).toBe(300);
      expect(p.isPaused).toBe(false);
      expect(p.terminationReason).toBe("interrupted");
    });

    it("ignores everything after termination", () => {
      const p = project(
        sequence(...started(0), ev.terminated(100), ev.taskResumed(T1, 200)),
        500,
      );
      expect(p.status).toBe("terminated");
      expect(p.taskStates[T1].elapsedSec).toBe(100);
    });
  });

  describe("plan snapshot", () => {
    it("projects from the BlockPlanned snapshot, not the live plan", () => {
      const events = sequence(...started(0), ev.taskCompleted(T1, 300));
      const editedPlan = PLAN_TASKS.map((t) =>
        t.id === T1 ? { ...t, name: "Renamed", plannedDuration: 60 } : t,
      );
      const p = project(events, 300, editedPlan);
      expect(p.taskStates[T1]).toMatchObject({ title: "Read", plannedSec: 600 });
    });

    it("still projects history after the plan's tasks are deleted", () => {
      const events = sequence(...started(0), ev.taskCompleted(T1, 300));
      const p = project(events, 300, []);
      expect(p.taskOrder).toEqual([T1, T2, T3]);
      expect(p.taskStates[T1].elapsedSec).toBe(300);
    });

    it("lets a pre-start snapshot replace the seeded plan", () => {
      const p = project(
        sequence(ev.planned(0, [SNAPSHOT_TASKS[1]], { name: "Short" })),
        0,
      );
      expect(p.name).toBe("Short");
      expect(p.taskOrder).toEqual([T2]);
    });

    it("a replan mid-block adds new tasks and keeps history", () => {
      const p = project(
        sequence(
          ...started(0),
          ev.planned(100, [
            ...SNAPSHOT_TASKS,
            { taskId: T4, title: "Ship", plannedDuration: 120 },
          ]),
        ),
        200,
      );
      expect(p.taskOrder).toEqual([T1, T2, T3, T4]);
      expect(p.taskStates[T4]).toMatchObject({ status: "pending", plannedSec: 120 });
      expect(p.taskStates[T1]).toMatchObject({ status: "running", elapsedSec: 200 });
    });

    it("a replan cannot rewrite a started task or drop it", () => {
      const p = project(
        sequence(
          ...started(0),
          // new plan drops T1 and T2 and re-times T3
          ev.planned(100, [{ taskId: T3, title: "Review", plannedDuration: 60 }]),
        ),
        200,
      );
      expect(p.taskOrder).toEqual([T1, T3]);
      expect(p.taskStates[T1].plannedSec).toBe(600);
      expect(p.taskStates[T3].plannedSec).toBe(60);
      expect(p.taskStates[T2]).toBeUndefined();
    });

    it("freezes the block budget once execution starts", () => {
      const p = project(
        sequence(...started(0), ev.planned(10, SNAPSHOT_TASKS, { plannedDuration: 99 })),
        20,
      );
      expect(p.plannedSec).toBe(1800);
    });

    it("drops duplicate task ids in a snapshot", () => {
      const p = project(
        sequence(ev.planned(0, [SNAPSHOT_TASKS[0], SNAPSHOT_TASKS[0]])),
        0,
      );
      expect(p.taskOrder).toEqual([T1]);
    });
  });

  describe("determinism", () => {
    const events = sequence(
      ...started(0),
      ev.taskPaused(T1, 60),
      ev.taskResumed(T1, 90),
      ev.taskSwitched(T1, T3, 200),
      ev.taskSkipped(T2, 210),
      ev.blockPaused(300),
      ev.blockResumed(330),
      ev.taskCompleted(T3, 500),
      ev.taskStarted(T1, 500),
    );

    it("produces the same projection every time", () => {
      expect(project(events, 600)).toEqual(project(events, 600));
    });

    it("orders by seq, not by array position", () => {
      const reversed = [...events].reverse();
      const rotated = [...events.slice(4), ...events.slice(0, 4)];
      expect(project(reversed, 600)).toEqual(project(events, 600));
      expect(project(rotated, 600)).toEqual(project(events, 600));
    });

    it("does not mutate its inputs", () => {
      const frozen = deepFreeze(structuredClone(events));
      const frozenPlan = deepFreeze(structuredClone(PLAN_TASKS));
      expect(() => projectBlock(PLAN, frozenPlan, frozen, at(600))).not.toThrow();
    });

    it("counts a duplicated event (same eventId) once", () => {
      const withDuplicate = [...events, { ...events[4], seq: 99 }];
      expect(project(withDuplicate, 600)).toEqual(project(events, 600));
    });

    it("ignores events that belong to another block", () => {
      const foreign = sequence(ev.taskPaused(T1, 30)).map((e) => ({
        ...e,
        blockId: OTHER_BLOCK,
        eventId: "foreign" as SeiEvent["eventId"],
        seq: 3.5,
      }));
      expect(project([...events, ...foreign], 600)).toEqual(project(events, 600));
    });

    it("never produces negative time from out-of-order timestamps", () => {
      const p = project(sequence(...started(100), ev.taskPaused(T1, 50)), 40);
      expect(p.taskStates[T1].elapsedSec).toBe(0);
      expect(p.pausedSec).toBe(0);
    });

    it("handles a zero-length planned task without NaN", () => {
      const p = project(
        sequence(
          ev.planned(0, [{ taskId: T1, title: "Unplanned", plannedDuration: 0 }]),
          ev.blockStarted(0),
          ev.taskStarted(T1, 0),
        ),
        100,
      );
      expect(p.taskStates[T1]).toMatchObject({
        elapsedSec: 100,
        progress: 0,
        overrunSec: 0,
        remainingSec: 0,
      });
    });
  });

  describe("intervals (the execution trace)", () => {
    it("records each focus and pause interval in order", () => {
      const p = project(
        sequence(
          ...started(0),
          ev.taskPaused(T1, 60),
          ev.taskResumed(T1, 90),
          ev.taskSwitched(T1, T3, 150),
          ev.blockPaused(200),
          ev.blockResumed(260),
          ev.taskCompleted(T3, 300),
          ev.blockCompleted(300),
        ),
        999,
      );
      expect(
        p.intervals.map((i) => [i.kind, i.taskId, i.pauseKind, i.from, i.to, i.open]),
      ).toEqual([
        ["focus", T1, null, at(0), at(60), false],
        ["pause", T1, "task", at(60), at(90), false],
        ["focus", T1, null, at(90), at(150), false],
        ["focus", T3, null, at(150), at(200), false],
        ["pause", T3, "block", at(200), at(260), false],
        ["focus", T3, null, at(260), at(300), false],
      ]);
    });

    it("marks the intervals still running at now as open", () => {
      const running = project(sequence(...started(0)), 30);
      expect(running.intervals).toEqual([
        expect.objectContaining({ kind: "focus", to: at(30), open: true }),
      ]);
      const paused = project(sequence(...started(0), ev.taskPaused(T1, 10)), 30);
      expect(paused.intervals.at(-1)).toMatchObject({ kind: "pause", to: at(30), open: true });
    });

    it("keeps the evidence of inferred pauses and drops zero-length intervals", () => {
      const p = project(
        sequence(
          ...started(0),
          ev.taskPaused(T1, 0, { evidence: "inferred" }),
          ev.taskResumed(T1, 20),
        ),
        20,
      );
      expect(p.intervals).toEqual([
        expect.objectContaining({ kind: "pause", evidence: "inferred", from: at(0), to: at(20) }),
      ]);
    });

    it("sums back to the projection's focus and pause totals", () => {
      const p = project(
        sequence(...started(0), ev.taskPaused(T1, 100), ev.taskResumed(T1, 160)),
        400,
      );
      const total = (kind: string) =>
        p.intervals
          .filter((i) => i.kind === kind)
          .reduce((acc, i) => acc + (Date.parse(i.to) - Date.parse(i.from)) / 1000, 0);
      expect(total("focus")).toBe(p.taskStates[T1].elapsedSec);
      expect(total("pause")).toBe(p.pausedSec);
    });
  });

  afterAll(() => {
    // Sprint 1 exit criterion: every event type is exercised by this suite
    expect([...usedEventTypes].sort()).toEqual([...SEI_EVENT_TYPES].sort());
  });
});
