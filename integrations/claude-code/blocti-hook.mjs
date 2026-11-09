#!/usr/bin/env node
// BlocTi adapter for Claude Code hooks.
//
// Turns a Claude Code session into an SEI trace without touching a timer:
//   SessionStart      -> BlockPlanned (empty plan) + BlockStarted + BlockPaused (inferred)
//   UserPromptSubmit  -> BlockPlanned (plan + this prompt as a task) + TaskStarted
//   Stop              -> TaskCompleted + BlockPaused (inferred: waiting for the human)
//   StopFailure       -> TaskSkipped + BlockPaused (inferred)
//   SessionEnd        -> BlockCompleted
// One Claude Code session = one block; one prompt = one task. The plan is
// inferred afterwards: prompts carry no estimates.
//
// Never blocks Claude: prints nothing, always exits 0. If the BlocTi API is
// down, requests wait in the session's state file and go out with the next
// hook (same Idempotency-Key, so a retry never duplicates an event).
//
// Env: BLOCTI_API_URL (default http://localhost:4000), BLOCTI_USER_ID,
//      BLOCTI_STATE_DIR (default ~/.blocti/claude-code),
//      BLOCTI_TASK_TITLES=prompt|generic, BLOCTI_DEBUG=1 (log to state dir)

import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const OBSERVED = { actor: "agent", source: "agent_hook", evidence: "observed" };
const INFERRED = { ...OBSERVED, evidence: "inferred" };
const WAITING = "waiting for prompt";

export const taskTitle = (prompt, n, mode = "prompt") => {
  if (mode === "generic") return `Prompt ${n}`;
  const firstLine = String(prompt ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return `Prompt ${n}`;
  return firstLine.length > 80 ? `${firstLine.slice(0, 79)}…` : firstLine;
};

/**
 * Pure: hook input + previous state -> next state + events to post.
 * @param {object | null} previous state from the last hook of this session
 * @param {object} input the hook's stdin JSON
 * @param {string} now ISO time of this hook
 * @param {{ titles?: string, newId?: () => string }} [options]
 */
export function translate(previous, input, now, options = {}) {
  const newId = options.newId ?? randomUUID;
  let state = previous ? structuredClone(previous) : null;
  const events = [];

  const event = (fields, provenance = OBSERVED) => ({
    eventId: newId(),
    blockId: state.blockId,
    sessionId: input.session_id,
    occurredAt: now,
    ...provenance,
    ...fields,
  });
  const planned = () =>
    event({ type: "BlockPlanned", name: state.name, plannedDuration: 0, tasks: state.tasks });

  const startBlock = () => {
    const generation = (state?.generation ?? 0) + 1;
    state = {
      sessionId: input.session_id,
      generation,
      blockId: `cc-${input.session_id}${generation > 1 ? `-${generation}` : ""}`,
      name: `Claude Code · ${basename(input.cwd ?? "") || "session"}`,
      tasks: [],
      promptCount: 0,
      activeTaskId: null,
      ended: false,
      requestCount: state?.requestCount ?? 0,
      spool: state?.spool ?? [],
    };
    events.push(
      planned(),
      event({ type: "BlockStarted" }),
      event({ type: "BlockPaused", reason: WAITING }, INFERRED),
    );
  };

  switch (input.hook_event_name) {
    case "SessionStart": {
      // resume/compact/clear of a live session keep the same block
      if (!state || state.ended) startBlock();
      break;
    }
    case "UserPromptSubmit": {
      if (!state || state.ended) startBlock();
      if (state.activeTaskId) {
        // the previous turn never reported Stop: it was interrupted
        events.push(event({ type: "TaskSkipped", taskId: state.activeTaskId }, INFERRED));
      }
      const n = ++state.promptCount;
      const taskId = `${state.blockId}:p${n}`;
      state.tasks.push({ taskId, title: taskTitle(input.prompt, n, options.titles), plannedDuration: 0 });
      events.push(planned(), event({ type: "TaskStarted", taskId }));
      state.activeTaskId = taskId;
      break;
    }
    case "Stop":
    case "StopFailure": {
      if (!state || state.ended || !state.activeTaskId) break;
      const type = input.hook_event_name === "Stop" ? "TaskCompleted" : "TaskSkipped";
      events.push(
        event({ type, taskId: state.activeTaskId }),
        event({ type: "BlockPaused", reason: WAITING }, INFERRED),
      );
      state.activeTaskId = null;
      break;
    }
    case "SessionEnd": {
      if (!state || state.ended) break;
      if (state.activeTaskId) {
        events.push(event({ type: "TaskSkipped", taskId: state.activeTaskId }, INFERRED));
      }
      events.push(event({ type: "BlockCompleted" }));
      state.activeTaskId = null;
      state.ended = true;
      break;
    }
    default:
      break;
  }

  if (state && events.length > 0) {
    state.requestCount += 1;
    state.spool.push({ key: `${state.blockId}:${state.requestCount}`, events });
  }
  return { state, events };
}

/**
 * Posts spooled requests in order. Stops at the first network/server error
 * (kept for next time); drops requests the server rejects as invalid.
 */
export async function flushSpool(state, { apiUrl, userId, fetchImpl = fetch, log = () => {} }) {
  while (state.spool.length > 0) {
    const request = state.spool[0];
    let response;
    try {
      response = await fetchImpl(`${apiUrl}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": request.key,
          "X-User-Id": userId,
        },
        body: JSON.stringify({ events: request.events }),
        signal: AbortSignal.timeout(1500),
      });
    } catch (error) {
      log(`network error, keeping ${state.spool.length} request(s): ${error.message}`);
      return state;
    }
    if (response.status >= 500 || response.status === 429) {
      log(`server error ${response.status}, keeping ${state.spool.length} request(s)`);
      return state;
    }
    if (!response.ok) {
      log(`dropped ${request.key}: ${response.status} ${await response.text()}`);
    }
    state.spool.shift();
  }
  return state;
}

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};

async function main() {
  const dir = process.env.BLOCTI_STATE_DIR ?? join(homedir(), ".blocti", "claude-code");
  const log = async (message) => {
    if (!process.env.BLOCTI_DEBUG) return;
    await appendFile(join(dir, "hook.log"), `${new Date().toISOString()} ${message}\n`).catch(() => {});
  };
  try {
    const input = JSON.parse(await readStdin());
    if (!input?.session_id || !input?.hook_event_name) return;
    await mkdir(dir, { recursive: true });

    const file = join(dir, `${String(input.session_id).replace(/[^\w.-]/g, "_")}.json`);
    const previous = await readFile(file, "utf8").then(JSON.parse).catch(() => null);
    const { state } = translate(previous, input, new Date().toISOString(), {
      titles: process.env.BLOCTI_TASK_TITLES,
    });
    if (!state) return;

    await flushSpool(state, {
      apiUrl: (process.env.BLOCTI_API_URL ?? "http://localhost:4000").replace(/\/$/, ""),
      userId: process.env.BLOCTI_USER_ID ?? "dev-user",
      log,
    });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(state));
    await rename(tmp, file);
    await log(`${input.hook_event_name} -> ${state.blockId} (${state.spool.length} pending)`);
  } catch (error) {
    await log(`error: ${error?.stack ?? error}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().finally(() => process.exit(0));
}
