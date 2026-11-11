import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ExecutionCommand } from "../domain/command/executionCommand";
import { DEV_USER_ID } from "../domain/events";
import type { BlockId, SessionId } from "../domain/ids";
import { computeMetrics } from "../domain/metrics";
import { projectBlock } from "../domain/projection";
import { allPlans } from "../store/ops";
import { useSeiStore } from "../store/seiStoreContext";
import {
  SeiSessionContext,
  type BlockActions,
  type BlockView,
  type SeiSessionContextType,
} from "./seiSessionContext";

type CommandInput = ExecutionCommand extends infer C
  ? C extends ExecutionCommand
    ? Omit<C, "blockId" | "userId" | "at">
    : never
  : never;

const isLive = (view: BlockView) =>
  view.projection.status === "running" || view.projection.status === "paused";

const systemClock = () => new Date().toISOString();

interface SeiSessionProviderProps {
  children: ReactNode;
  clock?: () => string;
  tickMs?: number;
}

export const SeiSessionProvider = ({
  children,
  clock = systemClock,
  tickMs = 1000,
}: SeiSessionProviderProps) => {
  const { state, execute, generateId } = useSeiStore();
  const [now, setNow] = useState(clock);

  const blocks = useMemo<BlockView[]>(
    () =>
      allPlans(state).map(({ block, tasks }) => {
        const events = state.events.filter((e) => e.blockId === block.id);
        const projection = projectBlock(block, tasks, events, now);
        return {
          block,
          tasks,
          events,
          projection,
          metrics: computeMetrics(projection, now),
          capturedByAgent: events.some(
            (e) => e.type === "BlockStarted" && e.source === "agent_hook",
          ),
        };
      }),
    [state, now],
  );

  const anyLive = blocks.some(isLive);
  useEffect(() => {
    if (!anyLive) return;
    const id = setInterval(() => setNow(clock()), tickMs);
    return () => clearInterval(id);
  }, [anyLive, clock, tickMs]);

  const run = useCallback(
    (blockId: BlockId, input: CommandInput) => {
      const at = clock();
      const events = execute({ ...input, blockId, userId: DEV_USER_ID, at } as ExecutionCommand);
      setNow(at);
      return events;
    },
    [clock, execute],
  );

  const actionsFor = useCallback(
    (blockId: BlockId): BlockActions => ({
      start: (taskId) => {
        // one human, one focus clock: pause any other timer block that is running
        for (const other of blocks) {
          const startedByTimer = other.events.some(
            (e) => e.type === "BlockStarted" && e.source === "timer",
          );
          if (
            other.block.id !== blockId &&
            other.projection.status === "running" &&
            startedByTimer
          ) {
            run(other.block.id, { type: "PauseBlock", reason: "switched block" });
          }
        }
        return run(blockId, {
          type: "StartBlock",
          sessionId: generateId() as SessionId,
          ...(taskId ? { taskId } : {}),
        });
      },
      pauseTask: (reason) => run(blockId, { type: "PauseTask", ...(reason ? { reason } : {}) }),
      resumeTask: () => run(blockId, { type: "ResumeTask" }),
      pauseBlock: (reason) => run(blockId, { type: "PauseBlock", ...(reason ? { reason } : {}) }),
      resumeBlock: () => run(blockId, { type: "ResumeBlock" }),
      completeTask: () => run(blockId, { type: "CompleteTask" }),
      skipTask: (taskId) => run(blockId, { type: "SkipTask", ...(taskId ? { taskId } : {}) }),
      switchTask: (toTaskId) => run(blockId, { type: "SwitchTask", toTaskId }),
      replan: () => run(blockId, { type: "ReplanBlock" }),
      terminate: (reason = "user_exit") => run(blockId, { type: "TerminateSession", reason }),
    }),
    [blocks, generateId, run],
  );

  const value = useMemo<SeiSessionContextType>(() => {
    const live = blocks
      .filter(isLive)
      .sort((a, b) => {
        // running beats paused, then most recent activity
        if (a.projection.status !== b.projection.status) {
          return a.projection.status === "running" ? -1 : 1;
        }
        return (b.projection.lastEventAt ?? "").localeCompare(a.projection.lastEventAt ?? "");
      });
    const active = live[0] ?? null;
    const activeTask =
      active && active.projection.activeTaskId
        ? active.projection.taskStates[active.projection.activeTaskId]
        : null;

    return {
      now,
      clock,
      blocks,
      getBlock: (blockId) => blocks.find((b) => b.block.id === blockId),
      actionsFor,
      activeBlockId: active?.block.id ?? null,
      activeTaskId: active?.projection.activeTaskId ?? null,
      projection: active?.projection ?? null,
      sessionTime: {
        elapsedSec: activeTask?.elapsedSec ?? 0,
        remainingSec: activeTask?.remainingSec ?? 0,
        progress: activeTask?.progress ?? 0,
      },
    };
  }, [actionsFor, blocks, clock, now]);

  return <SeiSessionContext.Provider value={value}>{children}</SeiSessionContext.Provider>;
};
