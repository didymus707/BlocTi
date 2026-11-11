import { DEV_USER_ID } from "../domain/events";
import type { BlockId, IdGenerator, TaskId } from "../domain/ids";
import type { BlockPlan, TaskPlan } from "../domain/plan";
import { minutesToSeconds, secondsToMinutes } from "../../utils";

// what the block form edits: minutes, in display order
export interface DraftTask {
  id: string;
  name: string;
  minutes: number;
}

export interface PlanDraft {
  name: string;
  plannedMinutes: number;
  tasks: DraftTask[];
}

export const draftFromPlan = (block: BlockPlan, tasks: TaskPlan[]): PlanDraft => ({
  name: block.name,
  plannedMinutes: secondsToMinutes(block.plannedDuration),
  tasks: tasks.map((t) => ({
    id: t.id,
    name: t.name,
    minutes: secondsToMinutes(t.plannedDuration),
  })),
});

export const planFromDraft = (
  draft: PlanDraft,
  existing: BlockPlan | { generateId: IdGenerator; now: string },
): { block: BlockPlan; tasks: TaskPlan[] } => {
  const isEdit = "id" in existing;
  const id = isEdit ? existing.id : (existing.generateId() as BlockId);
  const createdAt = isEdit ? existing.createdAt : existing.now;
  const tasks: TaskPlan[] = draft.tasks
    .filter((t) => t.name.trim() && t.minutes > 0)
    .map((t, order) => ({
      id: t.id as TaskId,
      name: t.name.trim(),
      blockId: id,
      order,
      plannedDuration: minutesToSeconds(t.minutes),
    }));
  return {
    block: {
      id,
      name: draft.name.trim() || "Untitled Block",
      // an edit keeps the owner; a new block belongs to the current user
      userId: isEdit ? existing.userId : DEV_USER_ID,
      taskIds: tasks.map((t) => t.id),
      createdAt,
      plannedDuration: minutesToSeconds(draft.plannedMinutes),
    },
    tasks,
  };
};

// a finished block's history is immutable, so "run again" copies the plan
// into a fresh block with new ids
export const duplicatePlan = (
  block: BlockPlan,
  tasks: TaskPlan[],
  generateId: IdGenerator,
  now: string,
): { block: BlockPlan; tasks: TaskPlan[] } => {
  const id = generateId() as BlockId;
  const copies = tasks.map((t) => ({ ...t, id: generateId() as TaskId, blockId: id }));
  return {
    block: { ...block, id, createdAt: now, taskIds: copies.map((t) => t.id) },
    tasks: copies,
  };
};
