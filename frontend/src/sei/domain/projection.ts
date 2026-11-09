import type {
  BlockPlanned,
  Evidence,
  SeiEvent,
  TerminationReason,
} from "./events";
import type { BlockId, SessionId, TaskId } from "./ids";
import { tasksForBlock, type BlockPlan, type TaskPlan } from "./plan";

// EXECUTION PROJECTION
export type ExecutionStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "terminated";

// "pending" = not active and not finished. A task that was started and then
// switched away from goes back to "pending"; startedAt tells the two apart.
export type TaskStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "skipped";

export type PauseKind = "task" | "block";

export interface TaskExecutionState {
  taskId: TaskId;
  title: string;
  plannedSec: number;
  status: TaskStatus;
  elapsedSec: number; // focus time only
  remainingSec: number;
  overrunSec: number;
  progress: number; // 0-100
  startedAt: string | null;
  finishedAt: string | null;
}

export interface BlockExecutionProjection {
  blockId: BlockId;
  name: string;
  plannedSec: number;
  sessionId: SessionId | null;
  status: ExecutionStatus;
  activeTaskId: TaskId | null;
  startedAt: string | null;
  completedAt: string | null;
  terminatedAt: string | null;
  terminationReason: TerminationReason | null;
  isPaused: boolean;
  pauseKind: PauseKind | null;
  pausedSince: string | null;
  pausedSec: number;
  inferredPausedSec: number;
  pauseCount: number;
  switchCount: number;
  taskOrder: TaskId[];
  taskStates: Record<TaskId, TaskExecutionState>;
  eventCount: number;
  lastEventAt: string | null;
}

// clamped at 0 so out-of-order timestamps can never produce negative time
const secondsBetween = (from: string, to: string): number =>
  Math.max(0, (Date.parse(to) - Date.parse(from)) / 1000);

const isFinished = (task: TaskExecutionState) =>
  task.status === "completed" || task.status === "skipped";

const hasHistory = (task: TaskExecutionState) =>
  task.startedAt !== null || task.status !== "pending";

const withDerivedTime = (task: TaskExecutionState): TaskExecutionState => {
  const { plannedSec, elapsedSec, status } = task;
  return {
    ...task,
    remainingSec: isFinished(task) ? 0 : Math.max(0, plannedSec - elapsedSec),
    overrunSec: plannedSec > 0 ? Math.max(0, elapsedSec - plannedSec) : 0,
    progress:
      status === "completed"
        ? 100
        : plannedSec > 0
          ? Math.min(100, (elapsedSec / plannedSec) * 100)
          : 0,
  };
};

const newTaskState = (
  taskId: TaskId,
  title: string,
  plannedSec: number,
): TaskExecutionState =>
  withDerivedTime({
    taskId,
    title,
    plannedSec,
    status: "pending",
    elapsedSec: 0,
    remainingSec: plannedSec,
    overrunSec: 0,
    progress: 0,
    startedAt: null,
    finishedAt: null,
  });

// Same events + same now => same projection. The plan (block, tasks) only seeds
// the projection until the stream contains a BlockPlanned snapshot; after that
// the snapshot is the plan, so editing the plan cannot rewrite past history.
export function projectBlock(
  block: BlockPlan,
  tasks: TaskPlan[],
  events: SeiEvent[],
  now: string,
): BlockExecutionProjection {
  const seedTasks = tasksForBlock(block.id, tasks);

  const state: BlockExecutionProjection = {
    blockId: block.id,
    name: block.name,
    plannedSec: block.plannedDuration,
    sessionId: null,
    status: "idle",
    activeTaskId: null,
    startedAt: null,
    completedAt: null,
    terminatedAt: null,
    terminationReason: null,
    isPaused: false,
    pauseKind: null,
    pausedSince: null,
    pausedSec: 0,
    inferredPausedSec: 0,
    pauseCount: 0,
    switchCount: 0,
    taskOrder: seedTasks.map((t) => t.id),
    taskStates: Object.fromEntries(
      seedTasks.map((t) => [
        t.id,
        newTaskState(t.id, t.name, t.plannedDuration),
      ]),
    ) as Record<TaskId, TaskExecutionState>,
    eventCount: 0,
    lastEventAt: null,
  };

  // the one open focus interval and the one open pause interval, if any
  const open: {
    segment: { taskId: TaskId; since: string } | null;
    pause: { since: string; evidence: Evidence } | null;
  } = { segment: null, pause: null };

  const updateTask = (taskId: TaskId, patch: Partial<TaskExecutionState>) => {
    const current = state.taskStates[taskId];
    if (!current) return;
    state.taskStates[taskId] = withDerivedTime({ ...current, ...patch });
  };

  const closeSegment = (at: string) => {
    const { segment } = open;
    if (!segment) return;
    const task = state.taskStates[segment.taskId];
    if (task) {
      updateTask(segment.taskId, {
        elapsedSec: task.elapsedSec + secondsBetween(segment.since, at),
      });
    }
    open.segment = null;
  };

  const openSegment = (taskId: TaskId, at: string) => {
    open.segment = { taskId, since: at };
    updateTask(taskId, {
      status: "running",
      startedAt: state.taskStates[taskId]?.startedAt ?? at,
    });
    state.activeTaskId = taskId;
    state.status = "running";
  };

  const beginPause = (kind: PauseKind, at: string, evidence: Evidence) => {
    open.pause = { since: at, evidence };
    state.status = "paused";
    state.isPaused = true;
    state.pauseKind = kind;
    state.pausedSince = at;
    state.pauseCount += 1;
  };

  const endPause = (at: string) => {
    const { pause } = open;
    if (pause) {
      const pausedFor = secondsBetween(pause.since, at);
      state.pausedSec += pausedFor;
      if (pause.evidence === "inferred") state.inferredPausedSec += pausedFor;
    }
    open.pause = null;
    state.isPaused = false;
    state.pauseKind = null;
    state.pausedSince = null;
  };

  // the active task stops being active without finishing
  const releaseActiveTask = () => {
    const activeId = state.activeTaskId;
    const active = activeId ? state.taskStates[activeId] : undefined;
    if (activeId && active && !isFinished(active)) {
      updateTask(activeId, { status: "pending" });
    }
    state.activeTaskId = null;
  };

  const applySnapshot = (snapshot: BlockPlanned) => {
    state.name = snapshot.name;
    // the budget is frozen once execution starts
    if (state.status === "idle") state.plannedSec = snapshot.plannedDuration;

    const snapshotIds = [...new Set(snapshot.tasks.map((t) => t.taskId))];
    // tasks with history survive a replan even if the new plan dropped them
    const kept = state.taskOrder.filter(
      (id) => !snapshotIds.includes(id) && hasHistory(state.taskStates[id]),
    );

    const nextStates = {} as Record<TaskId, TaskExecutionState>;
    for (const id of kept) nextStates[id] = state.taskStates[id];
    for (const id of snapshotIds) {
      const planned = snapshot.tasks.find((t) => t.taskId === id)!;
      const existing = state.taskStates[id];
      nextStates[id] =
        existing && hasHistory(existing)
          ? existing
          : newTaskState(id, planned.title, planned.plannedDuration);
    }

    state.taskOrder = [...kept, ...snapshotIds];
    state.taskStates = nextStates;
  };

  // dedupe by eventId so a replayed or retried event is counted once
  const seen = new Set<string>();
  const orderedEvents = events
    .filter((e) => e.blockId === block.id)
    .filter((e) => (seen.has(e.eventId) ? false : (seen.add(e.eventId), true)))
    .sort((a, b) => a.seq - b.seq);

  for (const event of orderedEvents) {
    // nothing after the end of a block can change its history
    if (state.status === "completed" || state.status === "terminated") break;

    const at = event.occurredAt;
    state.eventCount += 1;
    state.lastEventAt = at;

    switch (event.type) {
      case "BlockPlanned": {
        applySnapshot(event);
        break;
      }
      case "BlockStarted": {
        if (state.status !== "idle") break;
        state.status = "running";
        state.sessionId = event.sessionId;
        state.startedAt = at;
        break;
      }
      case "TaskStarted": {
        const task = state.taskStates[event.taskId];
        if (!task || isFinished(task) || open.segment?.taskId === event.taskId)
          break;
        endPause(at);
        closeSegment(at);
        if (state.activeTaskId !== event.taskId) releaseActiveTask();
        state.startedAt ??= at;
        state.sessionId ??= event.sessionId;
        openSegment(event.taskId, at);
        break;
      }
      case "TaskPaused": {
        if (
          state.status !== "running" ||
          state.activeTaskId !== event.taskId ||
          !open.segment
        )
          break;
        closeSegment(at);
        updateTask(event.taskId, { status: "paused" });
        beginPause("task", at, event.evidence);
        break;
      }
      case "TaskResumed": {
        if (!state.isPaused || state.activeTaskId !== event.taskId) break;
        endPause(at);
        openSegment(event.taskId, at);
        break;
      }
      case "BlockPaused": {
        if (state.status !== "running") break;
        closeSegment(at);
        if (state.activeTaskId) {
          updateTask(state.activeTaskId, { status: "paused" });
        }
        beginPause("block", at, event.evidence);
        break;
      }
      case "BlockResumed": {
        if (!state.isPaused) break;
        endPause(at);
        if (state.activeTaskId) openSegment(state.activeTaskId, at);
        else state.status = "running";
        break;
      }
      case "TaskCompleted":
      case "TaskSkipped": {
        const task = state.taskStates[event.taskId];
        if (!task || isFinished(task)) break;
        if (state.activeTaskId === event.taskId) {
          if (state.isPaused) {
            endPause(at);
            state.status = "running";
          }
          closeSegment(at);
          state.activeTaskId = null;
        }
        updateTask(event.taskId, {
          status: event.type === "TaskCompleted" ? "completed" : "skipped",
          finishedAt: at,
        });
        break;
      }
      case "TaskSwitched": {
        const to = state.taskStates[event.toTaskId];
        if (
          state.activeTaskId !== event.fromTaskId ||
          event.fromTaskId === event.toTaskId ||
          !to ||
          isFinished(to)
        )
          break;
        endPause(at);
        closeSegment(at);
        releaseActiveTask();
        openSegment(event.toTaskId, at);
        state.switchCount += 1;
        break;
      }
      case "BlockCompleted": {
        endPause(at);
        closeSegment(at);
        releaseActiveTask();
        state.status = "completed";
        state.completedAt = at;
        break;
      }
      case "SessionTerminated": {
        endPause(at);
        closeSegment(at);
        releaseActiveTask();
        state.status = "terminated";
        state.terminatedAt = at;
        state.terminationReason = event.reason;
        break;
      }
      default:
        break;
    }
  }

  // live tail: intervals still open at `now`
  if (open.segment && state.status === "running") closeSegment(now);
  if (open.pause) {
    const pausedFor = secondsBetween(open.pause.since, now);
    state.pausedSec += pausedFor;
    if (open.pause.evidence === "inferred") state.inferredPausedSec += pausedFor;
  }

  return state;
}

export const orderedTaskStates = (
  projection: BlockExecutionProjection,
): TaskExecutionState[] =>
  projection.taskOrder.map((id) => projection.taskStates[id]).filter(Boolean);

// elapsedSec = sum of running segments
// A running segment is:
// TaskStarted / TaskResumed / BlockResumed / TaskSwitched(to) opens a segment
// TaskPaused / BlockPaused / TaskCompleted / TaskSkipped / TaskSwitched(from)
// / BlockCompleted / SessionTerminated close it and add its time
