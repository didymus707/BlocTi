import type { SeiEvent } from "../domain/events";
import type { BlockId } from "../domain/ids";
import type { BlockPlan, TaskPlan } from "../domain/plan";
import { applyOp, EMPTY_STATE, type SeiState } from "./ops";

export interface AppendRequest {
  idempotencyKey: string;
  blockId: BlockId;
  events: SeiEvent[]; // client eventIds; seq is provisional and reassigned
}

export interface SeiPersistence {
  readonly kind: "local" | "http";
  load(): Promise<SeiState>;
  savePlan(block: BlockPlan, tasks: TaskPlan[]): Promise<void>;
  deleteBlock(blockId: BlockId): Promise<void>;
  // returns the canonical stored events
  appendEvents(request: AppendRequest): Promise<SeiEvent[]>;
}

export class PersistenceError extends Error {
  readonly retryable: boolean;
  readonly status: number | undefined;
  constructor(message: string, retryable: boolean, status?: number) {
    super(message);
    this.name = "PersistenceError";
    this.retryable = retryable;
    this.status = status;
  }
}

// LOCAL: everything in one localStorage document. Used without a backend
// and in tests.
const LOCAL_KEY = "blocti:sei:v1";

export const createLocalPersistence = (
  storage: Storage = localStorage,
): SeiPersistence => {
  const read = (): SeiState => {
    try {
      const raw = storage.getItem(LOCAL_KEY);
      return raw ? { ...EMPTY_STATE, ...(JSON.parse(raw) as SeiState) } : EMPTY_STATE;
    } catch {
      return EMPTY_STATE;
    }
  };
  const write = (state: SeiState) => storage.setItem(LOCAL_KEY, JSON.stringify(state));

  return {
    kind: "local",
    load: async () => read(),
    savePlan: async (block, tasks) => {
      write(applyOp(read(), { kind: "savePlan", id: "", block, tasks }));
    },
    deleteBlock: async (blockId) => {
      write(applyOp(read(), { kind: "deleteBlock", id: "", blockId }));
    },
    appendEvents: async ({ blockId, events }) => {
      const state = read();
      const stored = new Map(state.events.map((e) => [e.eventId, e]));
      // idempotent: events already stored are returned as they were stored
      if (events.every((e) => stored.has(e.eventId))) {
        return events.map((e) => stored.get(e.eventId)!);
      }
      let seq = Math.max(
        0,
        ...state.events.filter((e) => e.blockId === blockId).map((e) => e.seq),
      );
      const canonical = events.map((e) => stored.get(e.eventId) ?? { ...e, seq: ++seq });
      write(applyOp(state, { kind: "appendEvents", id: "", blockId, events: canonical }));
      return canonical;
    },
  };
};
