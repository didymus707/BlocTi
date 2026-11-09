import type { TaskId } from "../domain/ids";
import {
  orderedTaskStates,
  type BlockExecutionProjection,
} from "../domain/projection";

// What the execution trace draws: wall-clock time left to right.
// focus  = recorded focus on a task (ink, shade alternates per task)
// live   = the focus interval running right now (blue)
// paused = an observed pause (amber hatch)
// inferred = a pause someone deduced, e.g. an agent hook (grey hatch)
// gap    = time no event covers
// planned = plan still to come (dashed)
export type TraceKind = "focus" | "live" | "paused" | "inferred" | "gap" | "planned";

export interface TraceSegment {
  kind: TraceKind;
  taskId: TaskId | null;
  title: string | null;
  seconds: number;
  shade: 0 | 1 | 2;
}

export interface Trace {
  segments: TraceSegment[];
  totalSec: number;
  startedAt: string | null;
  // the end of what has happened: completion, termination or now
  endAt: string | null;
  // where the block budget runs out, as seconds from the start
  budgetAtSec: number | null;
}

const seconds = (from: string, to: string) =>
  Math.max(0, (Date.parse(to) - Date.parse(from)) / 1000);

// gaps shorter than this are rounding between same-instant events
const MIN_GAP_SEC = 1;

export function buildTrace(
  projection: BlockExecutionProjection,
  now: string,
  { includePlan = true }: { includePlan?: boolean } = {},
): Trace {
  const tasks = orderedTaskStates(projection);
  const shadeOf = (taskId: TaskId | null) =>
    (Math.max(0, projection.taskOrder.indexOf(taskId as TaskId)) % 3) as 0 | 1 | 2;
  const titleOf = (taskId: TaskId | null) =>
    taskId ? (projection.taskStates[taskId]?.title ?? null) : null;

  const segments: TraceSegment[] = [];
  const { startedAt } = projection;
  const isLive = projection.status === "running" || projection.status === "paused";
  const endAt = startedAt
    ? (projection.completedAt ?? projection.terminatedAt ?? now)
    : null;

  if (startedAt) {
    let cursor = startedAt;
    for (const interval of projection.intervals) {
      const gap = seconds(cursor, interval.from);
      if (gap >= MIN_GAP_SEC) {
        segments.push({ kind: "gap", taskId: null, title: null, seconds: gap, shade: 0 });
      }
      const kind: TraceKind =
        interval.kind === "pause"
          ? interval.evidence === "inferred"
            ? "inferred"
            : "paused"
          : interval.open
            ? "live"
            : "focus";
      segments.push({
        kind,
        taskId: interval.taskId,
        title: interval.kind === "focus" ? titleOf(interval.taskId) : null,
        seconds: seconds(interval.from, interval.to),
        shade: shadeOf(interval.taskId),
      });
      if (Date.parse(interval.to) > Date.parse(cursor)) cursor = interval.to;
    }
    const tail = endAt ? seconds(cursor, endAt) : 0;
    if (tail >= MIN_GAP_SEC) {
      segments.push({ kind: "gap", taskId: null, title: null, seconds: tail, shade: 0 });
    }
  }

  if (includePlan && (isLive || !startedAt)) {
    for (const task of tasks) {
      const finished = task.status === "completed" || task.status === "skipped";
      if (finished || task.remainingSec <= 0) continue;
      segments.push({
        kind: "planned",
        taskId: task.taskId,
        title: task.title,
        seconds: task.remainingSec,
        shade: shadeOf(task.taskId),
      });
    }
  }

  const totalSec = segments.reduce((acc, s) => acc + s.seconds, 0);
  return {
    segments,
    totalSec,
    startedAt,
    endAt,
    budgetAtSec: startedAt && projection.plannedSec > 0 ? projection.plannedSec : null,
  };
}
