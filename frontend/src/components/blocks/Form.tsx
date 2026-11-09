import TaskForm from "./taskform";
import React, { useState } from "react";
import { Input } from "../primitives/input";
import { Add, Cancel, Check, Delete, Edit } from "../primitives/icons";
import type { BlockView } from "../../sei/session/seiSessionContext";
import {
  draftFromPlan,
  type DraftTask,
  type PlanDraft,
} from "../../sei/store/planDraft";

interface BlockFormProps {
  mode?: "create" | "edit";
  closeForm: () => void;
  initialBlock?: BlockView | null;
  onSubmit: (draft: PlanDraft) => void;
}

export const BlockForm: React.FC<BlockFormProps> = ({
  mode = "create",
  initialBlock = null,
  onSubmit,
  closeForm,
}: BlockFormProps) => {
  const initial =
    mode === "edit" && initialBlock
      ? draftFromPlan(initialBlock.block, initialBlock.tasks)
      : null;

  const [tasks, setTasks] = useState<DraftTask[]>(initial?.tasks ?? []);
  const [showTask, setShowTask] = useState<boolean>(true);
  const [sessionName, setSessionName] = useState<string>(initial?.name ?? "");
  const [sessionHours, setSessionHours] = useState<string>(
    initial ? String(Math.floor(initial.plannedMinutes / 60)) : "",
  );
  const [sessionMinutes, setSessionMinutes] = useState<string>(
    initial ? String(initial.plannedMinutes % 60) : "",
  );
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const status = initialBlock?.projection.status ?? "idle";
  const isFinished = status === "completed" || status === "terminated";
  const isLive = status === "running" || status === "paused";
  // tasks with recorded history cannot be removed or re-timed
  const hasHistory = (taskId: string) => {
    const state = initialBlock?.projection.taskStates[taskId as never];
    return !!state && (state.startedAt !== null || state.status !== "pending");
  };

  const hours = parseInt(sessionHours || "0", 10);
  const minutes = parseInt(sessionMinutes || "0", 10);

  const totalDuration = hours * 60 + minutes;
  const totalTaskDuration = tasks.reduce(
    (acc, task) => acc + Number(task.minutes),
    0,
  );
  const remainingTime = totalDuration - totalTaskDuration;

  const handleEditChange = (
    id: string,
    field: keyof DraftTask,
    value: string | number,
  ) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === id
          ? { ...task, [field]: field === "minutes" ? Number(value) : value }
          : task,
      ),
    );
  };

  const removeTasks = (id: string) => {
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name: sessionName, plannedMinutes: totalDuration, tasks });
  };

  return (
    <>
      <div className="block-form-wrapper flex justify-center items-center fixed inset-0 bg-black/60 z-50">
        <div
          role="dialog"
          aria-label={mode === "edit" ? "Edit block" : "Create block"}
          className="overflow-y-scroll max-h-[90vh] block-form-card bg-white text-gray-900 border-2 border-gray-200 rounded-lg p-6
                  w-full sm:w-3/4 md:w-1/2 lg:w-[50%] shadow-lg mx-auto"
        >
          <div className="form-header my-4">
            <div className="flex rounded-lg items-center">
              <Add size="1.4em" color={"black"} classNames={["mr-4"]} />
              <p className="text-xl">
                {mode === "edit"
                  ? "Edit Time Block"
                  : "Create Your First Time Block"}
              </p>
            </div>
            {mode === "edit" && isFinished && (
              <p className="text-sm text-gray-500 mt-2">
                This block has finished. Edits change the plan only; its
                recorded history stays as it happened.
              </p>
            )}
            {mode === "edit" && isLive && (
              <p className="text-sm text-gray-500 mt-2">
                This block is running. New tasks join the queue; tasks already
                started keep their original plan.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <div className="block-name-wrapper flex flex-col">
                <label htmlFor="block-name" className="text-lg font-medium">
                  Session Name
                </label>
                <input
                  type="text"
                  id="block-name"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g., Morning Study Block, Evening Routine"
                  className="bg-gray-100 rounded-lg p-2 mt-2 focus:bg-gray-100 focus:border-4 focus:border-gray-300 focus:outline-gray-300 "
                />
              </div>
            </div>

            <div className="duration-wrapper flex justify-between w-full my-8 text-lg font-medium">
              <div className="hours flex flex-col w-[49%] ">
                <label htmlFor="total-session-duration">Total Hours</label>
                <input
                  min="0"
                  max="23"
                  type="number"
                  value={sessionHours}
                  id="total-session-duration"
                  className="bg-gray-100 rounded-lg p-2 mt-2 focus:border-4 focus:border-gray-300 focus:outline-gray-300"
                  placeholder="2"
                  onChange={(e) => setSessionHours(e.target.value || "")}
                />
              </div>
              <div className="minutes flex flex-col w-[49%]">
                <label htmlFor="total-session-minutes">Total Minutes</label>
                <input
                  type="number"
                  id="total-session-minutes"
                  min="0"
                  max="59"
                  value={sessionMinutes}
                  className="bg-gray-100 rounded-lg p-2 mt-2 focus:border-4 focus:border-gray-300 focus:outline-gray-300"
                  placeholder="0"
                  onChange={(e) => setSessionMinutes(e.target.value || "")}
                />
              </div>
            </div>

            <div
              className={`tasks-choice-container flex justify-between items-center ${mode === "edit" ? "hidden" : ``}`}
            >
              <div className="task-setup">
                <p className="text-md text-lg font-medium">Task Setup</p>
                <span className="text-sm text-gray-500">
                  {showTask ? "Add tasks now" : "Add tasks later"}
                </span>
              </div>

              <div className="toggle-switch w-[25%] flex justify-between items-center text-md">
                <label htmlFor="switch-tasks">Add later</label>
                <input
                  type="checkbox"
                  id="switch-tasks"
                  role="switch"
                  checked={showTask}
                  onChange={() => setShowTask(!showTask)}
                  className="relative h-6 w-12 appearance-none rounded-full bg-neutral-300 transition-colors duration-300
                              before:pointer-events-none before:absolute before:h-6 before:w-6 before:rounded-full before:content-['']
                              after:absolute after:z-2 after:mt-[0.1rem] after:ml-[0.1rem]
                              after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform after:duration-300 after:content-['']
                            checked:bg-black checked:after:translate-x-6
  "
                />
                <label htmlFor="switch-tasks">Add now</label>
              </div>
            </div>

            <div className="tasks-container">
              <div className="tasks-wrapper">
                {(showTask || mode === "edit") && <TaskForm setTasks={setTasks} />}
              </div>

              <div className="tasklist-wrapper my-6">
                {tasks.length > 0 && (
                  <ul className="tasklist grid gap-4">
                    {tasks.map((task) => (
                      <li
                        key={task.id}
                        className="flex items-center p-3 bg-gray-100 rounded-lg"
                      >
                        {editingTaskId === task.id ? (
                          <div className="flex justify-between w-full gap-4">
                            <Input
                              type="text"
                              id="task"
                              aria-label="Edit task name"
                              inputValue={task.name}
                              setValue={(newValue) => {
                                handleEditChange(task.id, "name", newValue);
                              }}
                              className={`basis-[65%] mt-0 bg-white border py-1`}
                            />
                            <Input
                              type="number"
                              id="task-in-minutes"
                              aria-label="Edit task minutes"
                              inputValue={task.minutes.toString()}
                              disabled={hasHistory(task.id)}
                              setValue={(newValue) => {
                                handleEditChange(task.id, "minutes", newValue);
                              }}
                              className={`basis-[15%] mt-0 bg-white border py-1`}
                            />
                            <div className="edit-icons basis-[14%] flex justify-between items-center">
                              <Check
                                size="1.4em"
                                label="save task"
                                classNames={[
                                  "inline-block mx-2 hover:text-green-600 cursor-pointer",
                                ]}
                                onClick={() => setEditingTaskId(null)}
                              />
                              <Cancel
                                size="1.8em"
                                label="cancel edit"
                                classNames={[
                                  "inline-block mx-2 hover:text-red-600 cursor-pointer",
                                ]}
                                onClick={() => setEditingTaskId(null)}
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <span>
                              {task.name}{" "}
                              <span className="text-sm text-gray-500">
                                ({task.minutes}{" "}
                                {task.minutes <= 1 ? "min" : "mins"})
                              </span>
                            </span>
                            <div className="task-icons ml-auto">
                              <Edit
                                label={`edit ${task.name}`}
                                classNames={[
                                  "inline-block mx-2 hover:text-blue-600",
                                ]}
                                onClick={() => setEditingTaskId(task.id)}
                              />
                              {!hasHistory(task.id) && (
                                <Delete
                                  label={`delete ${task.name}`}
                                  classNames={[
                                    "inline-block mx-2  hover:text-red-600",
                                  ]}
                                  onClick={() => removeTasks(task.id)}
                                />
                              )}
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {tasks.length > 0 && (
              <div className="tasks-summary bg-gray-100 p-4 rounded-lg tracking-wide">
                <div className="flex justify-between">
                  <div className="task-total-remainder font-medium">
                    <p>
                      Task Total:{" "}
                      <span className="text-gray-500">
                        {totalTaskDuration}m
                      </span>
                    </p>
                    {totalDuration > 0 && (
                      <p className="text-gray-500 mt-1">
                        {totalTaskDuration === totalDuration
                          ? "Perfect fit!"
                          : remainingTime < 0
                            ? `${-remainingTime}m over budget`
                            : `${remainingTime}m remaining`}
                      </p>
                    )}
                  </div>
                  <p className="font-medium">
                    Session Total:{" "}
                    <span className="text-gray-500">{totalDuration}m</span>
                  </p>
                </div>
              </div>
            )}

            <div className="create-session-container mt-8">
              <div className="create-session-container w-full flex justify-between items-center">
                <button
                  type="submit"
                  disabled={!sessionName || (!sessionHours && !sessionMinutes)}
                  className="create-session-btn bg-black text-white text-md p-2 rounded-lg w-[73%] disabled:bg-gray-300 disabled:text-white disabled:cursor-not-allowed"
                >
                  {mode === "edit" ? "Save Changes" : "Create Session"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="w-[23%] border border-gray-300 rounded-lg p-2 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
