import { createContext, useContext } from "react";
import type { ExecutionCommand } from "../domain/command/executionCommand";
import type { SeiEvent } from "../domain/events";
import type { BlockId, IdGenerator } from "../domain/ids";
import type { BlockPlan, TaskPlan } from "../domain/plan";
import type { SeiState } from "./ops";

// loading: first load in flight; offline: the backend is unreachable and the
// store is running from its local cache + outbox
export type StoreStatus = "loading" | "ready" | "offline";

export interface SeiStoreValue {
  state: SeiState;
  status: StoreStatus;
  pendingOps: number;
  lastError: string | null;
  clearError: () => void;
  savePlan: (block: BlockPlan, tasks: TaskPlan[]) => void;
  deleteBlock: (blockId: BlockId) => void;
  // resolves the command against current truth; returns the new events,
  // or [] if the command is not valid right now
  execute: (command: ExecutionCommand) => SeiEvent[];
  generateId: IdGenerator;
}

export const SeiStoreContext = createContext<SeiStoreValue | null>(null);

export const useSeiStore = (): SeiStoreValue => {
  const value = useContext(SeiStoreContext);
  if (!value) throw new Error("useSeiStore must be used within SeiProvider");
  return value;
};
