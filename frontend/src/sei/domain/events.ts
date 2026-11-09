import type { BlockId, EventId, SessionId, TaskId, UserId } from "./ids";

// who produced the event
export type Actor = "human" | "agent";
// which channel the event came through
export type EventSource = "timer" | "agent_hook" | "git" | "calendar";
// observed = the fact was seen directly (a click, a hook firing)
// inferred = the fact was deduced (e.g. "the agent stopped, so the human is reviewing")
export type Evidence = "observed" | "inferred";

export interface Provenance {
  actor: Actor;
  source: EventSource;
  evidence: Evidence;
}

export interface BaseEvent extends Provenance {
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

// BlockPlannedEvent: a frozen copy of the plan, so later plan edits cannot rewrite history
export interface BlockPlanned extends BaseEvent {
  type: "BlockPlanned";
  name: string;
  plannedDuration: number; // in seconds
  tasks: TaskSnapshot[];
}

export interface BlockStarted extends BaseEvent {
  type: "BlockStarted";
}

export interface BlockPaused extends BaseEvent {
  type: "BlockPaused";
  reason?: string; // optional user note
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

export interface TaskStarted extends BaseEvent {
  type: "TaskStarted";
  taskId: TaskId;
}

export interface TaskPaused extends BaseEvent {
  type: "TaskPaused";
  taskId: TaskId;
  reason?: string; // optional user note
}

export interface TaskResumed extends BaseEvent {
  type: "TaskResumed";
  taskId: TaskId;
}

export interface TaskCompleted extends BaseEvent {
  type: "TaskCompleted";
  taskId: TaskId;
}

export interface TaskSkipped extends BaseEvent {
  type: "TaskSkipped";
  taskId: TaskId;
}

export interface TaskSwitched extends BaseEvent {
  type: "TaskSwitched";
  fromTaskId: TaskId;
  toTaskId: TaskId;
}

export type TerminationReason = "user_exit" | "completed" | "interrupted";

export interface SessionTerminated extends BaseEvent {
  type: "SessionTerminated";
  reason: TerminationReason;
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

export type SeiEventType = SeiEvent["type"];

export const SEI_EVENT_TYPES: readonly SeiEventType[] = [
  "BlockPlanned",
  "BlockStarted",
  "BlockPaused",
  "BlockResumed",
  "BlockCompleted",
  "TaskStarted",
  "TaskPaused",
  "TaskResumed",
  "TaskCompleted",
  "TaskSkipped",
  "TaskSwitched",
  "SessionTerminated",
];

export const DEV_USER_ID = "dev-user" as UserId;

export const HUMAN_TIMER: Provenance = {
  actor: "human",
  source: "timer",
  evidence: "observed",
};
