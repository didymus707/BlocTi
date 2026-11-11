import { createContext, useContext } from "react";
import type { SeiEvent, TerminationReason } from "../domain/events";
import type { BlockId, TaskId } from "../domain/ids";
import type { ExecutionMetrics } from "../domain/metrics";
import type { BlockPlan, TaskPlan } from "../domain/plan";
import type { BlockExecutionProjection } from "../domain/projection";

export interface BlockView {
  block: BlockPlan;
  tasks: TaskPlan[];
  projection: BlockExecutionProjection;
  metrics: ExecutionMetrics;
  events: SeiEvent[];
  // recorded by an agent hook rather than the timer; its fidelity measures
  // something different (its plan is inferred, with no estimates), so it is reported apart
  capturedByAgent: boolean;
}

export interface SeiSessionTimeView {
  elapsedSec: number;
  remainingSec: number;
  progress: number;
}

export interface BlockActions {
  start: (taskId?: TaskId) => SeiEvent[];
  pauseTask: (reason?: string) => SeiEvent[];
  resumeTask: () => SeiEvent[];
  pauseBlock: (reason?: string) => SeiEvent[];
  resumeBlock: () => SeiEvent[];
  completeTask: () => SeiEvent[];
  skipTask: (taskId?: TaskId) => SeiEvent[];
  switchTask: (toTaskId: TaskId) => SeiEvent[];
  replan: () => SeiEvent[];
  terminate: (reason?: TerminationReason) => SeiEvent[];
}

export interface SeiSessionContextType {
  // the time projections were last computed at; only ticks while a block is live
  now: string;
  // read the clock for timestamps (e.g. createdAt)
  clock: () => string;
  blocks: BlockView[];
  getBlock: (blockId: string | undefined) => BlockView | undefined;
  actionsFor: (blockId: BlockId) => BlockActions;
  // the most recently active live block, shown in focus mode
  activeBlockId: BlockId | null;
  activeTaskId: TaskId | null;
  projection: BlockExecutionProjection | null;
  sessionTime: SeiSessionTimeView;
}

export const SeiSessionContext = createContext<SeiSessionContextType | null>(null);

export const useSeiSession = (): SeiSessionContextType => {
  const value = useContext(SeiSessionContext);
  if (!value) throw new Error("useSeiSession must be used within SeiSessionProvider");
  return value;
};
