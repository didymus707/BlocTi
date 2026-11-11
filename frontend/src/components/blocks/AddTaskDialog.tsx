import { useState, type FormEvent } from "react";
import type { TaskId } from "../../sei/domain/ids";
import type { BlockView } from "../../sei/session/seiSessionContext";
import { useSeiStore } from "../../sei/store/seiStoreContext";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { minutesToSeconds } from "../../utils";

interface AddTaskDialogProps {
  view: BlockView;
  onClose: () => void;
  // called after the plan is saved, e.g. to re-snapshot a live block
  onPlanChanged?: () => void;
}

export const AddTaskDialog = ({ view, onClose, onPlanChanged }: AddTaskDialogProps) => {
  const { savePlan, generateId } = useSeiStore();
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("");
  const valid = name.trim().length > 0 && Number(minutes) > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const { block, tasks } = view;
    const task = {
      id: generateId() as TaskId,
      name: name.trim(),
      blockId: block.id,
      order: tasks.length ? Math.max(...tasks.map((t) => t.order)) + 1 : 0,
      plannedDuration: minutesToSeconds(Number(minutes)),
    };
    savePlan({ ...block, taskIds: [...block.taskIds, task.id] }, [...tasks, task]);
    onPlanChanged?.();
    onClose();
  };

  return (
    <Dialog title="Add task" width={480} onClose={onClose} description="It joins the end of the plan.">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <label htmlFor="add-task-name" className="text-[13px] font-semibold">
              Task
            </label>
            <input
              id="add-task-name"
              aria-label="New task name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-lg border border-line-strong px-3 text-sm outline-none focus:border-ink"
            />
          </div>
          <div className="flex w-24 flex-col gap-2">
            <label htmlFor="add-task-minutes" className="text-[13px] font-semibold">
              Minutes
            </label>
            <input
              id="add-task-minutes"
              aria-label="New task minutes"
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="h-11 rounded-lg border border-line-strong px-3 font-mono text-sm outline-none focus:border-ink"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2.5">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!valid}>
            Add task
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
