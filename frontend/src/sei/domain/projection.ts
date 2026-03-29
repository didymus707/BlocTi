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
  // now: string = new Date().toISOString(),
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
  let state = { ...initialState };
  const orderedEvents = [...events].sort((a, b) => a.seq - b.seq);

  for (const event of orderedEvents) {
    switch (event.type) {
      case "BlockStarted": {
        state = {
          ...state,
          sessionId: event.sessionId,
          status: "running",
          startedAt: event.occurredAt,
        };
        break;
      }
      case "TaskStarted": {
        state = {
          ...state,
          activeTaskId: event.taskId,
          status: "running",
          isPaused: false,
          taskStates: {
            ...state.taskStates,
            [event.taskId]: {
              ...state.taskStates[event.taskId],
              status: "running",
            },
          },
        };
        break;
      }
      case "TaskPaused": {
        state = {
          ...state,
          status: "paused",
          isPaused: true,
          taskStates: {
            ...state.taskStates,
            [event.taskId]: {
              ...state.taskStates[event.taskId],
              status: "paused",
            },
          },
        };
        break;
      }
      case "TaskResumed": {
        state = {
          ...state,
          status: "running",
          isPaused: false,
          taskStates: {
            ...state.taskStates,
            [event.taskId]: {
              ...state.taskStates[event.taskId],
              status: "running",
            },
          },
        };
        break;
      }
      case "TaskCompleted": {
        const task = blockTasks.find((t) => t.id === event.taskId);

        if (!task) break;

        state = {
          ...state,
          activeTaskId: null,
          isPaused: false,
          taskStates: {
            ...state.taskStates,
            [event.taskId]: {
              ...state.taskStates[event.taskId],
              status: "completed",
              elapsedSec: task.plannedDuration,
              remainingSec: 0,
              progress: 100,
            },
          },
        };
        break;
      }
      case "TaskSwitched": {
        state = {
          ...state,
          activeTaskId: event.toTaskId,
          status: "running",
          isPaused: false,
          taskStates: {
            ...state.taskStates,
            [event.fromTaskId]: {
              ...state.taskStates[event.fromTaskId],
              status: "pending",
            },
            [event.toTaskId]: {
              ...state.taskStates[event.toTaskId],
              status: "running",
            },
          },
        };
        break;
      }
      case "BlockCompleted": {
        state = {
          ...state,
          activeTaskId: null,
          status: "completed",
          isPaused: false,
          completedAt: event.occurredAt,
        };
        break;
      }
      case "SessionTerminated": {
        state = {
          ...state,
          activeTaskId: null,
          status: "terminated",
          isPaused: false,
          terminatedAt: event.occurredAt,
        };
        break;
      }
      default:
        break;
    }
  }
  return state;
}
