import { describe, expect, it } from "vitest";
import type { SeiEvent } from "../../domain/events";
import type { BlockId } from "../../domain/ids";
import {
  BLOCK,
  OTHER_BLOCK,
  PLAN,
  PLAN_TASKS,
  T1,
  at,
  ev,
  idSequence,
  sequence,
  started,
} from "../../domain/__tests__/builders";
import { migrateLegacyBlocks } from "../legacy";
import {
  allPlans,
  applyOp,
  EMPTY_STATE,
  planFor,
  reconcileEvents,
  rollbackEvents,
  type Op,
} from "../ops";
import { createLocalPersistence } from "../persistence";
import { duplicatePlan, draftFromPlan, planFromDraft } from "../planDraft";

const withPlan = applyOp(EMPTY_STATE, { kind: "savePlan", id: "op-1", block: PLAN, tasks: PLAN_TASKS });

describe("ops", () => {
  it("savePlan adds then replaces a plan and its tasks", () => {
    expect(withPlan.blockPlans).toEqual([PLAN]);
    expect(withPlan.taskPlans).toHaveLength(3);
    const edited = applyOp(withPlan, {
      kind: "savePlan",
      id: "op-2",
      block: { ...PLAN, name: "Renamed" },
      tasks: [PLAN_TASKS[0]],
    });
    expect(edited.blockPlans).toEqual([{ ...PLAN, name: "Renamed" }]);
    expect(edited.taskPlans).toEqual([PLAN_TASKS[0]]);
  });

  it("appendEvents ignores events it already has", () => {
    const events = sequence(...started(0));
    const op: Op = { kind: "appendEvents", id: "k", blockId: BLOCK, events };
    const once = applyOp(withPlan, op);
    expect(applyOp(once, op)).toBe(once);
    expect(once.events).toHaveLength(3);
  });

  it("deleteBlock removes the plan, tasks and events of that block only", () => {
    const foreign = sequence(ev.blockStarted(0)).map((e) => ({
      ...e,
      blockId: OTHER_BLOCK,
      eventId: "foreign" as SeiEvent["eventId"],
    }));
    const state = applyOp(withPlan, {
      kind: "appendEvents",
      id: "k",
      blockId: BLOCK,
      events: [...sequence(...started(0)), ...foreign],
    });
    const deleted = applyOp(state, { kind: "deleteBlock", id: "d", blockId: BLOCK });
    expect(deleted.blockPlans).toEqual([]);
    expect(deleted.taskPlans).toEqual([]);
    expect(deleted.events).toEqual(foreign);
  });

  it("reconcile swaps provisional events for canonical ones by eventId", () => {
    const events = sequence(...started(0));
    const state = applyOp(withPlan, { kind: "appendEvents", id: "k", blockId: BLOCK, events });
    const canonical = events.map((e) => ({ ...e, seq: e.seq + 10 }));
    expect(reconcileEvents(state, canonical).events.map((e) => e.seq)).toEqual([11, 12, 13]);
  });

  it("rollback removes only the op's events", () => {
    const first = sequence(...started(0));
    const op: Op = { kind: "appendEvents", id: "k", blockId: BLOCK, events: first };
    const state = applyOp(withPlan, op);
    expect(rollbackEvents(state, op).events).toEqual([]);
  });

  it("rebuilds a plan from the latest snapshot for blocks that only exist as events", () => {
    const events = sequence(...started(0));
    const state = applyOp(EMPTY_STATE, { kind: "appendEvents", id: "k", blockId: BLOCK, events });
    const plan = planFor(state, BLOCK);
    expect(plan?.block).toMatchObject({ id: BLOCK, name: PLAN.name, plannedDuration: 1800 });
    expect(plan?.tasks.map((t) => t.id)).toEqual(PLAN_TASKS.map((t) => t.id));
    expect(allPlans(state)).toHaveLength(1);
  });

  it("returns null for an unknown block", () => {
    expect(planFor(EMPTY_STATE, "nope" as BlockId)).toBeNull();
  });
});

describe("local persistence", () => {
  it("round-trips plans and events through storage", async () => {
    const p = createLocalPersistence();
    await p.savePlan(PLAN, PLAN_TASKS);
    await p.appendEvents({ idempotencyKey: "k1", blockId: BLOCK, events: sequence(...started(0)) });
    const loaded = await createLocalPersistence().load();
    expect(loaded.blockPlans).toEqual([PLAN]);
    expect(loaded.events).toHaveLength(3);
  });

  it("is idempotent: re-sending the same events stores them once", async () => {
    const p = createLocalPersistence();
    const events = sequence(...started(0));
    const first = await p.appendEvents({ idempotencyKey: "k1", blockId: BLOCK, events });
    const again = await p.appendEvents({ idempotencyKey: "k1", blockId: BLOCK, events });
    expect(again).toEqual(first);
    expect((await p.load()).events).toHaveLength(3);
  });

  it("assigns canonical seq after what is stored for the block", async () => {
    const p = createLocalPersistence();
    await p.appendEvents({ idempotencyKey: "k1", blockId: BLOCK, events: sequence(...started(0)) });
    const [paused] = await p.appendEvents({
      idempotencyKey: "k2",
      blockId: BLOCK,
      // provisional seq 1 collides; storage must renumber it
      events: sequence(ev.taskPaused(T1, 10)).map((e) => ({ ...e, eventId: "p" as SeiEvent["eventId"] })),
    });
    expect(paused.seq).toBe(4);
  });

  it("survives corrupt storage", async () => {
    localStorage.setItem("blocti:sei:v1", "{not json");
    expect(await createLocalPersistence().load()).toEqual(EMPTY_STATE);
  });
});

describe("legacy migration", () => {
  it("turns old reducer blocks (minutes) into plans (seconds)", () => {
    const raw = JSON.stringify([
      {
        id: "b1",
        name: "Study",
        plannedDuration: 90,
        createdAt: at(0),
        status: "paused",
        tasks: [
          { id: "t1", name: "Read", duration: 30, elapsed: 120, completed: false },
          { id: "t2", name: "Broken", duration: 0 },
        ],
      },
    ]);
    const { blocks, tasks } = migrateLegacyBlocks(raw);
    expect(blocks).toEqual([
      expect.objectContaining({ id: "b1", name: "Study", plannedDuration: 5400, taskIds: ["t1"] }),
    ]);
    expect(tasks).toEqual([
      { id: "t1", name: "Read", blockId: "b1", order: 0, plannedDuration: 1800 },
    ]);
  });

  it("ignores missing, corrupt or non-array data", () => {
    expect(migrateLegacyBlocks(null).blocks).toEqual([]);
    expect(migrateLegacyBlocks("{oops").blocks).toEqual([]);
    expect(migrateLegacyBlocks('{"a":1}').blocks).toEqual([]);
    expect(migrateLegacyBlocks('[null, {"id": 3}]').blocks).toEqual([]);
  });
});

describe("plan drafts", () => {
  it("converts minutes to seconds and drops empty tasks", () => {
    const { block, tasks } = planFromDraft(
      {
        name: "  Deep work ",
        plannedMinutes: 90,
        tasks: [
          { id: "a", name: "Write", minutes: 45 },
          { id: "b", name: "  ", minutes: 10 },
          { id: "c", name: "Zero", minutes: 0 },
        ],
      },
      { generateId: idSequence("blk"), now: at(0) },
    );
    expect(block).toMatchObject({
      id: "blk-1",
      name: "Deep work",
      plannedDuration: 5400,
      taskIds: ["a"],
      createdAt: at(0),
    });
    expect(tasks).toEqual([{ id: "a", name: "Write", blockId: "blk-1", order: 0, plannedDuration: 2700 }]);
  });

  it("round-trips through a draft for editing", () => {
    const draft = draftFromPlan(PLAN, PLAN_TASKS);
    expect(draft).toEqual({
      name: PLAN.name,
      plannedMinutes: 30,
      tasks: [
        { id: T1, name: "Read", minutes: 10 },
        { id: "task-2", name: "Write", minutes: 5 },
        { id: "task-3", name: "Review", minutes: 15 },
      ],
    });
    expect(planFromDraft(draft, PLAN)).toEqual({ block: PLAN, tasks: PLAN_TASKS });
  });

  it("duplicates a plan with fresh ids for a re-run", () => {
    const copy = duplicatePlan(PLAN, PLAN_TASKS, idSequence("new"), at(100));
    expect(copy.block.id).toBe("new-1");
    expect(copy.tasks.map((t) => [t.id, t.blockId, t.name])).toEqual([
      ["new-2", "new-1", "Read"],
      ["new-3", "new-1", "Write"],
      ["new-4", "new-1", "Review"],
    ]);
    expect(copy.block.taskIds).toEqual(["new-2", "new-3", "new-4"]);
  });
});
