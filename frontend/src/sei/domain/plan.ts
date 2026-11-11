import type { BlockPlanned, TaskSnapshot } from "./events";
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

export const tasksForBlock = (blockId: BlockId, tasks: TaskPlan[]): TaskPlan[] =>
  tasks.filter((t) => t.blockId === blockId).sort((a, b) => a.order - b.order);

export const snapshotPlan = (
  block: BlockPlan,
  tasks: TaskPlan[],
): { name: string; plannedDuration: number; tasks: TaskSnapshot[] } => ({
  name: block.name,
  plannedDuration: block.plannedDuration,
  tasks: tasksForBlock(block.id, tasks).map((t) => ({
    taskId: t.id,
    title: t.name,
    plannedDuration: t.plannedDuration,
  })),
});

// rebuild an editable plan from a snapshot, for blocks that only exist as
// events (e.g. created by an agent hook)
export const planFromSnapshot = (
  snapshot: BlockPlanned,
): { block: BlockPlan; tasks: TaskPlan[] } => ({
  block: {
    id: snapshot.blockId,
    name: snapshot.name,
    userId: snapshot.userId,
    taskIds: snapshot.tasks.map((t) => t.taskId),
    createdAt: snapshot.occurredAt,
    plannedDuration: snapshot.plannedDuration,
  },
  tasks: snapshot.tasks.map((t, order) => ({
    id: t.taskId,
    name: t.title,
    blockId: snapshot.blockId,
    order,
    plannedDuration: t.plannedDuration,
  })),
});
