import type { Provenance, TerminationReason } from "../events";
import type { BlockId, SessionId, TaskId, UserId } from "../ids";

interface CommandBase {
  blockId: BlockId;
  userId: UserId;
  at: string;
  // defaults to a human clicking the timer
  provenance?: Partial<Provenance>;
}

export type ExecutionCommand =
  | (CommandBase & {
      type: "StartBlock";
      sessionId: SessionId;
      taskId?: TaskId; // start from this task instead of the first one
    })
  | (CommandBase & { type: "PauseTask"; reason?: string })
  | (CommandBase & { type: "ResumeTask" })
  | (CommandBase & { type: "PauseBlock"; reason?: string })
  | (CommandBase & { type: "ResumeBlock"; reason?: string })
  | (CommandBase & { type: "CompleteTask" })
  | (CommandBase & {
      type: "SkipTask";
      taskId?: TaskId; // defaults to the active task
    })
  | (CommandBase & { type: "SwitchTask"; toTaskId: TaskId })
  // re-snapshot the current plan into a running block (e.g. a task was added)
  | (CommandBase & { type: "ReplanBlock" })
  | (CommandBase & { type: "TerminateSession"; reason: TerminationReason });

export type ExecutionCommandType = ExecutionCommand["type"];
