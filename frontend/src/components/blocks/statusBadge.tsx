import type { ExecutionStatus } from "../../sei/domain/projection";

const styles: Record<ExecutionStatus, string> = {
  running: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-gray-200 text-gray-700",
  terminated: "bg-red-100 text-red-700",
  idle: "bg-blue-100 text-blue-700",
};

const labels: Record<ExecutionStatus, string> = {
  running: "running",
  paused: "paused",
  completed: "completed",
  terminated: "stopped",
  idle: "idle",
};

export const StatusBadge = ({ status }: { status: ExecutionStatus }) => (
  <span
    data-testid="block-status"
    className={`text-xs font-medium px-2 py-1 rounded-full ${styles[status]}`}
  >
    {labels[status]}
  </span>
);
