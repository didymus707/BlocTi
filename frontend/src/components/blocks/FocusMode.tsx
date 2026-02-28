// src/components/blocks/FocusMode.tsx
import { useSession } from "../../context/sessionContext";
import Button from "../primitives/button";
import { Close, Pause, Play } from "../primitives/icons";

interface FocusModeProps {
  onClose: () => void;
}

export const FocusMode = ({ onClose }: FocusModeProps) => {
  const { activeBlock, activeTaskId, sessionTime, pause, resume } =
    useSession();

  if (!activeBlock || !activeTaskId) return null;

  const currentTask = activeBlock.tasks.find((t) => t.id === activeTaskId);
  const isRunning = activeBlock.status === "running";

  // Helper to format the seconds into MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-between p-12 animate-in fade-in duration-300">
      {/* Top Navigation */}
      <div className="w-full flex justify-end">
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Close size='32' />
        </button>
      </div>

      {/* Center Content: The Large Timer */}
      <div className="flex flex-col items-center text-center">
        <span className="text-sm uppercase tracking-[0.2em] text-gray-400 mb-4 font-medium">
          Current Focus
        </span>
        <h1 className="text-3xl font-semibold text-black mb-12">
          {currentTask?.name || "No Active Task"}
        </h1>

        <div className="relative flex items-center justify-center">
          {/* Large Countdown */}
          <span className="text-[12rem] md:text-[16rem] font-light tabular-nums leading-none tracking-tighter text-black">
            {formatTime(sessionTime.remaining)}
          </span>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="w-full max-w-md flex flex-col items-center gap-12">
        {/* Session Progress Bar */}
        <div className="w-full space-y-2">
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-400">
            <span>{activeBlock.name}</span>
            <span>{Math.round(sessionTime.progress)}%</span>
          </div>
          <div className="h-[2px] w-full bg-gray-100">
            <div
              className="h-full bg-black transition-all duration-500"
              style={{ width: `${sessionTime.progress}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-8">
          {isRunning ? (
            <Button
              variant="secondary"
              onClick={pause}
              className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-black"
            >
              <Pause size='24' color="black" />
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => resume(activeBlock, activeTaskId)}
              className="w-16 h-16 rounded-full flex items-center justify-center bg-black text-white"
            >
              <Play size='28' color="white"  />
            </Button>
          )}

          {/* <button
            onClick={skipTask}
            className="p-4 text-gray-400 hover:text-black transition-colors"
            title="Skip Task"
          >
            <Skip size='28' />
          </button> */}
        </div>
      </div>
    </div>
  );
};
