import { useState } from "react";
import { Input } from "../primitives/input";
import type { DraftTask } from "../../sei/store/planDraft";

interface TaskFormProps {
  setTasks: React.Dispatch<React.SetStateAction<DraftTask[]>>;
}

const TaskForm: React.FC<TaskFormProps> = ({ setTasks }) => {
  const [taskValue, setTaskValue] = useState<string>("");
  const [taskDuration, setTaskDuration] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskValue.trim() || !taskDuration || Number(taskDuration) <= 0) return;

    const newTask: DraftTask = {
      id: crypto.randomUUID(),
      name: taskValue.trim(),
      minutes: Number(taskDuration),
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
                  aria-label="Task name"
                  inputValue={taskValue}
                  setValue={setTaskValue}
                  className={`basis-[65%]`}
                  placeholder="e.g.,Write report"
                />
                <Input
                  min={0}
                  type="number"
                  id="task-in-minutes"
                  aria-label="Task minutes"
                  placeholder="Minutes"
                  setValue={setTaskDuration}
                  className={`basis-15%`}
                  inputValue={taskDuration}
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
