import type { BlockId, SessionId, TaskId } from "./ids";

// EXECUTION PROJECTION
export type ExecutionStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "terminated";

export interface TaskExecutionState {
  taskId: TaskId;
  status: "pending" | "running" | "paused" | "completed" | "skipped";
  elapsedSec: number;
  remainingSec: number;
  progress: number;
}

export interface BlockExecutionProjection {
  blockId: BlockId;
  sessionId: SessionId | null;
  status: ExecutionStatus;
  activeTaskId: TaskId | null;
  startedAt: string | null;
  completedAt: string | null;
  taskStates: Record<TaskId, TaskExecutionState>;
}
