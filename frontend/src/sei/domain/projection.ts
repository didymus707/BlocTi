import type { SeiEvent } from "./events";
import type { BlockId, SessionId, TaskId } from "./ids";
import type { BlockPlan, TaskPlan } from "./plan";

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
  terminatedAt: string | null;
  isPaused: boolean;
  taskStates: Record<TaskId, TaskExecutionState>;
}

export function projectBlock(
  block: BlockPlan,
  tasks: TaskPlan[],
  events: SeiEvent[],
  now: string = new Date().toISOString(),
): BlockExecutionProjection {
  const blockTasks = tasks
    .filter((t) => t.blockId === block.id)
    .sort((a, b) => a.order - b.order);
  const initialState: BlockExecutionProjection = {
    blockId: block.id,
    sessionId: null,
    status: "idle",
    activeTaskId: null,
    startedAt: null,
    completedAt: null,
    terminatedAt: null,
    isPaused: false,
    taskStates: blockTasks.reduce(
      (acc, task) => {
        acc[task.id] = {
          taskId: task.id,
          status: "pending",
          elapsedSec: 0,
          remainingSec: task.plannedDuration,
          progress: 0,
        };
        return acc;
      },
      {} as Record<TaskId, TaskExecutionState>,
    ),
  };
  if (events.length === 0) {
    return initialState;
  }
  throw new Error("Not implemented");
}
