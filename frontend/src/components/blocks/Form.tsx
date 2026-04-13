import TaskForm from "./taskform";
import React, { useEffect, useState } from "react";
import { Input } from "../primitives/input";
import type { Block, Task } from "../../types";
import { Add, Cancel, Check, Delete, Edit } from "../primitives/icons";

interface BlockFormProps {
  mode?: "create" | "edit";
  closeForm: () => void;
  initialBlock?: Block | null;
  addBlock: (newBlock: Block) => void;
  updateBlock?: (payload: { id: string } & Partial<Block>) => void;
}

export const BlockForm: React.FC<BlockFormProps> = ({
  mode = "create",
  initialBlock = null,
  updateBlock,
  addBlock,
  closeForm,
}: BlockFormProps) => {
  const [tasks, setTasks] = useState<Task[]>(initialBlock?.tasks ?? []);
  const [showTask, setShowTask] = useState<boolean>(true);
  const [sessionName, setSessionName] = useState<string>(
    initialBlock?.name ?? "",
  );

  const initialPlanned = initialBlock?.plannedDuration ?? 0;
  const [sessionHours, setSessionHours] = useState<string>(
    mode === "edit" ? String(Math.floor(initialPlanned / 60)) : "",
  );
  const [sessionMinutes, setSessionMinutes] = useState<string>(
    mode === "edit" ? String(initialPlanned % 60) : "",
  );
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const hours = parseInt(sessionHours || "0", 10);
  const minutes = parseInt(sessionMinutes || "0", 10);

  const totalDuration = hours * 60 + minutes;
  const totalTaskDuration = tasks.reduce(
    (acc, task) => acc + Number(task.duration),
    0,
  );
  const remainingTime = totalDuration - totalTaskDuration;

  useEffect(() => {
    if (mode !== "edit") return;

    setTasks(initialBlock?.tasks ?? []);
    setSessionName(initialBlock?.name ?? "");

    const initialPlanned = initialBlock?.plannedDuration ?? 0;
    setSessionHours(String(Math.floor(initialPlanned / 60)));
    setSessionMinutes(String(initialPlanned % 60));
  }, [mode, initialBlock?.id]);

  const handleEditChange = (
    id: string,
    field: keyof Task,
    value: string | number,
  ) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === id ? { ...task, [field]: value } : task,
      ),
    );
  };

  const handleSaveEdit = () => {
    setEditingTaskId(null);
  };

  const removeTasks = (id: string) => {
    if (!setTasks) return;
    setTasks((prevTasks) => prevTasks.filter((taks) => taks.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // edit mode
    if (mode === "edit" && initialBlock && updateBlock) {
      const normalizedTasks = tasks.map((task) => ({
        ...task,
        blockId: initialBlock.id,
        duration: Number(task.duration),
        remaining: task.remaining ?? Number(task.duration) * 60,
      }));

      updateBlock({
        id: initialBlock.id,
        name: sessionName || "Untitled Block",
        plannedDuration: totalDuration,
        tasks: normalizedTasks,
      });

      closeForm();
      return;
    }

    // create mode
    const blockId = crypto.randomUUID();

    const tasksWithBlockId = tasks.map((task) => ({
      ...task,
      blockId,
      duration: Number(task.duration),
      elapsed: 0,
      remaining: Number(task.duration) * 60,
      progress: 0,
      completed: false,
    }));

    const newBlock: Block = {
      id: blockId,
      name: sessionName || "Untitled Block",
      plannedDuration: totalDuration,
      tasks: tasksWithBlockId,
      actualDuration: 0,
      status: "idle",
      createdAt: new Date().toISOString(),
      pauses: [],
      activeTaskId: tasksWithBlockId[0]?.id ?? null,
    };

    addBlock(newBlock);
    // reset form fields
    setSessionName("");
    setSessionHours("");
    setSessionMinutes("");
    setTasks([]);
    setShowTask(false);
    closeForm();
  };

  return (
    <>
      <div className="block-form-wrapper flex justify-center items-center fixed inset-0 bg-black/60 z-50">
        <div
          className="overflow-y-scroll block-form-card bg-white text-gray-900 border-2 border-gray-200 rounded-lg p-6 
                  w-full sm:w-3/4 md:w-1/2 lg:w-[50%] shadow-lg mx-auto"
        >
          <div className="form-header my-4">
            <div className="flex rounded-lg items-center" onClick={() => {}}>
              <Add size="1.4em" color={"black"} classNames={["mr-4"]} />
              <p className="text-xl">
                {mode === "edit"
                  ? "Edit Time Block"
                  : "Create Your First Time Block"}
              </p>
            </div>
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
                  placeholder="e.g., Morning Study Block, Evening Rroutine"
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
                {showTask && <TaskForm setTasks={setTasks} />}
              </div>

              <div className="tasklist-wrapper my-6">
                {tasks.length > 0 && (
                  <>
                    <ul className="tasklist grid gap-4">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center p-3 bg-gray-100 rounded-lg"
                        >
                          {editingTaskId === task.id ? (
                            <>
                              <div className="flex justify-between w-full gap-4">
                                <Input
                                  type="text"
                                  id="task"
                                  inputValue={task.name}
                                  setValue={(newValue) => {
                                    handleEditChange(task.id, "name", newValue);
                                  }}
                                  className={`basis-[65%] mt-0 bg-white border py-1`}
                                />
                                <Input
                                  type="number"
                                  id="task-in-minutes"
                                  inputValue={task.duration.toString()}
                                  setValue={(newValue) => {
                                    handleEditChange(
                                      task.id,
                                      "duration",
                                      newValue,
                                    );
                                  }}
                                  className={`basis-[15%] mt-0 bg-white border py-1`}
                                />
                                <div className="edit-icons basis-[14%] flex justify-between items-center">
                                  <Check
                                    size="1.4em"
                                    classNames={[
                                      "inline-block mx-2 hover:text-green-600 cursor-pointer",
                                    ]}
                                    onClick={() => handleSaveEdit()}
                                  />
                                  <Cancel
                                    size="1.8em"
                                    classNames={[
                                      "inline-block mx-2 hover:text-red-600 cursor-pointer",
                                    ]}
                                    onClick={() => setEditingTaskId(null)}
                                  />
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <li className="" key={task.id}>
                                {task.name}{" "}
                                <span className="text-sm text-gray-500">
                                  ({task.duration}{" "}
                                  {task.duration <= 1 ? "min" : "mins"})
                                </span>
                              </li>
                              <div className="task-icons ml-auto">
                                <Edit
                                  classNames={[
                                    "inline-block mx-2 hover:text-blue-600",
                                  ]}
                                  onClick={() => setEditingTaskId(task.id)}
                                />
                                <Delete
                                  label="delete task"
                                  classNames={[
                                    "inline-block mx-2  hover:text-red-600",
                                  ]}
                                  onClick={() => removeTasks(task.id)}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            {tasks.length > 0 && (
              <div className="tasks-summary bg-gray-100 p-4 rounded-lg tracking-wide">
                <>
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
                            : `${remainingTime}m remaining`}
                        </p>
                      )}
                    </div>
                    <p className="font-medium">
                      Session Total:{" "}
                      {sessionHours || sessionMinutes ? (
                        <span className="text-gray-500">{totalDuration}m</span>
                      ) : (
                        <span className="text-gray-500">0m</span>
                      )}
                    </p>
                  </div>
                </>
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
