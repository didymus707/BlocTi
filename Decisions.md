# Decisions

A running log of important engineering, product, and architecture decisions made while building **BlocTi SEI**.

The goal of this file is not just to record what was chosen, but also **why** it was chosen, what alternatives were considered, and what trade-offs were accepted.

---

## How to use this file

For each meaningful decision, capture:

* **Decision** — what was chosen
* **Status** — proposed, accepted, superseded, or rejected
* **Date** — when the decision was made
* **Context** — what problem or tension led to the decision
* **Options considered** — alternatives that were on the table
* **Chosen approach** — the final decision
* **Why** — reasoning behind the choice
* **Trade-offs** — what this decision improves and what it sacrifices
* **Consequences** — what this means for future implementation
* **Follow-up** — anything to revisit later

---

# Decision Log

## DEC-001 — BlocTi is Execution Infrastructure, not a timer app

* **Status:** Accepted
* **Date:** 2026-04-21

### Context

BlocTi began with timer-oriented behavior, but the long-term direction became clearer: the real value is not simple timing, but modeling, replaying, and understanding how work is actually executed.

### Options considered

1. Keep BlocTi positioned as a productivity timer
2. Reframe BlocTi as a task manager
3. Reframe BlocTi as Execution Infrastructure for Human + AI Workflows

### Chosen approach

BlocTi is positioned as **Execution Infrastructure for Human + AI Workflows (SEI)**.

### Why

This better matches the architecture being built:

* plans define intended work
* events record actual execution
* projections derive current truth
* metrics explain execution quality

It also creates a stronger long-term foundation for enterprise relevance and technical defensibility.

### Trade-offs

* Harder to explain quickly than “timer app”
* Requires more rigorous architecture and naming
* Raises the bar for implementation quality

### Consequences

* Product language should avoid framing BlocTi as “just a timer”
* Core architecture decisions should support deterministic replay and execution analysis
* Future features should align with execution intelligence, not generic productivity clutter

### Follow-up

Continue refining product narrative so it is clear to both technical and non-technical audiences.

---

## DEC-002 — Separate Plan, Events, and Projection

* **Status:** Accepted
* **Date:** 2026-04-21

### Context

The original implementation mixed mutable UI state, execution state, and derived timing information. That made reasoning, replay, and extension difficult.

### Options considered

1. Keep mutable UI-driven state as primary truth
2. Store everything directly in block/task React state
3. Separate plan data, event history, and derived projection

### Chosen approach

Use three distinct layers:

* **Plan** = intended structure of work
* **Events** = facts that happened during execution
* **Projection** = current derived execution truth

### Why

This separation makes the system easier to reason about and allows deterministic replay.

### Trade-offs

* More types and concepts to learn
* More architectural upfront work
* Slower early progress compared to direct UI mutation

### Consequences

* BlockPlan and TaskPlan define intention
* SeiEvents represent execution facts
* projectBlock(...) derives current execution state from plan + events

### Follow-up

Document this model clearly in future internal docs so returning to the codebase is easier after a break.

---

## DEC-003 — Build projection before resolver

* **Status:** Accepted
* **Date:** 2026-04-21

### Context

There was a choice between implementing command resolution first or deriving current execution truth first.

### Options considered

1. Build resolver first
2. Build projector first

### Chosen approach

Build the **projector first**.

### Why

The resolver needs a reliable way to understand the current state before it can validate commands and emit correct events.

### Trade-offs

* Delays visible command handling work
* Requires more modeling upfront

### Consequences

* `projectBlock(...)` became the first major domain engine
* Resolver logic can now validate commands against projected truth instead of UI assumptions

### Follow-up

Keep the projector as the canonical state derivation function.

---

## DEC-004 — Projection should receive full task plans, not only task IDs

* **Status:** Accepted
* **Date:** 2026-04-21

### Context

Initial projection work revealed that task IDs alone were not enough to compute remaining time, progress, or ordered execution state.

### Options considered

1. Project from `BlockPlan.taskIds` only
2. Embed task plans into BlockPlan
3. Pass BlockPlan and TaskPlan[] separately into the projector

### Chosen approach

`projectBlock(...)` receives:

* `block: BlockPlan`
* `tasks: TaskPlan[]`
* `events: SeiEvent[]`

### Why

The projector needs access to planned duration and task ordering to derive meaningful execution state.

### Trade-offs

* Slightly wider function signature
* Requires the caller to provide task plans explicitly

### Consequences

* Projection can compute `remainingSec`, `progress`, and ordered task behavior correctly

### Follow-up

Revisit later whether BlockPlan should eventually embed tasks directly.

---

## DEC-005 — elapsedSec means focus time, not wall-clock time

* **Status:** Accepted
* **Date:** 2026-04-21

### Context

There was ambiguity around whether elapsed time should represent total real-world duration or only active work time.

### Options considered

1. Use elapsed time as wall-clock duration
2. Use elapsed time as focus time only
3. Mix both under one field

### Chosen approach

`elapsedSec` in projection means **focus time only**.

### Why

Projection should support execution truth for active work. Wall-clock duration, pause time, and execution drift are better derived as metrics on top of the execution trace.

### Trade-offs

* Requires additional metrics later for full execution analysis
* Means “elapsed” must be clearly understood and documented

### Consequences

* `remainingSec` is based on planned duration minus focus time
* `progress` is based on focus time, not wall-clock time
* metrics layer will later derive pause time, wall-clock duration, and drift

### Follow-up

Add explicit metrics definitions for wall-clock duration, pause time, and execution drift.

---

## DEC-006 — Focus time is derived from running intervals

* **Status:** Accepted
* **Date:** 2026-04-21

### Context

To make timing deterministic, the system needed a rule for how elapsed time is derived.

### Options considered

1. Increment counters in mutable runtime state
2. Store live elapsed time directly as truth
3. Derive focus time from timestamps between lifecycle events

### Chosen approach

Focus time is derived as the **sum of running intervals**.

### Why

This supports deterministic replay and keeps the event stream as the source of truth.

### Trade-offs

* More replay logic in the projector
* Requires careful handling of pause, resume, completion, and live in-progress time

### Consequences

* `TaskStarted` opens a running segment
* `TaskPaused` closes a running segment and adds elapsed time
* `TaskResumed` opens a new running segment
* `TaskCompleted` closes the final running segment
* `now` is used only to derive live in-progress elapsed time after replay

### Follow-up

Consider extracting repeated timing calculations into helpers once the behavior stabilizes.

---

## DEC-007 — SessionTerminated belongs in the execution event union

* **Status:** Accepted
* **Date:** 2026-04-21

### Context

TypeScript revealed a mismatch when `SessionTerminated` was modeled separately from the replayed event union.

### Options considered

1. Keep SessionEvent outside the main execution event union
2. Include SessionEvent inside the unified replayable execution event union

### Chosen approach

Include `SessionTerminated` inside the event union replayed by the projector.

### Why

The projector replays one execution history. Session termination is part of that history and should be represented in the same replayable union.

### Trade-offs

* Slightly broader event union
* Requires cleaner naming and thinking around event categories

### Consequences

* The projector can cleanly handle `SessionTerminated`
* Type narrowing works correctly in switch statements

### Follow-up

Keep conceptual event categories, but ensure replayed events belong to one coherent execution stream.

---

## DEC-008 — Resolver returns event payloads, not fully materialized events

* **Status:** Accepted
* **Date:** 2026-04-21

### Context

Generating `eventId` and `seq` inside `resolveCommand(...)` made the resolver impure and structurally non-deterministic.

### Options considered

1. Generate `eventId` and `seq` inside resolver
2. Make resolver return payloads without metadata and let append/store layer enrich them

### Chosen approach

The resolver returns **event payloads without `eventId` and `seq`**.

### Why

This keeps the resolver focused on domain logic while leaving stream metadata assignment to the append boundary.

### Trade-offs

* Requires an additional append/enrichment step
* Adds one more piece to the execution pipeline

### Consequences

* Resolver stays closer to pure domain logic
* Event metadata assignment becomes a separate responsibility

### Follow-up

Implement append/enrichment layer for assigning `eventId` and `seq`.

---

## DEC-009 — Resolver validates commands using projected truth

* **Status:** Accepted
* **Date:** 2026-04-21

### Context

There was a choice between trusting the UI to pass task IDs and state assumptions, or deriving command validity from projected state.

### Options considered

1. Trust UI state directly
2. Use projector output as the source of current truth for resolver validation

### Chosen approach

The resolver validates commands against **projected state**.

### Why

Projected state is derived from the event history and is therefore more reliable than potentially stale UI assumptions.

### Trade-offs

* Requires projector to be stable and correct
* Adds an extra conceptual step before event emission

### Consequences

* Commands like PauseTask and ResumeTask act on `activeTaskId` from projection, not task IDs guessed by the UI
* Resolver now has a clear role: validate intent against current truth, then emit events

### Follow-up

Continue refining command shapes so they express intent rather than restating current derived state.

---

## DEC-010 — Auto-advance after task completion emits TaskStarted for the next task

* **Status:** Accepted
* **Date:** 2026-04-21

### Context

There was a semantic question about whether auto-advance after completion should emit `TaskSwitched` or `TaskStarted`.

### Options considered

1. Emit `TaskSwitched` after `TaskCompleted`
2. Emit `TaskStarted` for the next task after `TaskCompleted`

### Chosen approach

After `TaskCompleted`, emit `TaskStarted` for the next task if one exists. Otherwise emit `BlockCompleted`.

### Why

This keeps event semantics cleaner:

* `TaskStarted` = a task began
* `TaskCompleted` = a task ended normally
* `TaskSwitched` can be reserved for explicit mid-task switching

### Trade-offs

* Loses a single combined “switch” fact for auto-advance
* Requires careful interpretation of automatic vs manual progression later if needed

### Consequences

* Resolver event stories are easier to read and explain
* Debugging and documentation become clearer

### Follow-up

Reserve `TaskSwitched` for explicit user-driven switching between incomplete tasks.

---

# Open Questions

## OPEN-001 — Should TaskExecutionState include a better status than `pending` for previously-started but currently inactive tasks?

* Current workaround uses `pending` to mean “not currently active” in some projection paths.
* Possible later improvement: introduce `inactive` or `ready`.

## OPEN-002 — Should BlockPlan eventually embed task plans directly?

* Current approach passes BlockPlan and TaskPlan[] separately.
* This is working, but may be revisited later.

## OPEN-003 — Where should event metadata assignment live exactly?

* Current direction: append/store layer
* Needs implementation

## OPEN-004 — How should wall-clock time, pause time, and execution drift be represented in the metrics layer?

* Current projection only tracks focus time
* Richer execution analysis remains for a later stage

---

# Rules for future decisions

When making future architecture decisions for BlocTi SEI:

1. Prefer **determinism** over convenience
2. Prefer **clear domain semantics** over shortcut naming
3. Keep **plan, event, and projection responsibilities separate**
4. Let commands express **intent**, not mutable UI assumptions
5. Keep event streams as the **source of truth**
6. Add complexity only when the simpler model clearly breaks

---

# Personal note

This file is also part of the learning process.

The goal is not to pretend decisions were obvious. The goal is to build the habit of thinking like an engineer who can:

* explain trade-offs
* justify architecture
* revisit earlier choices with clarity
* document reasoning, not just code
