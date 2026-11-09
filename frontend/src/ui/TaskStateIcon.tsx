import type { TaskStatus } from "../sei/domain/projection";

const LABEL: Record<TaskStatus, string> = {
  pending: "Pending",
  running: "Running",
  paused: "Paused",
  completed: "Completed",
  skipped: "Skipped",
};

export const TaskStateIcon = ({ status, size = 20 }: { status: TaskStatus; size?: number }) => {
  if (status === "running") {
    return (
      <span
        role="img"
        aria-label={LABEL.running}
        className="flex shrink-0 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-live shadow-[0_0_0_4px_var(--color-live-halo)]" />
      </span>
    );
  }
  const stroke =
    status === "paused" ? "var(--color-amber)" : status === "completed" ? "var(--color-ink)" : "var(--color-faint)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={status === "skipped" ? "3 3" : undefined}
      role="img"
      aria-label={LABEL[status]}
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      {status === "completed" && <path d="M8 12.5l2.5 2.5L16 9.5" strokeDasharray="none" />}
      {status === "paused" && <path d="M10 9v6M14 9v6" />}
      {status === "skipped" && <path d="M8 16L16 8" strokeDasharray="none" />}
    </svg>
  );
};
