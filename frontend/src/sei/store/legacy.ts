import { DEV_USER_ID } from "../domain/events";
import type { BlockId, TaskId } from "../domain/ids";
import type { BlockPlan, TaskPlan } from "../domain/plan";

// Shape written by the old reducer system under localStorage "blocks".
// Durations there are minutes. Only the plan survives the migration: the old
// system never recorded events, so there is no history to carry over.
interface LegacyTask {
  id: string;
  name: string;
  duration: number;
}
interface LegacyBlock {
  id: string;
  name: string;
  plannedDuration: number;
  createdAt?: string;
  tasks?: LegacyTask[];
}

export const LEGACY_BLOCKS_KEY = "blocks";
export const LEGACY_MIGRATED_KEY = "blocti:legacy-migrated";

export const migrateLegacyBlocks = (
  raw: string | null,
): { blocks: BlockPlan[]; tasks: TaskPlan[] } => {
  if (!raw) return { blocks: [], tasks: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { blocks: [], tasks: [] };
  }
  if (!Array.isArray(parsed)) return { blocks: [], tasks: [] };

  const blocks: BlockPlan[] = [];
  const tasks: TaskPlan[] = [];
  for (const item of parsed as LegacyBlock[]) {
    if (!item || typeof item.id !== "string" || typeof item.name !== "string") continue;
    const blockId = item.id as BlockId;
    const legacyTasks = (item.tasks ?? []).filter(
      (t) => t && typeof t.id === "string" && Number(t.duration) > 0,
    );
    blocks.push({
      id: blockId,
      name: item.name,
      userId: DEV_USER_ID,
      taskIds: legacyTasks.map((t) => t.id as TaskId),
      createdAt: item.createdAt ?? new Date(0).toISOString(),
      plannedDuration: Math.max(0, Number(item.plannedDuration) || 0) * 60,
    });
    legacyTasks.forEach((t, order) =>
      tasks.push({
        id: t.id as TaskId,
        name: t.name,
        blockId,
        order,
        plannedDuration: Number(t.duration) * 60,
      }),
    );
  }
  return { blocks, tasks };
};
