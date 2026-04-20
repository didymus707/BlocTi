import type { BlockId, SessionId, TaskId, UserId } from "../ids";

export type ExecutionCommand =
  | {
      type: "StartBlock";
      blockId: BlockId;
      sessionId: SessionId;
      userId: UserId;
      at: string;
    }
  | {
      type: "PauseTask";
      blockId: BlockId;
      userId: UserId;
      at: string;
      reason?: string;
    }
  | {
      type: "ResumeTask";
      blockId: BlockId;
      userId: UserId;
      at: string;
    }
  | {
      type: "CompleteTask";
      blockId: BlockId;
      userId: UserId;
      at: string;
    }
  | {
      type: "SwitchTask";
      blockId: BlockId;
      toTaskId: TaskId;
      at: string;
    }
  | {
      type: "TerminateSession";
      blockId: BlockId;
      userId: UserId;
      at: string;
      reason: "manual" | "block_completed" | "task_deleted" | "block_deleted";
    };
