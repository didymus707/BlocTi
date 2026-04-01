import type { BlockId, EventId, SessionId, TaskId, UserId } from "./ids";

export interface BaseEvent {
  seq: number;
  type: string;
  userId: UserId;
  eventId: EventId;
  blockId: BlockId;
  occurredAt: string;
  sessionId: SessionId;
}

export interface TaskSnapshot {
  taskId: TaskId;
  title: string;
  plannedDuration: number; // in seconds
}

// BlockPlannedEvent
export interface BlockPlanned extends BaseEvent {
  type: "BlockPlanned";
  plannedDuration: number; // in seconds
  tasks: TaskSnapshot[];
}

export interface BlockStarted extends BaseEvent {
  type: "BlockStarted";
}

export interface BlockPaused extends BaseEvent {
  type: "BlockPaused";
}
export interface BlockResumed extends BaseEvent {
  type: "BlockResumed";
  reason?: string; // optional user note
}

export interface BlockCompleted extends BaseEvent {
  type: "BlockCompleted";
}

export type BlockEvent =
  | BlockPlanned
  | BlockStarted
  | BlockPaused
  | BlockResumed
  | BlockCompleted;

// TaskPlannedEvent
interface TaskStarted extends BaseEvent {
  type: "TaskStarted";
  taskId: TaskId;
}

interface TaskPaused extends BaseEvent {
  type: "TaskPaused";
  taskId: TaskId;
  reason?: string; // optional user note
}

interface TaskResumed extends BaseEvent {
  type: "TaskResumed";
  taskId: TaskId;
}

interface TaskCompleted extends BaseEvent {
  type: "TaskCompleted";
  taskId: TaskId;
}

interface TaskSkipped extends BaseEvent {
  type: "TaskSkipped";
  taskId: TaskId;
}

interface TaskSwitched extends BaseEvent {
  type: "TaskSwitched";
  fromTaskId: TaskId;
  toTaskId: TaskId;
}

interface SessionTerminated extends BaseEvent {
  type: "SessionTerminated";
  reason: "user_exit" | "completed" | "interrupted";
}

export type TaskEvent =
  | TaskStarted
  | TaskPaused
  | TaskCompleted
  | TaskResumed
  | TaskSkipped
  | TaskSwitched;

  export type SessionEvent = SessionTerminated;
  
  export type SeiEvent = BlockEvent | TaskEvent | SessionEvent;
  
export const DEV_USER_ID = "dev-user" as UserId;


// focusTimeSec = sum of running intervals
// wallClockSec = completedAt - firstStartedAt
// pauseTimeSec = wallClockSec - focusTimeSec
// focusVarianceSec = focusTimeSec - plannedDurationSec
// executionDriftSec = wallClockSec - plannedDurationSec