import type { BlockId, SessionId, TaskId, UserId } from "./sei/events";

export interface PauseEvent {
  pausedAt: number;
  resumedAt?: number;
  reason?: string; // optional user note
}

// PLAN

export interface BlockPlan {
  id: BlockId;
  name: string;
  userId: UserId;
  taskIds: TaskId[];
  createdAt: string;
  plannedDuration: number; // in seconds
}

export interface TaskPlan {
  id: TaskId;
  name: string;
  blockId: BlockId;
  order: number;
  plannedDuration: number; // in seconds
}

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

  // Execution Metrics
  export interface ExecutionMetrics {
    plannedFocusTimeSec: number;
    actualFocusTimeSec: number;
    pauseTimeSec: number;
    completedTasks: number;
    skippedTasks: number;
    executionDriftSec: number; // actual - planned
    executionFidelity: number; // ratio of completed to planned tasks
  }

export type Action =
  | { type: "ADD_BLOCK"; payload: Block }
  | { type: "DELETE_BLOCK"; payload: { id: string } }
  | { type: "TOGGLE_STATUS"; payload: { id: string } }
  | { type: "UPDATE_BLOCK"; payload: { id: string } & Partial<Block> }
  | { type: "UPDATE_PROGRESS"; payload: { id: string; progress: number } }
  | { type: "ADD_TASK_TO_BLOCK"; payload: { blockId: string; task: Task } }
  | {
      type: "UPDATE_TASK";
      payload: { blockId: string; taskId: string; data: Partial<Task> };
    }
  | {
      type: "SET_ACTIVE_TASK";
      payload: { blockId: string; taskId: string | null };
    }
  | {
      type: "DELETE_TASK";
      payload: { blockId: string; taskId: string };
    }
  | { type: "PAUSE_BLOCK"; blockId: string }
  | { type: "RESUME_BLOCK"; blockId: string; reason?: string };

export interface BlockContextType {
  blocks: Block[];
  dispatch: React.Dispatch<Action>;
}

export interface BlockUIContextType {
  isModalOpen: boolean;
  mode: "create" | "edit";
  editingBlockId: string | null;
  openCreateModal: () => void;
  openEditModal: (blockId: string) => void;
  closeModal: () => void;
}

export interface SessionContextType {
  activeBlock: Block | null;
  activeBlockId: string | null;
  activeTaskId: string | null;
  start: (block: Block) => void;
  pause: () => void;
  reset: () => void;
  resume: (block: Block, taskId: string) => void;
  terminateSession: (options?: { resetBlockStatus?: boolean }) => void;
  sessionTime: { elapsed: number; remaining: number; progress: number };
}
