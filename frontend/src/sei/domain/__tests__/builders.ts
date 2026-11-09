import {
  HUMAN_TIMER,
  type SeiEvent,
  type SeiEventType,
  type TaskSnapshot,
  type TerminationReason,
} from "../events";
import type { BlockId, EventId, SessionId, TaskId, UserId } from "../ids";
import type { BlockPlan, TaskPlan } from "../plan";

export const T0 = "2026-11-08T09:00:00.000Z";
export const at = (sec: number) =>
  new Date(Date.parse(T0) + sec * 1000).toISOString();

export const BLOCK = "block-1" as BlockId;
export const OTHER_BLOCK = "block-2" as BlockId;
export const USER = "user-1" as UserId;
export const SESSION = "session-1" as SessionId;
export const T1 = "task-1" as TaskId;
export const T2 = "task-2" as TaskId;
export const T3 = "task-3" as TaskId;
export const T4 = "task-4" as TaskId;

// 10m + 5m + 15m = 30m, with a 30m budget
export const PLAN_TASKS: TaskPlan[] = [
  { id: T1, name: "Read", blockId: BLOCK, order: 0, plannedDuration: 600 },
  { id: T2, name: "Write", blockId: BLOCK, order: 1, plannedDuration: 300 },
  { id: T3, name: "Review", blockId: BLOCK, order: 2, plannedDuration: 900 },
];

export const PLAN: BlockPlan = {
  id: BLOCK,
  name: "Morning block",
  userId: USER,
  taskIds: [T1, T2, T3],
  createdAt: T0,
  plannedDuration: 1800,
};

export const SNAPSHOT_TASKS: TaskSnapshot[] = PLAN_TASKS.map((t) => ({
  taskId: t.id,
  title: t.name,
  plannedDuration: t.plannedDuration,
}));

type Unsequenced = SeiEvent extends infer E
  ? E extends SeiEvent
    ? Omit<E, "seq" | "eventId">
    : never
  : never;

// every event type a builder produced, so a suite can assert full coverage
export const usedEventTypes = new Set<SeiEventType>();

const base = (type: SeiEventType, sec: number, blockId = BLOCK) => {
  usedEventTypes.add(type);
  return {
    ...HUMAN_TIMER,
    userId: USER,
    blockId,
    sessionId: SESSION,
    occurredAt: at(sec),
  };
};

export const ev = {
  planned: (
    sec: number,
    tasks: TaskSnapshot[] = SNAPSHOT_TASKS,
    extra: { name?: string; plannedDuration?: number } = {},
  ): Unsequenced => ({
    ...base("BlockPlanned", sec),
    type: "BlockPlanned",
    name: extra.name ?? PLAN.name,
    plannedDuration: extra.plannedDuration ?? PLAN.plannedDuration,
    tasks,
  }),
  blockStarted: (sec: number): Unsequenced => ({
    ...base("BlockStarted", sec),
    type: "BlockStarted",
  }),
  blockPaused: (sec: number): Unsequenced => ({
    ...base("BlockPaused", sec),
    type: "BlockPaused",
  }),
  blockResumed: (sec: number): Unsequenced => ({
    ...base("BlockResumed", sec),
    type: "BlockResumed",
  }),
  blockCompleted: (sec: number): Unsequenced => ({
    ...base("BlockCompleted", sec),
    type: "BlockCompleted",
  }),
  taskStarted: (taskId: TaskId, sec: number): Unsequenced => ({
    ...base("TaskStarted", sec),
    type: "TaskStarted",
    taskId,
  }),
  taskPaused: (
    taskId: TaskId,
    sec: number,
    extra: Partial<typeof HUMAN_TIMER> = {},
  ): Unsequenced => ({
    ...base("TaskPaused", sec),
    ...extra,
    type: "TaskPaused",
    taskId,
  }),
  taskResumed: (taskId: TaskId, sec: number): Unsequenced => ({
    ...base("TaskResumed", sec),
    type: "TaskResumed",
    taskId,
  }),
  taskCompleted: (taskId: TaskId, sec: number): Unsequenced => ({
    ...base("TaskCompleted", sec),
    type: "TaskCompleted",
    taskId,
  }),
  taskSkipped: (taskId: TaskId, sec: number): Unsequenced => ({
    ...base("TaskSkipped", sec),
    type: "TaskSkipped",
    taskId,
  }),
  taskSwitched: (from: TaskId, to: TaskId, sec: number): Unsequenced => ({
    ...base("TaskSwitched", sec),
    type: "TaskSwitched",
    fromTaskId: from,
    toTaskId: to,
  }),
  terminated: (
    sec: number,
    reason: TerminationReason = "user_exit",
  ): Unsequenced => ({
    ...base("SessionTerminated", sec),
    type: "SessionTerminated",
    reason,
  }),
};

// assigns seq 1..n and stable event ids in list order
export const sequence = (...events: Unsequenced[]): SeiEvent[] =>
  events.map(
    (e, i) =>
      ({ ...e, seq: i + 1, eventId: `evt-${i + 1}` as EventId }) as SeiEvent,
  );

// the standard opening: plan snapshot, block start, first task start
export const started = (sec = 0, firstTask: TaskId = T1): Unsequenced[] => [
  ev.planned(sec),
  ev.blockStarted(sec),
  ev.taskStarted(firstTask, sec),
];

export const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

// deterministic id generator for append tests
export const idSequence = (prefix = "id") => {
  let n = 0;
  return () => `${prefix}-${++n}`;
};
