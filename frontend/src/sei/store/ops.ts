import type { BlockPlanned, SeiEvent } from "../domain/events";
import type { BlockId } from "../domain/ids";
import {
  planFromSnapshot,
  tasksForBlock,
  type BlockPlan,
  type TaskPlan,
} from "../domain/plan";

export interface SeiState {
  blockPlans: BlockPlan[];
  taskPlans: TaskPlan[];
  events: SeiEvent[];
}

export const EMPTY_STATE: SeiState = { blockPlans: [], taskPlans: [], events: [] };

// Every mutation is an op. Ops are applied optimistically, queued in an
// outbox, and replayed on top of whatever the server returns after a refresh.
// An op's id doubles as its idempotency key.
export type Op =
  | { kind: "savePlan"; id: string; block: BlockPlan; tasks: TaskPlan[] }
  | { kind: "deleteBlock"; id: string; blockId: BlockId }
  | { kind: "appendEvents"; id: string; blockId: BlockId; events: SeiEvent[] };

export const applyOp = (state: SeiState, op: Op): SeiState => {
  switch (op.kind) {
    case "savePlan": {
      const exists = state.blockPlans.some((b) => b.id === op.block.id);
      return {
        ...state,
        blockPlans: exists
          ? state.blockPlans.map((b) => (b.id === op.block.id ? op.block : b))
          : [...state.blockPlans, op.block],
        taskPlans: [
          ...state.taskPlans.filter((t) => t.blockId !== op.block.id),
          ...op.tasks,
        ],
      };
    }
    case "deleteBlock":
      return {
        blockPlans: state.blockPlans.filter((b) => b.id !== op.blockId),
        taskPlans: state.taskPlans.filter((t) => t.blockId !== op.blockId),
        events: state.events.filter((e) => e.blockId !== op.blockId),
      };
    case "appendEvents": {
      const known = new Set(state.events.map((e) => e.eventId));
      const fresh = op.events.filter((e) => !known.has(e.eventId));
      return fresh.length ? { ...state, events: [...state.events, ...fresh] } : state;
    }
  }
};

// swap provisional events for the server's canonical copies (server seq/time)
export const reconcileEvents = (state: SeiState, canonical: SeiEvent[]): SeiState => {
  const byId = new Map(canonical.map((e) => [e.eventId, e]));
  const known = new Set(state.events.map((e) => e.eventId));
  return {
    ...state,
    events: [
      ...state.events.map((e) => byId.get(e.eventId) ?? e),
      ...canonical.filter((e) => !known.has(e.eventId)),
    ],
  };
};

export const rollbackEvents = (state: SeiState, op: Op): SeiState => {
  if (op.kind !== "appendEvents") return state;
  const ids = new Set(op.events.map((e) => e.eventId));
  return { ...state, events: state.events.filter((e) => !ids.has(e.eventId)) };
};

const latestSnapshot = (events: SeiEvent[], blockId: BlockId) =>
  events
    .filter((e): e is BlockPlanned => e.type === "BlockPlanned" && e.blockId === blockId)
    .sort((a, b) => b.seq - a.seq)[0];

// the editable plan for a block; blocks created by an agent hook only exist
// as events, so their plan is rebuilt from the latest snapshot
export const planFor = (
  state: SeiState,
  blockId: BlockId,
): { block: BlockPlan; tasks: TaskPlan[] } | null => {
  const block = state.blockPlans.find((b) => b.id === blockId);
  if (block) return { block, tasks: tasksForBlock(blockId, state.taskPlans) };
  const snapshot = latestSnapshot(state.events, blockId);
  return snapshot ? planFromSnapshot(snapshot) : null;
};

export const blockIdsIn = (state: SeiState): BlockId[] => {
  const ids = new Set<BlockId>(state.blockPlans.map((b) => b.id));
  for (const e of state.events) ids.add(e.blockId);
  return [...ids];
};

export const allPlans = (state: SeiState) =>
  blockIdsIn(state)
    .map((id) => planFor(state, id))
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => a.block.createdAt.localeCompare(b.block.createdAt));
