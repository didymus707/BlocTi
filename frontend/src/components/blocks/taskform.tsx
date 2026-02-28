import { useState } from "react";
import type { Task } from "../../types";
import { Input } from "../primitives/input";

interface TaskFormProps {
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}

const TaskForm: React.FC<TaskFormProps> = ({ setTasks }) => {
  const [taskValue, setTaskValue] = useState<string>("");
  const [taskDuration, setTaskDuration] = useState<string | undefined>(
    undefined
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskValue.trim() || !taskDuration || Number(taskDuration) <= 0) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      blockId: "",
      name: taskValue,
      completed: false,
      elapsed: 0,
      progress: 0,
      duration: Number(taskDuration),
      remaining: Number(taskDuration) * 60,
    };
    setTasks((prevTasks) => [...prevTasks, newTask]);
    setTaskValue("");
    setTaskDuration("");
  };

  return (
    <>
      <div className="task-card">
        <div className="task-card-container">
          <div className="task-form">
            <div className="session-tasks-wrapper">
              <p className="session-tasks my-4 text-lg font-medium">
                Add Tasks to your Session
              </p>
              <div className="flex justify-between w-full gap-4">
                <Input
                  type="text"
                  id="task"
                  inputValue={taskValue}
                  setValue={setTaskValue}
                  className={`basis-[65%]`}
                  placeholder="e.g.,Write report"
                />
                <Input
                  min={0}
                  type="number"
                  id="task-in-minutes"
                  placeholder="Minutes"
                  setValue={setTaskDuration}
                  className={`basis-15%`}
                  inputValue={taskDuration ?? ""}
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!taskValue || !taskDuration}
                  className="basis-[15%] border-1 border-gray-200 rounded-lg p-2 mt-2 cursor-pointer disabled:cursor-not-allowed hover:bg-gray-200 hover:text-black hover:font-medium"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TaskForm;
