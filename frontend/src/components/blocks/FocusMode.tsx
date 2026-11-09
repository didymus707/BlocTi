import Button from "../primitives/button";
import { Close, Pause, Play } from "../primitives/icons";
import type { BlockActions, BlockView } from "../../sei/session/seiSessionContext";
import { formatClock } from "../../utils";

interface FocusModeProps {
  view: BlockView;
  actions: BlockActions;
  onClose: () => void;
}

export const FocusMode = ({ view, actions, onClose }: FocusModeProps) => {
  const { block, projection, metrics } = view;
  const currentTask = projection.activeTaskId
    ? projection.taskStates[projection.activeTaskId]
    : null;
  const isRunning = projection.status === "running";
  const blockProgress =
    metrics.plannedFocusSec > 0
      ? Math.min(100, (metrics.focusSec / metrics.plannedFocusSec) * 100)
      : 0;

  return (
    <div
      role="dialog"
      aria-label="Focus mode"
      className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-between p-12 animate-in fade-in duration-300"
    >
      <div className="w-full flex justify-end">
        <button
          onClick={onClose}
          aria-label="Close focus mode"
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Close size="32" />
        </button>
      </div>

      <div className="flex flex-col items-center text-center">
        <span className="text-sm uppercase tracking-[0.2em] text-gray-400 mb-4 font-medium">
          Current Focus
        </span>
        <h1 className="text-3xl font-semibold text-black mb-12">
          {currentTask?.title || "No Active Task"}
        </h1>

        <span
          aria-label="Focus timer"
          className={`text-[8rem] md:text-[14rem] font-light tabular-nums leading-none tracking-tighter ${
            currentTask && currentTask.overrunSec > 0 ? "text-red-600" : "text-black"
          }`}
        >
          {currentTask
            ? currentTask.overrunSec > 0
              ? `+${formatClock(currentTask.overrunSec)}`
              : formatClock(currentTask.remainingSec)
            : "--:--"}
        </span>
      </div>

      <div className="w-full max-w-md flex flex-col items-center gap-12">
        <div className="w-full space-y-2">
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-400">
            <span>{block.name}</span>
            <span>{Math.round(blockProgress)}%</span>
          </div>
          <div className="h-[2px] w-full bg-gray-100">
            <div
              className="h-full bg-black transition-all duration-500"
              style={{ width: `${blockProgress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-8">
          {isRunning ? (
            <Button
              variant="secondary"
              aria-label="Pause"
              onClick={() => actions.pauseTask()}
              className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-black"
            >
              <Pause size="24" color="black" />
            </Button>
          ) : (
            <Button
              variant="primary"
              aria-label="Resume"
              onClick={() =>
                projection.pauseKind === "block" ? actions.resumeBlock() : actions.resumeTask()
              }
              className="w-16 h-16 rounded-full flex items-center justify-center bg-black text-white"
            >
              <Play size="28" color="white" />
            </Button>
          )}
          <Button variant="secondary" onClick={() => actions.completeTask()} disabled={!currentTask}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
