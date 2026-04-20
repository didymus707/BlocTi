import type { SeiEvent } from "../events";
import type { BlockPlan, TaskPlan } from "../plan";
import { projectBlock } from "../projection";
import type { ExecutionCommand } from "./executionCommand";

export type CreateEvent<T extends SeiEvent["type"]> = Omit<
  Extract<SeiEvent, { type: T }>,
  "eventId" | "seq"
>;

type CommandResult = Omit<SeiEvent, "eventId" | "seq">;

export const resolveCommand = (
  block: BlockPlan,
  tasks: TaskPlan[],
  events: SeiEvent[],
  command: ExecutionCommand,
): CommandResult[] => {
  const state = projectBlock(block, tasks, events);
  const { status } = state;
  const orderedTasks = tasks
    .filter((task) => block.id === task.blockId)
    .sort((a, b) => a.order - b.order);

  switch (command.type) {
    case "StartBlock": {
      if (status !== "idle") return [];
      const firstTask = orderedTasks[0];
      if (!firstTask) return [];

      return [
        {
          type: "BlockStarted",
          userId: command.userId,
          blockId: block.id,
          sessionId: command.sessionId,
          occurredAt: command.at,
        } as CreateEvent<"BlockStarted">,
        {
          type: "TaskStarted",
          taskId: firstTask.id,
          userId: command.userId,
          blockId: block.id,
          sessionId: command.sessionId,
          occurredAt: command.at,
        } as CreateEvent<"TaskStarted">,
      ];
    }
    case "PauseTask": {
      const { activeTaskId, isPaused, sessionId } = state;
      if (status !== "running" || !activeTaskId || isPaused || !sessionId)
        return [];
      return [
        {
          type: "TaskPaused",
          taskId: activeTaskId,
          userId: command.userId,
          blockId: block.id,
          sessionId,
          occurredAt: command.at,
          reason: command.reason,
        } as CreateEvent<"TaskPaused">,
      ];
    }
    case "ResumeTask": {
      const { activeTaskId, sessionId, isPaused } = state;
      if (status !== "paused" || !activeTaskId || !sessionId || !isPaused)
        return [];
      return [
        {
          type: "TaskResumed",
          taskId: activeTaskId,
          userId: command.userId,
          blockId: block.id,
          sessionId,
          occurredAt: command.at,
        } as CreateEvent<"TaskResumed">,
      ];
    }
    case "CompleteTask": {
      const { activeTaskId, sessionId, isPaused } = state;
      if (status !== "running" || !activeTaskId || !sessionId || isPaused)
        return [];
      const results: CommandResult[] = [
        {
          type: "TaskCompleted",
          taskId: activeTaskId,
          blockId: block.id,
          userId: command.userId,
          occurredAt: command.at,
          sessionId,
        } as CreateEvent<"TaskCompleted">,
      ];

      const currentIndex = orderedTasks.findIndex((t) => t.id === activeTaskId);
      const nextTask = orderedTasks[currentIndex + 1];

      if (nextTask) {
        results.push({
          type: "TaskStarted",
          taskId: nextTask.id,
          userId: command.userId,
          blockId: block.id,
          sessionId,
          occurredAt: command.at,
        } as CreateEvent<"TaskStarted">);
      } else {
        results.push({
          type: "BlockCompleted",
          userId: command.userId,
          blockId: block.id,
          sessionId,
          occurredAt: command.at,
        } as CreateEvent<"BlockCompleted">);
      }
      return results;
    }
    default:
      return [];
  }
};
