import type { Action, Block } from "../types";

export const blockReducer = (state: Block[], action: Action): Block[] => {
  switch (action.type) {
    case "ADD_BLOCK":
      return [...state, action.payload];
    case "UPDATE_BLOCK":
      return state.map((block: Block) => {
        if (block.id === action.payload.id) {
          return { ...block, ...action.payload };
        }
        return block;
      });
    case "TOGGLE_STATUS":
      return state.map((block: Block) =>
        block.id === action.payload.id
          ? {
              ...block,
              status:
                block.status === "running"
                  ? "paused"
                  : block.status === "paused" || block.status === "idle"
                    ? "running"
                    : block.status, // completed or stopped remains unchanged
            }
          : block,
      );
    case "DELETE_BLOCK":
      return state.filter((block: Block) => block.id !== action.payload.id);
    case "ADD_TASK_TO_BLOCK":
      return state.map((block: Block) =>
        block.id === action.payload.blockId
          ? {
              ...block,
              tasks: [...block.tasks, action.payload.task],
            }
          : block,
      );
    case "SET_ACTIVE_TASK":
      return state.map((block) =>
        block.id === action.payload.blockId
          ? { ...block, activeTaskId: action.payload.taskId }
          : block,
      );
    case "UPDATE_TASK":
      return state.map((block) =>
        block.id === action.payload.blockId
          ? {
              ...block,
              tasks: block.tasks.map((task) =>
                task.id === action.payload.taskId
                  ? { ...task, ...action.payload.data }
                  : task,
              ),
            }
          : block,
      );
    case "DELETE_TASK":
      return state.map((block) => {
        if (block.id !== action.payload.blockId) return block;

        const remainingTasks = block.tasks.filter(
          (task) => task.id !== action.payload.taskId,
        );

        // if active task was deleted, pick the next one or set null
        const nextActiveTaskId =
          block.activeTaskId === action.payload.taskId
            ? (remainingTasks[0]?.id ?? null)
            : (block.activeTaskId ?? null);

        return {
          ...block,
          tasks: remainingTasks,
          activeTaskId: nextActiveTaskId,
        };
      });
    case "PAUSE_BLOCK":
      return state.map((block) =>
        block.id === action.blockId
          ? {
              ...block,
              status: "paused",
              pauses: [...block.pauses, { pausedAt: Date.now() }],
            }
          : block,
      );
    case "RESUME_BLOCK":
      return state.map((block) => {
        if (block.id !== action.blockId) return block;
        const pauses = [...block.pauses];
        const lastPause = pauses[pauses.length - 1];
        if (lastPause && !lastPause.resumedAt) {
          lastPause.resumedAt = Date.now();
          if (action.reason) {
            lastPause.reason = action.reason;
          }
        }
        return {
          ...block,
          status: "running",
          pauses,
        };
      });

    // case "STOP_BLOCK":
    //   return state.map((block: Block) =>
    //     block.id === action.payload.id
    //       ? { ...block, status: "stopped", progress: 0 }
    //       : block
    //   );

    // case "COMPLETE_BLOCK":
    //   return state.map((block: Block) =>
    //     block.id === action.payload.id
    //       ? { ...block, status: "completed", progress: 100 }
    //       : block
    //   );
    default:
      return state;
  }
};
