import type { BlockId, SessionId, TaskId, UserId } from "./ids";
import type { BlockPlan, TaskPlan } from "./plan";

export type Command =
  | { type: "CREATE_BLOCK"; block: BlockPlan; tasks: TaskPlan[] }
  | { type: "UPDATE_BLOCK_PLAN"; blockId: BlockId; patch: Partial<BlockPlan> }
  | { type: "DELETE_BLOCK"; blockId: BlockId }
  | {
      type: "START_BLOCK";
      blockId: BlockId;
      sessionId: SessionId;
      userId: UserId;
    }
  | { type: "START_TASK"; blockId: BlockId; taskId: TaskId }
  | { type: "PAUSE_ACTIVE_TASK"; blockId: BlockId; reason?: string }
  | { type: "RESUME_ACTIVE_TASK"; blockId: BlockId }
  | { type: "COMPLETE_ACTIVE_TASK"; blockId: BlockId; taskId: TaskId }
  | { type: "SKIP_TASK"; blockId: BlockId; taskId: TaskId }
  | {
      type: "TERMINATE_SESSION";
      blockId: BlockId;
      reason: "manual_stop" | "completed" | "abandoned";
    };