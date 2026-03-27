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
      taskId: TaskId;
      at: string;
      reason?: string;
    }
  | {
      type: "ResumeTask";
      blockId: BlockId;
      taskId: TaskId;
      at: string;
    }
  | {
      type: "CompleteTask";
      blockId: BlockId;
      taskId: TaskId;
      at: string;
    }
  | {
      type: "SwitchTask";
      blockId: BlockId;
      fromTaskId: TaskId;
      toTaskId: TaskId;
      at: string;
    }
  | {
      type: "TerminateSession";
      blockId: BlockId;
      at: string;
      reason: "manual" | "block_completed" | "task_deleted" | "block_deleted";
    };
