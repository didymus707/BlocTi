import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createPrisma } from "../src/db.js";
import { assertTestDatabase, TEST_DATABASE_URL } from "./testDb.js";
import {
  flushSpool,
  taskTitle,
  translate,
} from "../../integrations/claude-code/blocti-hook.mjs";
import { projectBlock } from "../../frontend/src/sei/domain/projection.js";
import { computeMetrics } from "../../frontend/src/sei/domain/metrics.js";
import type { SeiEvent } from "../../frontend/src/sei/domain/events.js";
import type { BlockPlan } from "../../frontend/src/sei/domain/plan.js";

const HOOK = resolve(__dirname, "../../integrations/claude-code/blocti-hook.mjs");
const SESSION = "abc123";

type HookInput = Record<string, unknown>;
const hook = (name: string, extra: HookInput = {}): HookInput => ({
  session_id: SESSION,
  transcript_path: "/tmp/t.jsonl",
  cwd: "/Users/me/code/blocTi",
  hook_event_name: name,
  ...extra,
});

// run a list of hooks through translate, numbering events like the server would
const run = (inputs: HookInput[], startSec = 0) => {
  let state = null;
  const all: Record<string, unknown>[] = [];
  let n = 0;
  inputs.forEach((input, i) => {
    const now = new Date(Date.UTC(2026, 10, 8, 9, 0, startSec + i * 60)).toISOString();
    const result = translate(state, input, now, { newId: () => `e${++n}` });
    state = result.state;
    all.push(...result.events);
  });
  const events = all.map((e, i) => ({ ...e, seq: i + 1, userId: "dev-user" })) as unknown as SeiEvent[];
  return { state: state as unknown as Record<string, any>, events };
};

const projectAgentBlock = (events: SeiEvent[], now: string) => {
  const blockId = events[0]!.blockId;
  const stub = { id: blockId, name: "", userId: "dev-user", taskIds: [], createdAt: now, plannedDuration: 0 } as unknown as BlockPlan;
  const projection = projectBlock(stub, [], events, now);
  return { projection, metrics: computeMetrics(projection, now) };
};

describe("translate (hook -> SEI events)", () => {
  it("maps a session's lifecycle onto block and task events", () => {
    const { events, state } = run([
      hook("SessionStart", { source: "startup" }),
      hook("UserPromptSubmit", { prompt: "Fix the login bug\nmore detail" }),
      hook("Stop", { stop_hook_active: false }),
      hook("UserPromptSubmit", { prompt: "Now add tests" }),
      hook("Stop"),
      hook("SessionEnd", { reason: "prompt_input_exit" }),
    ]);
    expect(events.map((e) => e.type)).toEqual([
      "BlockPlanned",
      "BlockStarted",
      "BlockPaused",
      "BlockPlanned",
      "TaskStarted",
      "TaskCompleted",
      "BlockPaused",
      "BlockPlanned",
      "TaskStarted",
      "TaskCompleted",
      "BlockPaused",
      "BlockCompleted",
    ]);
    expect(events.every((e) => e.blockId === "cc-abc123" && e.sessionId === SESSION)).toBe(true);
    expect(events.every((e) => e.actor === "agent" && e.source === "agent_hook")).toBe(true);
    expect(events.filter((e) => e.evidence === "inferred").map((e) => e.type)).toEqual([
      "BlockPaused",
      "BlockPaused",
      "BlockPaused",
    ]);
    expect(state.tasks.map((t: { title: string }) => t.title)).toEqual([
      "Fix the login bug",
      "Now add tests",
    ]);
    expect(state.ended).toBe(true);
  });

  it("produces a trace the SEI projection reads as a completed block", () => {
    const { events } = run([
      hook("SessionStart"), //  0s
      hook("UserPromptSubmit", { prompt: "one" }), // 60s: 60s waiting (inferred)
      hook("Stop"), // 120s: 60s agent focus
      hook("UserPromptSubmit", { prompt: "two" }), // 180s
      hook("UserPromptSubmit", { prompt: "three" }), // 240s: "two" was interrupted
      hook("Stop"), // 300s
      hook("SessionEnd"), // 360s
    ]);
    const { projection, metrics } = projectAgentBlock(events, "2026-11-08T10:00:00.000Z");
    expect(projection.status).toBe("completed");
    expect(projection.name).toBe("Claude Code · blocTi");
    expect(Object.values(projection.taskStates).map((t) => [t.title, t.status, t.elapsedSec])).toEqual([
      ["one", "completed", 60],
      ["two", "skipped", 60],
      ["three", "completed", 60],
    ]);
    expect(metrics.focusSec).toBe(180);
    expect(metrics.pauseSec).toBe(180);
    expect(metrics.inferredPauseSec).toBe(180);
    expect(metrics.unaccountedSec).toBe(0);
    // inferred plan: completion is by count, time accuracy is not measurable
    expect(metrics.fidelity?.completion).toBeCloseTo(2 / 3, 5);
    expect(metrics.fidelity?.timeAccuracy).toBe(1);
  });

  it("treats a session ending mid-turn as a skipped task", () => {
    const { events } = run([hook("SessionStart"), hook("UserPromptSubmit", { prompt: "x" }), hook("SessionEnd")]);
    expect(events.slice(-2).map((e) => [e.type, e.evidence])).toEqual([
      ["TaskSkipped", "inferred"],
      ["BlockCompleted", "observed"],
    ]);
  });

  it("records an API-error turn as skipped", () => {
    const { events } = run([hook("UserPromptSubmit", { prompt: "x" }), hook("StopFailure", { error: "overloaded" })]);
    expect(events.map((e) => e.type)).toContain("TaskSkipped");
  });

  it("keeps the same block across resume, compact and clear restarts of a live session", () => {
    const { events } = run([
      hook("SessionStart", { source: "startup" }),
      hook("SessionStart", { source: "compact" }),
      hook("SessionStart", { source: "resume" }),
    ]);
    expect(events.filter((e) => e.type === "BlockStarted")).toHaveLength(1);
  });

  it("opens a new block when an ended session is resumed", () => {
    const { events } = run([
      hook("SessionStart"),
      hook("SessionEnd"),
      hook("SessionStart", { source: "resume" }),
    ]);
    expect([...new Set(events.map((e) => e.blockId))]).toEqual(["cc-abc123", "cc-abc123-2"]);
  });

  it("creates the block on the first prompt if SessionStart was missed", () => {
    const { events } = run([hook("UserPromptSubmit", { prompt: "hi" })]);
    expect(events.map((e) => e.type)).toEqual([
      "BlockPlanned",
      "BlockStarted",
      "BlockPaused",
      "BlockPlanned",
      "TaskStarted",
    ]);
  });

  it("ignores Stop without a running turn and unknown hooks", () => {
    const { events } = run([hook("SessionStart"), hook("Stop"), hook("Notification", { message: "hi" })]);
    expect(events).toHaveLength(3);
  });

  it("spools one request per hook with a stable idempotency key", () => {
    const { state } = run([hook("SessionStart"), hook("UserPromptSubmit", { prompt: "x" })]);
    expect(state.spool.map((r: { key: string }) => r.key)).toEqual(["cc-abc123:1", "cc-abc123:2"]);
  });

  it("titles tasks from the prompt's first line, or generically", () => {
    expect(taskTitle("\n  Refactor the store  \nbecause", 1)).toBe("Refactor the store");
    expect(taskTitle("x".repeat(200), 1)).toHaveLength(80);
    expect(taskTitle("", 4)).toBe("Prompt 4");
    expect(taskTitle("secret plans", 2, "generic")).toBe("Prompt 2");
  });
});

describe("flushSpool", () => {
  const spooled = () => ({
    spool: [
      { key: "k1", events: [{ type: "BlockStarted" }] },
      { key: "k2", events: [{ type: "BlockPaused" }] },
    ],
  });

  it("keeps everything when the API is unreachable", async () => {
    const state = await flushSpool(spooled(), {
      apiUrl: "http://x",
      userId: "u",
      fetchImpl: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    expect(state.spool).toHaveLength(2);
  });

  it("drops a request the API rejects as invalid and carries on", async () => {
    const seen: string[] = [];
    const state = await flushSpool(spooled(), {
      apiUrl: "http://x",
      userId: "u",
      fetchImpl: async (_url: string, init: RequestInit) => {
        const key = (init.headers as Record<string, string>)["Idempotency-Key"]!;
        seen.push(key);
        return new Response("{}", { status: key === "k1" ? 422 : 201 });
      },
    });
    expect(seen).toEqual(["k1", "k2"]);
    expect(state.spool).toEqual([]);
  });

  it("stops at a server error to preserve order", async () => {
    const state = await flushSpool(spooled(), {
      apiUrl: "http://x",
      userId: "u",
      fetchImpl: async () => new Response("{}", { status: 503 }),
    });
    expect(state.spool.map((r: { key: string }) => r.key)).toEqual(["k1", "k2"]);
  });
});

describe("hook script end to end", () => {
  assertTestDatabase(TEST_DATABASE_URL);
  const prisma = createPrisma(TEST_DATABASE_URL);
  const app = createApp(prisma, { now: () => new Date(), maxClockSkewSec: 300 });
  const server = app.listen(0);
  const apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let stateDir = "";

  const fire = (input: HookInput, url = apiUrl) =>
    new Promise<{ code: number | null; stdout: string }>((done, fail) => {
      const child = spawn(process.execPath, [HOOK], {
        env: { ...process.env, BLOCTI_API_URL: url, BLOCTI_STATE_DIR: stateDir },
      });
      let stdout = "";
      child.stdout.on("data", (d) => (stdout += d));
      child.on("error", fail);
      child.on("close", (code) => done({ code, stdout }));
      child.stdin.end(JSON.stringify(input));
    });

  const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "Event", "Block", "IdempotencyRecord"');
    stateDir = await mkdtemp(join(tmpdir(), "blocti-hook-"));
  });

  afterAll(async () => {
    server.close();
    await prisma.$disconnect();
    if (stateDir) await rm(stateDir, { recursive: true, force: true });
  });

  it("records a coding session as a real block, silently, without a timer", async () => {
    for (const input of [
      hook("SessionStart", { source: "startup" }),
      hook("UserPromptSubmit", { prompt: "Write the adapter" }),
      hook("Stop"),
      hook("UserPromptSubmit", { prompt: "Add tests" }),
      hook("Stop"),
      hook("SessionEnd", { reason: "prompt_input_exit" }),
    ]) {
      const { code, stdout } = await fire(input);
      expect(code).toBe(0);
      expect(stdout).toBe(""); // nothing leaks into Claude's context
      await pause(30);
    }

    const res = await fetch(`${apiUrl}/events`);
    const { events } = (await res.json()) as { events: SeiEvent[] };
    expect(events).toHaveLength(12);
    expect(events.map((e) => e.seq)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));

    const { projection, metrics } = projectAgentBlock(events, new Date().toISOString());
    expect(projection.status).toBe("completed");
    expect(metrics.completedTasks).toBe(2);
    expect(metrics.focusSec).toBeGreaterThan(0);
    expect(metrics.inferredPauseSec).toBeGreaterThan(0);
  });

  it("spools events while the API is down and delivers them once, in order", async () => {
    const down = "http://127.0.0.1:9"; // nothing listens on the discard port
    expect((await fire(hook("SessionStart"), down)).code).toBe(0);
    expect((await fire(hook("UserPromptSubmit", { prompt: "offline" }), down)).code).toBe(0);
    const offline = JSON.parse(await readFile(join(stateDir, `${SESSION}.json`), "utf8"));
    expect(offline.spool).toHaveLength(2);

    await fire(hook("Stop"));
    // a duplicate delivery (e.g. two hooks racing) must not duplicate events
    const replay = offline.spool[0];
    const again = await fetch(`${apiUrl}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": replay.key },
      body: JSON.stringify({ events: replay.events }),
    });
    expect(again.status).toBe(200);

    const { events } = (await (await fetch(`${apiUrl}/events`)).json()) as { events: SeiEvent[] };
    expect(events.map((e) => e.type)).toEqual([
      "BlockPlanned",
      "BlockStarted",
      "BlockPaused",
      "BlockPlanned",
      "TaskStarted",
      "TaskCompleted",
      "BlockPaused",
    ]);
    const after = JSON.parse(await readFile(join(stateDir, `${SESSION}.json`), "utf8"));
    expect(after.spool).toEqual([]);
  });

  it("exits 0 on garbage input", async () => {
    const child = spawn(process.execPath, [HOOK], { env: { ...process.env, BLOCTI_STATE_DIR: stateDir } });
    const code = await new Promise((done) => {
      child.on("close", done);
      child.stdin.end("not json");
    });
    expect(code).toBe(0);
  });
});
