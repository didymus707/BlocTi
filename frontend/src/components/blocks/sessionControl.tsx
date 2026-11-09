import Button from "../primitives/button";
import type { BlockExecutionProjection } from "../../sei/domain/projection";
import type { BlockActions } from "../../sei/session/seiSessionContext";

interface Props {
  projection: BlockExecutionProjection;
  actions: BlockActions;
  onRunAgain: () => void;
  disabled?: boolean;
}

export const SessionControl = ({ projection, actions, onRunAgain, disabled }: Props) => {
  const { status, pauseKind, activeTaskId, taskOrder } = projection;
  const stop = (
    <Button variant="ghost" disabled={disabled} onClick={() => actions.terminate("user_exit")}>
      Stop Session
    </Button>
  );

  return (
    <div className="flex justify-center mt-8">
      {status === "idle" ? (
        <Button
          variant="primary"
          disabled={disabled || taskOrder.length === 0}
          title={taskOrder.length === 0 ? "Add a task first" : undefined}
          onClick={() => actions.start()}
        >
          Start Session
        </Button>
      ) : status === "completed" || status === "terminated" ? (
        <Button variant="secondary" disabled={disabled} onClick={onRunAgain}>
          Run Again
        </Button>
      ) : status === "paused" && pauseKind === "block" ? (
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="primary" disabled={disabled} onClick={() => actions.resumeBlock()}>
            End Break
          </Button>
          {stop}
        </div>
      ) : status === "paused" ? (
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="primary" disabled={disabled} onClick={() => actions.resumeTask()}>
            Resume
          </Button>
          <Button variant="secondary" disabled={disabled || !activeTaskId} onClick={() => actions.completeTask()}>
            Complete Task
          </Button>
          {stop}
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="secondary" disabled={disabled || !activeTaskId} onClick={() => actions.pauseTask()}>
            Pause
          </Button>
          <Button variant="primary" disabled={disabled || !activeTaskId} onClick={() => actions.completeTask()}>
            Complete Task
          </Button>
          <Button variant="secondary" disabled={disabled || !activeTaskId} onClick={() => actions.skipTask()}>
            Skip Task
          </Button>
          <Button variant="ghost" disabled={disabled} onClick={() => actions.pauseBlock("break")}>
            Take a Break
          </Button>
          {stop}
        </div>
      )}
    </div>
  );
};
