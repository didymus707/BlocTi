import type { ExecutionCommand } from "./sei/domain/command/executionCommand";
import type { PlanCommand } from "./sei/domain/command/planCommands";
import type { SeiEvent } from "./sei/domain/events";
import type { BlockId, TaskId } from "./sei/domain/ids";
import type { BlockPlan, TaskPlan } from "./sei/domain/plan";
import type { BlockExecutionProjection } from "./sei/domain/projection";

export interface PauseEvent {
  pausedAt: number;
  resumedAt?: number;
  reason?: string; // optional user note
}

export type Status = "idle" | "running" | "paused" | "completed";

export interface Block {
  id: string;
  name: string;
  tasks: Task[];
  status: Status;
  // timeTracking
  actualDuration: number;
  plannedDuration: number;
  // precise tracking
  startedAt?: number;
  completedAt?: number;
  pauses: PauseEvent[];
  createdAt: string;
  activeTaskId?: string | null;
}

export interface Task {
  id: string;
  name: string;
  blockId: string;
  elapsed: number;
  progress: number;
  duration: number;
  remaining: number;
  completed: boolean;
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

export interface BlockStoreStte {
  blockPlans: BlockPlan[];
  taskPlans: TaskPlan[];
  events: SeiEvent[];
}
export interface SeiBlockContextType {
  state: BlockStoreStte;
  dispatch: React.Dispatch<PlanCommand | ExecutionCommand>;
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

export interface SeiSessionTimeView {
  elapsedSec: number;
  remainingSec: number;
  progress: number;
}

export interface SSeiessionContextType {
  activeBlockId: BlockId | null;
  activeTaskId: TaskId | null;
  projection: BlockExecutionProjection | null;
  sessionTime: SeiSessionTimeView;
  startBlock: (blockId: BlockId) => void;
  pauseActiveTask: (reason?: string) => void;
  resumeActiveTask: () => void;
  completeActiveTask: () => void;
  skipTask: (taskId: TaskId) => void;
  terminateSession: (reason?: "manual_stop" | "abandoned") => void;
}
