import { HUMAN_TIMER, type SeiEvent } from "../events";
import type { TaskId } from "../ids";
import { snapshotPlan, type BlockPlan, type TaskPlan } from "../plan";
import {
  projectBlock,
  type BlockExecutionProjection,
} from "../projection";
import type { ExecutionCommand } from "./executionCommand";

export type CreateEvent<T extends SeiEvent["type"]> = Omit<
  Extract<SeiEvent, { type: T }>,
  "eventId" | "seq"
>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type CommandResult = DistributiveOmit<SeiEvent, "eventId" | "seq">;

const isUnfinished = (state: BlockExecutionProjection, taskId: TaskId) => {
  const task = state.taskStates[taskId];
  return !!task && task.status !== "completed" && task.status !== "skipped";
};

// the next unfinished task after `fromTaskId` in plan order, wrapping around
// to tasks that were switched away from earlier
const nextUnfinishedTask = (
  state: BlockExecutionProjection,
  fromTaskId: TaskId,
): TaskId | null => {
  const order = state.taskOrder;
  const from = order.indexOf(fromTaskId);
  const rotated = [...order.slice(from + 1), ...order.slice(0, from + 1)];
  return (
    rotated.find((id) => id !== fromTaskId && isUnfinished(state, id)) ?? null
  );
};

// Validates a command against projected truth and returns the event payloads
// it produces. An invalid command produces no events. Pure: time comes from
// command.at and ids/seq are assigned later by appendEvents or the server.
export const resolveCommand = (
  block: BlockPlan,
  tasks: TaskPlan[],
  events: SeiEvent[],
  command: ExecutionCommand,
): CommandResult[] => {
  if (command.blockId !== block.id) return [];

  const state = projectBlock(block, tasks, events, command.at);
  const { status, activeTaskId, sessionId } = state;
  const isLive = status === "running" || status === "paused";

  const base = {
    ...HUMAN_TIMER,
    ...command.provenance,
    userId: command.userId,
    blockId: block.id,
    occurredAt: command.at,
  };

  // after the active task finishes: start the next one, or complete the block
  const advanceFrom = (
    finishedTaskId: TaskId,
    session: NonNullable<typeof sessionId>,
  ): CommandResult[] => {
    const next = nextUnfinishedTask(state, finishedTaskId);
    return next
      ? [{ ...base, sessionId: session, type: "TaskStarted", taskId: next }]
      : [{ ...base, sessionId: session, type: "BlockCompleted" }];
  };

  switch (command.type) {
    case "StartBlock": {
      if (status !== "idle") return [];
      const snapshot = snapshotPlan(block, tasks);
      const first = command.taskId
        ? snapshot.tasks.find((t) => t.taskId === command.taskId)
        : snapshot.tasks[0];
      if (!first) return [];
      const session = { ...base, sessionId: command.sessionId };
      return [
        { ...session, type: "BlockPlanned", ...snapshot },
        { ...session, type: "BlockStarted" },
        { ...session, type: "TaskStarted", taskId: first.taskId },
      ];
    }
    case "PauseTask": {
      if (status !== "running" || !activeTaskId || !sessionId) return [];
      return [
        {
          ...base,
          sessionId,
          type: "TaskPaused",
          taskId: activeTaskId,
          ...(command.reason ? { reason: command.reason } : {}),
        },
      ];
    }
    case "ResumeTask": {
      if (state.pauseKind !== "task" || !activeTaskId || !sessionId) return [];
      return [{ ...base, sessionId, type: "TaskResumed", taskId: activeTaskId }];
    }
    case "PauseBlock": {
      if (status !== "running" || !sessionId) return [];
      return [
        {
          ...base,
          sessionId,
          type: "BlockPaused",
          ...(command.reason ? { reason: command.reason } : {}),
        },
      ];
    }
    case "ResumeBlock": {
      if (state.pauseKind !== "block" || !sessionId) return [];
      return [
        {
          ...base,
          sessionId,
          type: "BlockResumed",
          ...(command.reason ? { reason: command.reason } : {}),
        },
      ];
    }
    case "CompleteTask": {
      if (!isLive || !activeTaskId || !sessionId) return [];
      return [
        { ...base, sessionId, type: "TaskCompleted", taskId: activeTaskId },
        ...advanceFrom(activeTaskId, sessionId),
      ];
    }
    case "SkipTask": {
      const taskId = command.taskId ?? activeTaskId;
      if (!isLive || !sessionId || !taskId || !isUnfinished(state, taskId))
        return [];
      const skipped: CommandResult = {
        ...base,
        sessionId,
        type: "TaskSkipped",
        taskId,
      };
      if (taskId === activeTaskId) {
        return [skipped, ...advanceFrom(taskId, sessionId)];
      }
      return [skipped];
    }
    case "SwitchTask": {
      const { toTaskId } = command;
      if (
        !isLive ||
        !sessionId ||
        !activeTaskId ||
        toTaskId === activeTaskId ||
        !isUnfinished(state, toTaskId)
      )
        return [];
      return [
        {
          ...base,
          sessionId,
          type: "TaskSwitched",
          fromTaskId: activeTaskId,
          toTaskId,
        },
      ];
    }
    case "ReplanBlock": {
      if (!isLive || !sessionId) return [];
      return [
        { ...base, sessionId, type: "BlockPlanned", ...snapshotPlan(block, tasks) },
      ];
    }
    case "TerminateSession": {
      if (!isLive || !sessionId) return [];
      return [
        { ...base, sessionId, type: "SessionTerminated", reason: command.reason },
      ];
    }
    default:
      return [];
  }
};
