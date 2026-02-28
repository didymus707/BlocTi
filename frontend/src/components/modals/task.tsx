import { useEffect, useState } from "react";
import Button from "../primitives/button";
import { Input } from "../primitives/input";
import { useBlock } from "../../context/blockContext";
import { ToastContainer, toast } from "react-toastify";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockId: string | null;
  mode?: "create" | "edit";
  initialTask?: { id: string; name: string; duration: number } | null;
}

export const TaskModal = ({
  blockId,
  isOpen,
  onClose,
  mode = "create",
  initialTask = null,
}: TaskModalProps) => {
  const { dispatch } = useBlock();

  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && initialTask) {
      setName(initialTask.name);
      setDuration(String(initialTask.duration));
    } else {
      setName("");
      setDuration("");
    }
  }, [isOpen, mode, initialTask]);

  if (!isOpen || !blockId) return null;
  const resolvedBlockId = blockId;

  const handleSubmit = () => {
    if (!name.trim() || !duration) return;

    if (mode === 'edit' && initialTask) {
      dispatch({
        type: "UPDATE_TASK",
        payload: {
          blockId: resolvedBlockId,
          taskId: initialTask.id,
          data: {
            name,
            duration: Number(duration),
            remaining: Number(duration) * 60,
          },
        },
      });
      toast("Task updated!");
      onClose();
      return;
    }

    dispatch({
      type: "ADD_TASK_TO_BLOCK",
      payload: {
        blockId,
        task: {
          id: crypto.randomUUID(),
          blockId: resolvedBlockId,
          name,
          elapsed: 0,
          progress: 0,
          completed: false,
          duration: Number(duration),
          remaining: Number(duration) * 60,
        },
      },
    });

    toast("Task added!");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-xl w-full max-w-md shadow-lg">
        <h2 className="text-xl font-semibold mb-4">
          {mode === "edit" ? "Edit Task" : "Add Task"}
        </h2>

        <div className="space-y-4">
          <div className="flex justify-between w-full gap-4">
            <Input
              type="text"
              placeholder="Task name"
              inputValue={name}
              setValue={setName}
              className="grow-3 border border-blue-500"
            />

            <Input
              type="number"
              placeholder="Minutes"
              inputValue={duration}
              setValue={setDuration}
              className="grow border border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button
              className="px-4 text-sm"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="px-4 text-sm"
              variant="primary"
              onClick={handleSubmit}
            >
              {mode === "edit" ? "Save" : "Add Task"}
            </Button>
          </div>
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};
