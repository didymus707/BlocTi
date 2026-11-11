import { describe, expect, it } from "vitest";
import { appendEvents } from "../append";
import type { ExecutionCommand } from "../command/executionCommand";
import { resolveCommand } from "../command/resolver";
import type { SeiEvent } from "../events";
import type { SessionId, TaskId } from "../ids";
import { projectBlock } from "../projection";
import {
  BLOCK,
  OTHER_BLOCK,
  PLAN,
  PLAN_TASKS,
  SESSION,
  SNAPSHOT_TASKS,
  T1,
  T2,
  T3,
  T4,
  USER,
  at,
  ev,
  idSequence,
  sequence,
  started,
} from "./builders";

type CommandInput = ExecutionCommand extends infer C
  ? C extends ExecutionCommand
    ? Omit<C, "blockId" | "userId" | "at">
    : never
  : never;

const cmd = (sec: number, input: CommandInput): ExecutionCommand =>
  ({ ...input, blockId: BLOCK, userId: USER, at: at(sec) }) as ExecutionCommand;

const resolve = (events: SeiEvent[], sec: number, input: CommandInput) =>
  resolveCommand(PLAN, PLAN_TASKS, events, cmd(sec, input));

const types = (results: { type: string }[]) => results.map((r) => r.type);

describe("resolveCommand", () => {
  describe("StartBlock", () => {
    it("snapshots the plan, starts the block and the first task", () => {
      const results = resolve([], 10, { type: "StartBlock", sessionId: SESSION });
      expect(types(results)).toEqual(["BlockPlanned", "BlockStarted", "TaskStarted"]);
      expect(results[0]).toMatchObject({
        name: PLAN.name,
        plannedDuration: 1800,
        tasks: SNAPSHOT_TASKS,
      });
      expect(results[2]).toMatchObject({ taskId: T1 });
      for (const r of results) {
        expect(r).toMatchObject({
          blockId: BLOCK,
          userId: USER,
          sessionId: SESSION,
          occurredAt: at(10),
          actor: "human",
          source: "timer",
          evidence: "observed",
        });
        expect(r).not.toHaveProperty("eventId");
        expect(r).not.toHaveProperty("seq");
      }
    });

    it("can start from a chosen task", () => {
      const results = resolve([], 0, {
        type: "StartBlock",
        sessionId: SESSION,
        taskId: T3,
      });
      expect(results[2]).toMatchObject({ type: "TaskStarted", taskId: T3 });
    });

    it("rejects starting a block that already started", () => {
      expect(
        resolve(sequence(...started(0)), 10, { type: "StartBlock", sessionId: SESSION }),
      ).toEqual([]);
    });

    it("rejects a block with no tasks", () => {
      expect(
        resolveCommand(PLAN, [], [], cmd(0, { type: "StartBlock", sessionId: SESSION })),
      ).toEqual([]);
    });

    it("rejects an unknown start task", () => {
      expect(
        resolve([], 0, {
          type: "StartBlock",
          sessionId: SESSION,
          taskId: "nope" as TaskId,
        }),
      ).toEqual([]);
    });

    it("rejects a command addressed to another block", () => {
      const command = { ...cmd(0, { type: "StartBlock", sessionId: SESSION }), blockId: OTHER_BLOCK };
      expect(resolveCommand(PLAN, PLAN_TASKS, [], command)).toEqual([]);
    });
  });

  describe("PauseTask / ResumeTask", () => {
    it("pauses the active task with an optional reason", () => {
      const results = resolve(sequence(...started(0)), 30, {
        type: "PauseTask",
        reason: "phone call",
      });
      expect(results).toEqual([
        expect.objectContaining({ type: "TaskPaused", taskId: T1, reason: "phone call" }),
      ]);
    });

    it("omits reason when none is given", () => {
      const [paused] = resolve(sequence(...started(0)), 30, { type: "PauseTask" });
      expect(paused).not.toHaveProperty("reason");
    });

    it("rejects pausing when already paused or not started", () => {
      expect(resolve([], 0, { type: "PauseTask" })).toEqual([]);
      expect(
        resolve(sequence(...started(0), ev.taskPaused(T1, 10)), 20, { type: "PauseTask" }),
      ).toEqual([]);
    });

    it("resumes a task pause", () => {
      expect(
        types(resolve(sequence(...started(0), ev.taskPaused(T1, 10)), 20, { type: "ResumeTask" })),
      ).toEqual(["TaskResumed"]);
    });

    it("rejects ResumeTask for a block-level pause", () => {
      expect(
        resolve(sequence(...started(0), ev.blockPaused(10)), 20, { type: "ResumeTask" }),
      ).toEqual([]);
    });

    it("rejects ResumeTask while running", () => {
      expect(resolve(sequence(...started(0)), 20, { type: "ResumeTask" })).toEqual([]);
    });
  });

  describe("PauseBlock / ResumeBlock", () => {
    it("pauses and resumes the block", () => {
      const running = sequence(...started(0));
      expect(types(resolve(running, 10, { type: "PauseBlock" }))).toEqual(["BlockPaused"]);
      const paused = sequence(...started(0), ev.blockPaused(10));
      expect(types(resolve(paused, 20, { type: "ResumeBlock" }))).toEqual(["BlockResumed"]);
    });

    it("rejects ResumeBlock for a task-level pause", () => {
      expect(
        resolve(sequence(...started(0), ev.taskPaused(T1, 10)), 20, { type: "ResumeBlock" }),
      ).toEqual([]);
    });

    it("rejects PauseBlock when not running", () => {
      expect(resolve([], 0, { type: "PauseBlock" })).toEqual([]);
    });
  });

  describe("CompleteTask", () => {
    it("completes the active task and starts the next one", () => {
      const results = resolve(sequence(...started(0)), 600, { type: "CompleteTask" });
      expect(results).toEqual([
        expect.objectContaining({ type: "TaskCompleted", taskId: T1 }),
        expect.objectContaining({ type: "TaskStarted", taskId: T2 }),
      ]);
    });

    it("completes the block after the last task", () => {
      const events = sequence(
        ...started(0),
        ev.taskCompleted(T1, 10),
        ev.taskStarted(T2, 10),
        ev.taskCompleted(T2, 20),
        ev.taskStarted(T3, 20),
      );
      expect(types(resolve(events, 30, { type: "CompleteTask" }))).toEqual([
        "TaskCompleted",
        "BlockCompleted",
      ]);
    });

    it("does not complete the block while an earlier task is unfinished", () => {
      // switched T1 -> T3 (last by order), T2 skipped; completing T3 must go back to T1
      const events = sequence(
        ...started(0),
        ev.taskSwitched(T1, T3, 10),
        ev.taskSkipped(T2, 15),
      );
      const results = resolve(events, 20, { type: "CompleteTask" });
      expect(results).toEqual([
        expect.objectContaining({ type: "TaskCompleted", taskId: T3 }),
        expect.objectContaining({ type: "TaskStarted", taskId: T1 }),
      ]);
    });

    it("can complete a paused task", () => {
      expect(
        types(resolve(sequence(...started(0), ev.taskPaused(T1, 10)), 20, { type: "CompleteTask" })),
      ).toEqual(["TaskCompleted", "TaskStarted"]);
    });

    it("rejects completing when nothing is active", () => {
      expect(resolve([], 0, { type: "CompleteTask" })).toEqual([]);
    });
  });

  describe("SkipTask", () => {
    it("skips the active task and advances", () => {
      expect(resolve(sequence(...started(0)), 10, { type: "SkipTask" })).toEqual([
        expect.objectContaining({ type: "TaskSkipped", taskId: T1 }),
        expect.objectContaining({ type: "TaskStarted", taskId: T2 }),
      ]);
    });

    it("skipping the last unfinished task completes the block", () => {
      const events = sequence(
        ...started(0),
        ev.taskSkipped(T2, 1),
        ev.taskSkipped(T3, 2),
      );
      expect(types(resolve(events, 10, { type: "SkipTask" }))).toEqual([
        "TaskSkipped",
        "BlockCompleted",
      ]);
    });

    it("skips a pending task without changing the active task", () => {
      expect(types(resolve(sequence(...started(0)), 10, { type: "SkipTask", taskId: T3 }))).toEqual([
        "TaskSkipped",
      ]);
    });

    it("rejects skipping a finished task", () => {
      const events = sequence(...started(0), ev.taskSkipped(T3, 5));
      expect(resolve(events, 10, { type: "SkipTask", taskId: T3 })).toEqual([]);
    });

    it("rejects skipping before the block starts", () => {
      expect(resolve([], 0, { type: "SkipTask", taskId: T2 })).toEqual([]);
    });
  });

  describe("SwitchTask", () => {
    it("switches from the active task to another unfinished task", () => {
      expect(resolve(sequence(...started(0)), 10, { type: "SwitchTask", toTaskId: T3 })).toEqual([
        expect.objectContaining({ type: "TaskSwitched", fromTaskId: T1, toTaskId: T3 }),
      ]);
    });

    it("rejects switching to the active task, a finished task or an unknown task", () => {
      const events = sequence(...started(0), ev.taskSkipped(T3, 5));
      expect(resolve(events, 10, { type: "SwitchTask", toTaskId: T1 })).toEqual([]);
      expect(resolve(events, 10, { type: "SwitchTask", toTaskId: T3 })).toEqual([]);
      expect(resolve(events, 10, { type: "SwitchTask", toTaskId: T4 })).toEqual([]);
    });
  });

  describe("ReplanBlock", () => {
    it("re-snapshots the current plan into a live block", () => {
      const withNewTask = [
        ...PLAN_TASKS,
        { id: T4, name: "Ship", blockId: BLOCK, order: 3, plannedDuration: 120 },
      ];
      const results = resolveCommand(
        PLAN,
        withNewTask,
        sequence(...started(0)),
        cmd(10, { type: "ReplanBlock" }),
      );
      expect(results).toEqual([
        expect.objectContaining({
          type: "BlockPlanned",
          tasks: expect.arrayContaining([expect.objectContaining({ taskId: T4 })]),
        }),
      ]);
    });

    it("does nothing for an idle block (the plan seeds the projection)", () => {
      expect(resolve([], 0, { type: "ReplanBlock" })).toEqual([]);
    });
  });

  describe("TerminateSession", () => {
    it("terminates a live session with a reason", () => {
      expect(
        resolve(sequence(...started(0)), 10, { type: "TerminateSession", reason: "interrupted" }),
      ).toEqual([expect.objectContaining({ type: "SessionTerminated", reason: "interrupted" })]);
    });

    it("rejects terminating an idle or finished block", () => {
      expect(resolve([], 0, { type: "TerminateSession", reason: "user_exit" })).toEqual([]);
      const done = sequence(...started(0), ev.blockCompleted(5));
      expect(resolve(done, 10, { type: "TerminateSession", reason: "user_exit" })).toEqual([]);
    });
  });

  it("stamps provenance from the command", () => {
    const [paused] = resolve(sequence(...started(0)), 10, {
      type: "PauseTask",
      provenance: { actor: "agent", source: "agent_hook", evidence: "inferred" },
    });
    expect(paused).toMatchObject({ actor: "agent", source: "agent_hook", evidence: "inferred" });
  });

  it("uses the session id of the running block for follow-up events", () => {
    const other = "session-2" as SessionId;
    const events = sequence(...started(0)).map((e) => ({ ...e, sessionId: other }));
    const [paused] = resolve(events, 10, { type: "PauseTask" });
    expect(paused.sessionId).toBe(other);
  });

  it("drives a whole session end to end through resolve -> append -> project", () => {
    const ids = idSequence("evt");
    let events: SeiEvent[] = [];
    const run = (sec: number, input: CommandInput) => {
      const results = resolve(events, sec, input);
      expect(results.length).toBeGreaterThan(0);
      events = appendEvents(events, results, ids);
    };

    run(0, { type: "StartBlock", sessionId: SESSION });
    run(120, { type: "PauseTask" });
    run(180, { type: "ResumeTask" });
    run(300, { type: "SwitchTask", toTaskId: T3 });
    run(600, { type: "PauseBlock" });
    run(660, { type: "ResumeBlock" });
    run(1200, { type: "CompleteTask" }); // T3 done -> back to T1 (first unfinished after wrap)
    run(1500, { type: "CompleteTask" }); // T1 done -> T2
    run(1600, { type: "SkipTask" }); // T2 skipped -> block complete

    const p = projectBlock(PLAN, PLAN_TASKS, events, at(9999));
    expect(p.status).toBe("completed");
    expect(p.completedAt).toBe(at(1600));
    expect(p.taskStates[T1]).toMatchObject({ status: "completed", elapsedSec: 240 + 300 });
    expect(p.taskStates[T3]).toMatchObject({ status: "completed", elapsedSec: 300 + 540 });
    expect(p.taskStates[T2]).toMatchObject({ status: "skipped", elapsedSec: 100 });
    expect(p.pausedSec).toBe(120);
    expect(p.switchCount).toBe(1);
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
  });
});
