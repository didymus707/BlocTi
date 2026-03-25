import type { BlockId, TaskId, UserId } from "./ids";

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
