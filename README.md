# BlocTi

Execution infrastructure for human + AI work (SEI). Plans say what you intend to do, events record what actually happened, and projections and metrics derive the truth from the events.

```
frontend/    React app + the SEI domain (frontend/src/sei/domain): events, projection, resolver, conformance, metrics
backend/     Express + Prisma/Postgres event store: POST /events, GET /events, /blocks
integrations/claude-code/   hook adapter that records Claude Code sessions as blocks
vr/          mixed-reality version for a headset (Immersive Web SDK), same engine; see vr/README.md
```

## What it measures

A plan is read as a procedure: a list of rules a run can be checked against.

- each task must be completed, unless it is marked optional
- each task has an importance: minor, required (the default) or critical
- the plan can require its tasks to be finished in order
- a finished task should land near its estimate (within 15% by default)

Fidelity is the result of that check. Every broken rule is listed as a deviation with the task, the time and the points it cost, so a score can always be traced back to what happened. The verdict comes from the worst deviation, not the score: skipping a critical task means the plan was not followed, even at 85%.

Claude Code sessions have no plan written ahead of the run, so they show turn completion instead and are never averaged with timed blocks.

## Run it

Frontend only (traces stay in browser localStorage):

```bash
cd frontend && npm install && npm run dev
```

With the backend (traces in Postgres, survive across browsers):

```bash
cd backend && npm install && cp .env.example .env   # set DATABASE_URL
npm run db:migrate && npm run dev                    # http://localhost:4000
cd ../frontend && VITE_API_URL=http://localhost:4000 npm run dev
```

Record Claude Code sessions automatically: see `integrations/claude-code/README.md`.

## Test

```bash
cd frontend && npm test     # domain, store and UI tests (Vitest + Testing Library)
cd backend && npm test      # API + hook adapter against a real Postgres test database
```

The backend tests create, migrate and wipe `TEST_DATABASE_URL` (default `bloc_ti_test`). They refuse to run against a database whose name does not contain "test".
