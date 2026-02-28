import Button from "../primitives/button";

interface Props {
  status: "idle" | "running" | "paused" | 'completed';
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onResume: () => void;
  hasPausedTask: boolean | null;
}

export const SessionControl = ({
  status,
  onStart,
  onPause,
  onReset,
  onResume,
  hasPausedTask,
}: Props) => {
  return (
    <div className="flex justify-center mt-8">
      {hasPausedTask ? (
        <div className="flex gap-3">
          <Button variant="primary" onClick={onResume}>
            Resume Session
          </Button>
          <Button variant="ghost" onClick={onReset}>
            Reset
          </Button>
        </div>
      ) : status === "running" ? (
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onPause}>
            Pause
          </Button>
          <Button variant="ghost" onClick={onReset}>
            Reset
          </Button>
        </div>
      ) : (
        <Button variant="primary" onClick={onStart}>
          Start Session
        </Button>
      )}
    </div>
  );
};
