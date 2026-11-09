import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import { Card } from "../components/primitives/card";
import Button from "../components/primitives/button";
import { Clock } from "../components/primitives/icons";
import { TaskModal } from "../components/modals/task";
import { FocusMode } from "../components/blocks/FocusMode";
import { TimeProgress } from "../components/blocks/timeProgress";
import { SessionControl } from "../components/blocks/sessionControl";
import { MetricsPanel } from "../components/blocks/metricsPanel";
import { EventTrace } from "../components/blocks/eventTrace";
import { StatusBadge } from "../components/blocks/statusBadge";
import { useBlockUI } from "../context/blockUIContext";
import { useSeiSession } from "../sei/session/seiSessionContext";
import { useSeiStore } from "../sei/store/seiStoreContext";
import { duplicatePlan } from "../sei/store/planDraft";
import {
  orderedTaskStates,
  type TaskExecutionState,
} from "../sei/domain/projection";
import type { TaskId } from "../sei/domain/ids";
import { formatClock, formatDuration } from "../utils";

const taskStatusLabel: Record<TaskExecutionState["status"], string> = {
  pending: "",
  running: "running",
  paused: "paused",
  completed: "done",
  skipped: "skipped",
};

export const CardDetails = () => {
  const navigate = useNavigate();
  const goBack = () => navigate(-1);
  const { id } = useParams<{ id: string }>();
  const { openEditModal } = useBlockUI();
  const { status: storeStatus, savePlan, deleteBlock, generateId } = useSeiStore();
  const { getBlock, actionsFor, clock } = useSeiSession();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

  const view = getBlock(id);

  if (!view) {
    return (
      <div className="p-6 text-gray-600">
        {storeStatus === "loading" ? "Loading…" : "Block not found."}
      </div>
    );
  }

  const { block, tasks, projection, metrics, events, capturedByAgent } = view;
  const actions = actionsFor(block.id);
  const isLive = projection.status === "running" || projection.status === "paused";
  const isFinished =
    projection.status === "completed" || projection.status === "terminated";
  // blocks recorded by an agent hook are read-only: timer controls would mix
  // human clicks into an agent trace
  const readOnly = isFinished || capturedByAgent;
  const taskStates = orderedTaskStates(projection);
  const activeTask = projection.activeTaskId
    ? projection.taskStates[projection.activeTaskId]
    : null;

  const warnIfRejected = (events: unknown[], message: string) => {
    if (events.length === 0) toast.warn(message);
  };

  const onTaskClick = (task: TaskExecutionState) => {
    if (task.status === "completed" || task.status === "skipped") return;
    if (projection.status === "idle") {
      warnIfRejected(actions.start(task.taskId), "Could not start this task.");
    } else if (isLive && task.taskId !== projection.activeTaskId) {
      warnIfRejected(actions.switchTask(task.taskId), "Could not switch to this task.");
    }
  };

  const removeTaskFromPlan = (taskId: TaskId) => {
    const remaining = tasks.filter((t) => t.id !== taskId);
    savePlan({ ...block, taskIds: remaining.map((t) => t.id) }, remaining);
    if (isLive) actions.replan();
  };

  const safeDeleteBlock = () => {
    deleteBlock(block.id);
    toast("Block deleted");
    navigate("/");
  };

  const runAgain = () => {
    const copy = duplicatePlan(block, tasks, generateId, clock());
    savePlan(copy.block, copy.tasks);
    navigate(`/block/${copy.block.id}`);
  };

  const sessionProgress =
    projection.status === "completed"
      ? 100
      : metrics.plannedFocusSec > 0
        ? (metrics.focusSec / metrics.plannedFocusSec) * 100
        : 0;
  const remainingFocus = taskStates.reduce((acc, t) => acc + t.remainingSec, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button
        onClick={goBack}
        className="text-blue-600 hover:underline mb-4 flex items-center gap-1"
      >
        ← Back
      </button>

      <Card
        title={block.name}
        icon={<Clock color="black" classNames={["mr-2"]} />}
        className="bg-transparent p-6 rounded-2xl border border-gray-200 mb-6"
        headerRight={
          <div className="flex items-center gap-2">
            <StatusBadge status={projection.status} />
            <button
              aria-label="Edit block"
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(block.id);
              }}
              className="text-[10px] uppercase tracking-widest px-2 py-1 border border-gray-200 rounded hover:border-black"
            >
              Edit
            </button>
            <button
              aria-label="Delete block"
              onClick={(e) => {
                e.stopPropagation();
                safeDeleteBlock();
              }}
              className="text-[10px] uppercase tracking-widest px-2 py-1 border border-gray-200 rounded hover:border-black"
            >
              Delete
            </button>
          </div>
        }
      >
        <TimeProgress
          label="Session Progress"
          elapsed={metrics.focusSec}
          planned={metrics.plannedFocusSec}
          remaining={remainingFocus}
          progress={sessionProgress}
          variant="session"
        />

        <div className="mt-8 border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center gap-4">
            <h3 className="font-medium text-gray-700">Current Task:</h3>
            {activeTask ? (
              <span data-testid="current-task" className="text-gray-800 text-md">
                {activeTask.title}
                {projection.isPaused && (
                  <span className="ml-2 text-xs text-yellow-700">
                    ({projection.pauseKind === "block" ? "on a break" : "paused"})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-gray-600">No active task</span>
            )}
          </div>

          {activeTask && (
            <TimeProgress
              label="Task Progress"
              remaining={activeTask.remainingSec}
              planned={activeTask.plannedSec}
              elapsed={activeTask.elapsedSec}
              progress={activeTask.progress}
              overrun={activeTask.overrunSec}
              variant="task"
            />
          )}
        </div>

        <div className="task-queue w-full mx-auto">
          <div className="flex justify-between items-center mb-6 mt-8">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-400">
              Task Queue
            </h3>
            {taskStates.length > 0 && !readOnly && (
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="text-[10px] uppercase tracking-widest text-black hover:opacity-60 transition-opacity"
              >
                + Add
              </button>
            )}
          </div>

          {taskStates.length === 0 ? (
            <div className="flex flex-col items-center py-12 border border-dashed border-gray-200 rounded-sm">
              <p className="text-sm text-gray-400 mb-4">No tasks in the queue.</p>
              <Button
                onClick={() => setIsTaskModalOpen(true)}
                size="sm"
                variant="primary"
                className="text-[10px] uppercase tracking-widest px-6"
              >
                Initialize Queue
              </Button>
            </div>
          ) : (
            <ul aria-label="Task queue" className="space-y-3">
              {taskStates.map((task) => {
                const isActive = projection.activeTaskId === task.taskId;
                const isDone = task.status === "completed" || task.status === "skipped";
                const touched = task.startedAt !== null || task.status !== "pending";
                const inPlan = tasks.some((t) => t.id === task.taskId);

                return (
                  <li key={task.taskId} className="group flex items-stretch gap-2">
                    <button
                      onClick={() => onTaskClick(task)}
                      disabled={isDone || readOnly}
                      aria-label={`${task.title} ${taskStatusLabel[task.status]}`.trim()}
                      className={`
                flex-1 flex items-center justify-between p-4 rounded-sm transition-all duration-300
                ${isActive ? "bg-black text-white" : "bg-transparent text-gray-800 border border-gray-100 hover:border-black"}
                ${isDone ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
              `}
                    >
                      <div className="flex items-center gap-3">
                        {isActive && (
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        )}
                        <span
                          className={`text-sm font-medium ${task.status === "completed" ? "line-through" : ""}`}
                        >
                          {task.title}
                        </span>
                        {taskStatusLabel[task.status] && (
                          <span className="text-[10px] uppercase tracking-widest opacity-60">
                            {taskStatusLabel[task.status]}
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[10px] tabular-nums tracking-wider ${
                          isActive ? "text-gray-300" : "text-gray-400"
                        } ${task.overrunSec > 0 ? "text-red-500" : ""}`}
                      >
                        {touched ? `${formatClock(task.elapsedSec)} / ` : ""}
                        {formatDuration(task.plannedSec)}
                      </span>
                    </button>

                    {!isDone && !readOnly && (
                      <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-2">
                        {isLive && !isActive && (
                          <button
                            type="button"
                            onClick={() =>
                              warnIfRejected(actions.skipTask(task.taskId), "Could not skip this task.")
                            }
                            className="text-[10px] uppercase tracking-widest hover:opacity-60"
                          >
                            Skip
                          </button>
                        )}
                        {!touched && inPlan && (
                          <button
                            type="button"
                            onClick={() => removeTaskFromPlan(task.taskId)}
                            className="text-[10px] uppercase tracking-widest hover:opacity-60"
                            disabled={taskStates.length === 1}
                            title={
                              taskStates.length === 1 ? "You must keep at least 1 task" : ""
                            }
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {capturedByAgent ? (
          <p className="text-center text-xs text-gray-500 mt-8">
            Captured automatically by an agent hook. Pauses marked inferred
            were deduced, not observed.
          </p>
        ) : (
          <SessionControl
            projection={projection}
            actions={actions}
            onRunAgain={runAgain}
            disabled={storeStatus === "loading"}
          />
        )}

        {isLive && !capturedByAgent && (
          <div className="flex flex-col items-center w-full">
            <button
              onClick={() => setIsFocusMode(true)}
              className="mt-6 px-4 py-2 text-[10px] uppercase tracking-widest text-black bg-transparent hover:bg-gray-50 hover:tracking-[0.3em] transition-all duration-300 ease-in-out"
            >
              Expand to Focus Mode
            </button>
          </div>
        )}

        <MetricsPanel metrics={metrics} />
        <EventTrace events={events} projection={projection} />
      </Card>

      <TaskModal
        view={view}
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onPlanChanged={() => {
          if (isLive) actions.replan();
        }}
      />

      {isFocusMode && isLive && (
        <FocusMode view={view} actions={actions} onClose={() => setIsFocusMode(false)} />
      )}
    </div>
  );
};
