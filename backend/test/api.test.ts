import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createPrisma } from "../src/db.js";
import { assertTestDatabase, TEST_DATABASE_URL } from "./testDb.js";
// contract: the frontend's own event builders must pass server validation
import {
  ev,
  sequence,
  started,
} from "../../frontend/src/sei/domain/__tests__/builders.js";
import { SEI_EVENT_TYPES } from "../../frontend/src/sei/domain/events.js";

assertTestDatabase(TEST_DATABASE_URL);
const prisma = createPrisma(TEST_DATABASE_URL);

const SERVER_NOW = new Date("2026-11-08T09:00:00.000Z");
let serverNow = SERVER_NOW;
const app = createApp(prisma, { now: () => serverNow, maxClockSkewSec: 300 });

const at = (sec: number) => new Date(SERVER_NOW.getTime() + sec * 1000).toISOString();

// what the frontend sends: client eventId + occurredAt, no seq
const wire = (events: ReturnType<typeof sequence>) =>
  events.map(({ seq: _seq, ...e }) => e);

const post = (events: unknown[], key = crypto.randomUUID(), user?: string) => {
  const req = request(app).post("/events").set("Idempotency-Key", key);
  if (user) req.set("X-User-Id", user);
  return req.send({ events });
};

const block = (id: string, extra: Record<string, unknown> = {}) => ({
  ...wire(sequence(ev.blockStarted(0)))[0],
  blockId: id,
  eventId: crypto.randomUUID(),
  ...extra,
});

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  serverNow = SERVER_NOW;
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Event", "Block", "IdempotencyRecord"',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /events", () => {
  it("stores a command's events with server-assigned seq and recordedAt", async () => {
    serverNow = new Date(at(2));
    const res = await post(wire(sequence(...started(0))));
    expect(res.status).toBe(201);
    expect(res.headers["idempotent-replayed"]).toBe("false");
    expect(res.body.events.map((e: { seq: number }) => e.seq)).toEqual([1, 2, 3]);
    expect(res.body.events[0]).toMatchObject({
      type: "BlockPlanned",
      name: "Morning block",
      plannedDuration: 1800,
      occurredAt: at(0),
      recordedAt: at(2),
      actor: "human",
      source: "timer",
      evidence: "observed",
    });
    expect(res.body.events[0].tasks).toHaveLength(3);
    expect(res.body.events[2]).toMatchObject({ type: "TaskStarted", taskId: "task-1" });
  });

  it("continues seq per block across requests and keeps blocks independent", async () => {
    await post(wire(sequence(...started(0))));
    const next = await post([block("block-1", { type: "BlockPaused", occurredAt: at(10) })]);
    expect(next.body.events[0].seq).toBe(4);
    const other = await post([block("block-2")]);
    expect(other.body.events[0].seq).toBe(1);
  });

  it("fills in eventId and occurredAt from the server when absent", async () => {
    const { eventId: _id, occurredAt: _at, ...bare } = block("block-1");
    const res = await post([bare]);
    expect(res.status).toBe(201);
    expect(res.body.events[0].eventId).toMatch(/[0-9a-f-]{36}/);
    expect(res.body.events[0].occurredAt).toBe(SERVER_NOW.toISOString());
  });

  it("uses the caller's user id, not the one in the body", async () => {
    const res = await post([block("block-1", { userId: "someone-else" })], undefined, "alice");
    expect(res.body.events[0].userId).toBe("alice");
  });

  describe("idempotency", () => {
    it("replays the original result for a repeated key without storing again", async () => {
      const events = wire(sequence(...started(0)));
      const first = await post(events, "key-1");
      const again = await post(events, "key-1");
      expect(again.status).toBe(200);
      expect(again.headers["idempotent-replayed"]).toBe("true");
      expect(again.body.events).toEqual(first.body.events);
      expect(await prisma.event.count()).toBe(3);
    });

    it("rejects a reused key with a different body", async () => {
      await post(wire(sequence(...started(0))), "key-1");
      const res = await post([block("block-1", { type: "BlockPaused", occurredAt: at(5) })], "key-1");
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("idempotency_key_reused");
    });

    it("stores concurrent duplicates exactly once", async () => {
      const events = wire(sequence(...started(0)));
      const results = await Promise.all(Array.from({ length: 6 }, () => post(events, "same-key")));
      expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 200, 201]);
      const ids = results.map((r) => r.body.events.map((e: { eventId: string }) => e.eventId).join());
      expect(new Set(ids).size).toBe(1);
      expect(await prisma.event.count()).toBe(3);
    });

    it("keys are scoped per user", async () => {
      await post([block("block-a")], "shared-key", "alice");
      const res = await post([block("block-b")], "shared-key", "bob");
      expect(res.status).toBe(201);
    });

    it("rejects the same eventId under a different key", async () => {
      const event = block("block-1");
      await post([event], "key-1");
      const res = await post([event], "key-2");
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("duplicate_event");
    });
  });

  it("gives concurrent writers to one block gap-free, unique seqs", async () => {
    const writes = Array.from({ length: 8 }, () =>
      post([block("busy-block", { type: "BlockPaused" })]),
    );
    const results = await Promise.all(writes);
    expect(results.every((r) => r.status === 201)).toBe(true);
    const seqs = results.map((r) => r.body.events[0].seq).sort((a, b) => a - b);
    expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  describe("time", () => {
    it("rejects occurredAt too far in the future or past", async () => {
      const future = await post([block("b", { occurredAt: at(301) })]);
      expect(future.status).toBe(422);
      expect(future.body.code).toBe("clock_skew");
      const past = await post([block("b", { occurredAt: at(-301) })]);
      expect(past.status).toBe(422);
      expect(await prisma.event.count()).toBe(0);
    });

    it("accepts occurredAt within the skew window", async () => {
      expect((await post([block("b", { occurredAt: at(-299) })])).status).toBe(201);
    });

    it("rejects an event earlier than the block's last event", async () => {
      await post([block("b", { occurredAt: at(100) })]);
      const res = await post([block("b", { type: "BlockPaused", occurredAt: at(50) })]);
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("out_of_order");
    });

    it("rejects time going backwards inside one request", async () => {
      const res = await post([
        block("b", { occurredAt: at(10) }),
        block("b", { type: "BlockPaused", occurredAt: at(5) }),
      ]);
      expect(res.status).toBe(422);
    });
  });

  describe("validation", () => {
    it("requires an Idempotency-Key header", async () => {
      const res = await request(app).post("/events").send({ events: [block("b")] });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("missing_idempotency_key");
    });

    it.each([
      ["an empty list", { events: [] }],
      ["an unknown type", { events: [block("b", { type: "TaskExploded" })] }],
      ["a missing field", { events: [block("b", { type: "TaskStarted" })] }],
      ["an unknown field", { events: [block("b", { mood: "great" })] }],
      ["a client seq", { events: [block("b", { seq: 1 })] }],
      ["a bad actor", { events: [block("b", { actor: "robot" })] }],
      ["a bad timestamp", { events: [block("b", { occurredAt: "yesterday" })] }],
      ["events for two blocks", { events: [block("b1"), block("b2")] }],
      ["a negative duration", { events: [{ ...wire(sequence(ev.planned(0)))[0], plannedDuration: -5 }] }],
    ])("rejects %s", async (_name, body) => {
      const res = await request(app).post("/events").set("Idempotency-Key", "k").send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("invalid_request");
      expect(await prisma.event.count()).toBe(0);
    });

    it("rejects malformed JSON", async () => {
      const res = await request(app)
        .post("/events")
        .set("Idempotency-Key", "k")
        .set("Content-Type", "application/json")
        .send("{nope");
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("invalid_json");
    });

    it("accepts every event type the frontend can produce", async () => {
      const all = sequence(
        ...started(0),
        ev.taskPaused("task-1" as never, 1),
        ev.taskResumed("task-1" as never, 2),
        ev.blockPaused(3),
        ev.blockResumed(4),
        ev.taskSwitched("task-1" as never, "task-2" as never, 5),
        ev.taskSkipped("task-3" as never, 6),
        ev.taskCompleted("task-2" as never, 7),
        ev.blockCompleted(8),
        ev.terminated(9),
      );
      expect(new Set(all.map((e) => e.type))).toEqual(new Set(SEI_EVENT_TYPES));
      const res = await post(wire(all));
      expect(res.status).toBe(201);
      // round trip: what comes back is what went in, plus server fields
      // (userId is always the caller's, checked above)
      res.body.events.forEach((stored: Record<string, unknown>, i: number) => {
        const { seq: _seq, userId: _userId, ...sent } = all[i]!;
        expect(stored).toMatchObject(sent);
      });
    });
  });

  it("refuses to append to another user's block", async () => {
    await post([block("alices")], undefined, "alice");
    const res = await post([block("alices", { type: "BlockPaused" })], undefined, "mallory");
    expect(res.status).toBe(403);
  });

  it("keeps events append-only in the database", async () => {
    await post([block("b")]);
    await expect(prisma.event.updateMany({ data: { type: "BlockCompleted" } })).rejects.toThrow(
      /append-only/,
    );
  });
});

describe("GET /events", () => {
  it("returns the caller's events ordered by block and seq, optionally filtered", async () => {
    await post([block("b2")]);
    await post(wire(sequence(...started(0))));
    await post([block("theirs")], undefined, "bob");

    const all = await request(app).get("/events");
    expect(all.body.events.map((e: { blockId: string; seq: number }) => `${e.blockId}#${e.seq}`)).toEqual([
      "b2#1",
      "block-1#1",
      "block-1#2",
      "block-1#3",
    ]);
    const one = await request(app).get("/events").query({ blockId: "b2" });
    expect(one.body.events).toHaveLength(1);
  });
});

describe("/blocks", () => {
  const plan = {
    block: {
      id: "block-1",
      name: "Morning",
      userId: "dev-user",
      taskIds: ["t1", "t2"],
      createdAt: at(0),
      plannedDuration: 1800,
    },
    tasks: [
      { id: "t2", name: "Write", blockId: "block-1", order: 1, plannedDuration: 600 },
      { id: "t1", name: "Read", blockId: "block-1", order: 0, plannedDuration: 1200 },
    ],
  };

  it("saves and lists a plan with tasks in order", async () => {
    expect((await request(app).put("/blocks/block-1").send(plan)).status).toBe(200);
    const res = await request(app).get("/blocks");
    expect(res.body.blocks).toEqual([{ ...plan.block, taskIds: ["t1", "t2"] }]);
    expect(res.body.tasks.map((t: { id: string }) => t.id)).toEqual(["t1", "t2"]);
  });

  it("updates an existing plan in place", async () => {
    await request(app).put("/blocks/block-1").send(plan);
    await request(app)
      .put("/blocks/block-1")
      .send({ ...plan, block: { ...plan.block, name: "Renamed" }, tasks: [plan.tasks[1]] });
    const res = await request(app).get("/blocks");
    expect(res.body.blocks[0].name).toBe("Renamed");
    expect(res.body.tasks).toHaveLength(1);
  });

  it("rejects mismatched ids", async () => {
    expect((await request(app).put("/blocks/other").send(plan)).status).toBe(400);
    const badTask = { ...plan, tasks: [{ ...plan.tasks[0], blockId: "other" }] };
    expect((await request(app).put("/blocks/block-1").send(badTask)).status).toBe(400);
  });

  it("hides and protects other users' plans", async () => {
    await request(app).put("/blocks/block-1").send(plan);
    expect((await request(app).get("/blocks").set("X-User-Id", "bob")).body.blocks).toEqual([]);
    expect((await request(app).put("/blocks/block-1").set("X-User-Id", "bob").send(plan)).status).toBe(403);
    expect((await request(app).delete("/blocks/block-1").set("X-User-Id", "bob")).status).toBe(403);
  });

  it("deleting a block deletes its plan, trace and idempotency records", async () => {
    await request(app).put("/blocks/block-1").send(plan);
    await post(wire(sequence(...started(0))), "key-1");
    expect((await request(app).delete("/blocks/block-1")).status).toBe(204);
    expect(await prisma.block.count()).toBe(0);
    expect(await prisma.event.count()).toBe(0);
    expect(await prisma.idempotencyRecord.count()).toBe(0);
  });
});

it("answers unknown routes with 404 JSON", async () => {
  const res = await request(app).get("/nope");
  expect(res.status).toBe(404);
  expect(res.body.code).toBe("not_found");
});
