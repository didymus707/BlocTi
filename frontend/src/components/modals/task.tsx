import { useState } from "react";
import { toast } from "react-toastify";
import Button from "../primitives/button";
import { Input } from "../primitives/input";
import type { TaskId } from "../../sei/domain/ids";
import { useSeiStore } from "../../sei/store/seiStoreContext";
import type { BlockView } from "../../sei/session/seiSessionContext";
import { minutesToSeconds } from "../../utils";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  view: BlockView | null;
  // called after the plan is saved, e.g. to re-snapshot a live block
  onPlanChanged?: () => void;
}

export const TaskModal = ({ view, isOpen, onClose, onPlanChanged }: TaskModalProps) => {
  const { savePlan, generateId } = useSeiStore();
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");

  if (!isOpen || !view) return null;

  const close = () => {
    setName("");
    setDuration("");
    onClose();
  };

  const handleSubmit = () => {
    if (!name.trim() || !duration || Number(duration) <= 0) return;
    const { block, tasks } = view;
    const task = {
      id: generateId() as TaskId,
      name: name.trim(),
      blockId: block.id,
      order: tasks.length ? Math.max(...tasks.map((t) => t.order)) + 1 : 0,
      plannedDuration: minutesToSeconds(Number(duration)),
    };
    savePlan({ ...block, taskIds: [...block.taskIds, task.id] }, [...tasks, task]);
    onPlanChanged?.();
    toast("Task added!");
    close();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div
        role="dialog"
        aria-label="Add task"
        className="bg-white p-4 rounded-xl w-full max-w-md shadow-lg"
      >
        <h2 className="text-xl font-semibold mb-4">Add Task</h2>

        <div className="space-y-4">
          <div className="flex justify-between w-full gap-4">
            <Input
              type="text"
              placeholder="Task name"
              aria-label="New task name"
              inputValue={name}
              setValue={setName}
              className="grow-3 border border-blue-500"
            />

            <Input
              type="number"
              placeholder="Minutes"
              aria-label="New task minutes"
              inputValue={duration}
              setValue={setDuration}
              className="grow border border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button className="px-4 text-sm" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button className="px-4 text-sm" variant="primary" onClick={handleSubmit}>
              Add Task
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
