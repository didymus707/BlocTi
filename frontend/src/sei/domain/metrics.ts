// Execution Metrics
export interface ExecutionMetrics {
  plannedFocusTimeSec: number;
  actualFocusTimeSec: number;
  pauseTimeSec: number;
  completedTasks: number;
  skippedTasks: number;
  executionDriftSec: number; // actual - planned
  executionFidelity: number; // ratio of completed to planned tasks
}
