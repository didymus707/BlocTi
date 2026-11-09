# BlocTi

Execution infrastructure for human + AI work (SEI). Plans say what you intend to do, events record what actually happened, and projections and metrics derive the truth from the events.

```
frontend/    React app + the SEI domain (frontend/src/sei/domain): events, projection, resolver, metrics
backend/     Express + Prisma/Postgres event store: POST /events, GET /events, /blocks
integrations/claude-code/   hook adapter that records Claude Code sessions as blocks
```

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
