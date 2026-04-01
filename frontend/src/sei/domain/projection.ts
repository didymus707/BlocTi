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
  let state = { ...initialState };
  let currentStartTime: string | null = null;
  const orderedEvents = [...events].sort((a, b) => a.seq - b.seq);

  const deltaSecHelper = (timeOne: string, timeTwo: string): number => {
    return (new Date(timeOne).getTime() - new Date(timeTwo).getTime()) / 1000;
  };

  for (const event of orderedEvents) {
    switch (event.type) {
      case "BlockStarted": {
        state = {
          ...state,
          status: "running",
          sessionId: event.sessionId,
          startedAt: event.occurredAt,
        };
        break;
      }
      case "TaskStarted": {
        currentStartTime = event.occurredAt;
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
        const task = blockTasks.find((t) => t.id === event.taskId);
        const currentTaskState = state.taskStates[event.taskId];

        if (!task || !currentTaskState || !currentStartTime) break;

        const deltaSec = deltaSecHelper(event.occurredAt, currentStartTime);

        const nextElapsed = currentTaskState.elapsedSec + deltaSec;
        const nextRemaining = Math.max(0, task.plannedDuration - nextElapsed);
        const nextProgress = Math.min(
          100,
          (nextElapsed / task.plannedDuration) * 100,
        );

        state = {
          ...state,
          status: "paused",
          isPaused: true,
          taskStates: {
            ...state.taskStates,
            [event.taskId]: {
              ...currentTaskState,
              status: "paused",
              elapsedSec: nextElapsed,
              remainingSec: nextRemaining,
              progress: nextProgress,
            },
          },
        };

        currentStartTime = null;
        break;
      }
      case "TaskResumed": {
        const currentTaskState = state.taskStates[event.taskId];

        if (!currentTaskState) break;

        currentStartTime = event.occurredAt;

        state = {
          ...state,
          status: "running",
          isPaused: false,
          taskStates: {
            ...state.taskStates,
            [event.taskId]: {
              ...currentTaskState,
              status: "running",
            },
          },
        };
        break;
      }
      case "TaskCompleted": {
        const currentTaskState = state.taskStates[event.taskId];

        if (!currentTaskState) break;

        let nextElapsed = currentTaskState.elapsedSec;

        if (currentStartTime) {
          const deltaSec = deltaSecHelper(event.occurredAt, currentStartTime);
          nextElapsed += deltaSec;
        }

        state = {
          ...state,
          activeTaskId: null,
          status: "running",
          isPaused: false,
          taskStates: {
            ...state.taskStates,
            [event.taskId]: {
              ...currentTaskState,
              status: "completed",
              elapsedSec: nextElapsed,
              remainingSec: 0,
              progress: 100,
            },
          },
        };

        currentStartTime = null;
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

  if (
    state.activeTaskId &&
    currentStartTime &&
    state.status === "running" &&
    !state.isPaused
  ) {
    const activeTaskId = state.activeTaskId;
    const task = blockTasks.find((t) => t.id === activeTaskId);
    const currentTaskState = state.taskStates[activeTaskId];
    if (task) {
      const deltaSec = deltaSecHelper(now, currentStartTime);
      const nextElapsed = deltaSec + state.taskStates[task.id].elapsedSec;
      const remainingSec = Math.max(0, task.plannedDuration - nextElapsed);
      const nextProgress = Math.min(
        100,
        (nextElapsed / task.plannedDuration) * 100,
      );

      state = {
        ...state,
        taskStates: {
          ...state.taskStates,
          [activeTaskId]: {
            ...currentTaskState,
            elapsedSec: nextElapsed,
            remainingSec: remainingSec,
            progress: nextProgress,
          },
        },
      };
    }
  }
  return state;
}

// elapsedSec = sum of running segments
// A running segment is:
// TaskStarted opens a segment
// TaskPaused closes a segment and adds time
// TaskResumed opens a new segment
// TaskCompleted closes the final segment and adds time
