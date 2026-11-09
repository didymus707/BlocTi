# BlocTi × Claude Code

`blocti-hook.mjs` turns every Claude Code session into a BlocTi block, with no timer involved.

| Hook | Events posted |
| --- | --- |
| `SessionStart` | `BlockPlanned` (empty plan), `BlockStarted`, `BlockPaused` *(inferred: waiting for a prompt)* |
| `UserPromptSubmit` | `BlockPlanned` (plan + this prompt as a task), `TaskStarted` *(a still-running previous turn is `TaskSkipped`, inferred)* |
| `Stop` | `TaskCompleted`, `BlockPaused` *(inferred)* |
| `StopFailure` | `TaskSkipped`, `BlockPaused` *(inferred)* |
| `SessionEnd` | `BlockCompleted` |

Every event is `actor: "agent"`, `source: "agent_hook"`. Pauses are marked `evidence: "inferred"` because nobody saw the human stop working. The adapter deduces it. The plan is inferred afterwards: each prompt becomes a task with no estimate. For agent sessions, fidelity therefore only means how many turns ran to completion, and the app never averages it with timed blocks.

The script prints nothing and always exits 0, so it never blocks Claude or adds to its context. If the API is down, requests wait in `~/.blocti/claude-code/<session>.json` and are sent with the next hook. They keep the same `Idempotency-Key`, so they are never stored twice.

## Setup

1. Run the API: `cd backend && npm run dev` (needs Postgres, see the root README).
2. Add the hooks to `~/.claude/settings.json` (all projects) or a project's `.claude/settings.local.json`. Replace the path with where this repo lives:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "node /ABSOLUTE/PATH/TO/blocTi/integrations/claude-code/blocti-hook.mjs", "timeout": 5 }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node /ABSOLUTE/PATH/TO/blocTi/integrations/claude-code/blocti-hook.mjs", "timeout": 5 }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "node /ABSOLUTE/PATH/TO/blocTi/integrations/claude-code/blocti-hook.mjs", "timeout": 5 }] }],
    "StopFailure": [{ "hooks": [{ "type": "command", "command": "node /ABSOLUTE/PATH/TO/blocTi/integrations/claude-code/blocti-hook.mjs", "timeout": 5 }] }],
    "SessionEnd": [{ "hooks": [{ "type": "command", "command": "node /ABSOLUTE/PATH/TO/blocTi/integrations/claude-code/blocti-hook.mjs", "timeout": 5 }] }]
  }
}
```

Keep the hooks **synchronous** (no `"async": true`). Each call takes a few milliseconds against a local API, with a 1.5s network cap. Running synchronously keeps one session's events in order. The `timeout` of 5 also lifts `SessionEnd` above its 1.5s default budget.

3. Use Claude Code as usual. Open BlocTi with `VITE_API_URL=http://localhost:4000` and each session shows up as a read-only block named `Claude Code · <folder>`.

## Options (environment variables)

| Variable | Default | |
| --- | --- | --- |
| `BLOCTI_API_URL` | `http://localhost:4000` | BlocTi API |
| `BLOCTI_USER_ID` | `dev-user` | sent as `X-User-Id` |
| `BLOCTI_STATE_DIR` | `~/.blocti/claude-code` | per-session state and spool |
| `BLOCTI_TASK_TITLES` | `prompt` | `generic` titles tasks "Prompt N" instead of storing prompt text |
| `BLOCTI_DEBUG` | unset | `1` logs to `$BLOCTI_STATE_DIR/hook.log` |

## Limits

- `Stop` does not fire when you interrupt Claude (Esc). The interrupted turn is closed as skipped when the next prompt arrives, and its focus time runs until then.
- The server rejects `occurredAt` more than `MAX_CLOCK_SKEW_SEC` (default 5 min) from its own clock. Spooled events older than that are dropped when they finally send.
- Hooks were checked against the Claude Code hooks reference on 2026-11-08 (event names, stdin fields, exit-code semantics).

Tests: `backend/test/hookAdapter.test.ts` (unit tests, plus end-to-end runs of this script against a live API).
