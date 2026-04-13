import type { BlockId } from "../ids";
import type { BlockPlan, TaskPlan } from "../plan";

export type PlanCommand =
  | { type: "CREATE_BLOCK"; block: BlockPlan; tasks: TaskPlan[] }
  | { type: "UPDATE_BLOCK_PLAN"; blockId: BlockId; patch: Partial<BlockPlan> }
  | { type: "DELETE_BLOCK"; blockId: BlockId }
  