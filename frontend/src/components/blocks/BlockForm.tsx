import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { BlockView } from "../../sei/session/seiSessionContext";
import { draftFromPlan, type DraftTask, type PlanDraft } from "../../sei/store/planDraft";
import { Button } from "../../ui/Button";
import { Dialog, SrOnly } from "../../ui/Dialog";
import { CheckIcon, CloseIcon } from "../../ui/icons";
import { formatDuration } from "../../utils";

interface BlockFormProps {
  mode: "create" | "edit";
  initialBlock: BlockView | null;
  onSubmit: (draft: PlanDraft, options: { startNow: boolean }) => void;
  onClose: () => void;
}

const PRESETS = [30, 60, 120, 180];
const SHADES = ["bg-ink", "bg-ink-2", "bg-faint"];

const inputBase =
  "h-10 rounded-lg border border-line bg-[#fafaf9] px-3 text-sm font-medium text-ink outline-none focus:border-ink";

export const BlockForm = ({ mode, initialBlock, onSubmit, onClose }: BlockFormProps) => {
  const initial =
    mode === "edit" && initialBlock ? draftFromPlan(initialBlock.block, initialBlock.tasks) : null;

  const [name, setName] = useState(initial?.name ?? "");
  const [hours, setHours] = useState(initial ? String(Math.floor(initial.plannedMinutes / 60)) : "");
  const [minutes, setMinutes] = useState(initial ? String(initial.plannedMinutes % 60) : "");
  const [tasks, setTasks] = useState<DraftTask[]>(initial?.tasks ?? []);
  const [newName, setNewName] = useState("");
  const [newMinutes, setNewMinutes] = useState("");
  const [startNow, setStartNow] = useState(false);

  const status = initialBlock?.projection.status ?? "idle";
  const isFinished = status === "completed" || status === "terminated";
  const isLive = status === "running" || status === "paused";
  // tasks with recorded history keep their plan: an edit cannot rewrite the past
  const hasHistory = (taskId: string) => {
    const state = initialBlock?.projection.taskStates[taskId as never];
    return !!state && (state.startedAt !== null || state.status !== "pending");
  };

  const budget = (parseInt(hours || "0", 10) || 0) * 60 + (parseInt(minutes || "0", 10) || 0);
  const taskTotal = tasks.reduce((acc, t) => acc + (Number(t.minutes) || 0), 0);
  const scale = Math.max(budget, taskTotal, 1);

  const addTask = () => {
    const m = Number(newMinutes);
    if (!newName.trim() || !(m > 0)) return;
    setTasks((prev) => [...prev, { id: crypto.randomUUID(), name: newName.trim(), minutes: m }]);
    setNewName("");
    setNewMinutes("");
  };

  const onAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Enter adds the task instead of submitting the whole form
      e.preventDefault();
      addTask();
    }
  };

  const updateTask = (id: string, patch: Partial<DraftTask>) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const setPreset = (m: number) => {
    setHours(String(Math.floor(m / 60)));
    setMinutes(String(m % 60));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || budget <= 0) return;
    onSubmit({ name, plannedMinutes: budget, tasks }, { startNow });
  };

  const fit =
    taskTotal === budget
      ? { text: "Fits exactly", over: false }
      : taskTotal > budget
        ? { text: `${formatDuration((taskTotal - budget) * 60)} over budget`, over: true }
        : { text: `${formatDuration((budget - taskTotal) * 60)} unplanned`, over: false };

  return (
    <Dialog
      title={mode === "edit" ? "Edit plan" : "New block"}
      onClose={onClose}
      description={
        mode === "create"
          ? "The plan is frozen into the trace when you start. You can still add tasks later."
          : isFinished
            ? "This block has finished. Edits change the plan only; its recorded history stays as it happened."
            : isLive
              ? "This block is running. New tasks join the queue; tasks already started keep their original plan."
              : "Nothing has run yet, so every part of the plan can change."
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="block-name" className="text-[13px] font-semibold">
            Name
          </label>
          <input
            id="block-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sprint 2 · Metrics"
            className="h-11 rounded-lg border border-line-strong px-3.5 text-[15px] font-medium outline-none focus:border-ink"
          />
        </div>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-[13px] font-semibold">Budget</legend>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((m) => {
              const selected = budget === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPreset(m)}
                  className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold ${
                    selected ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-2 hover:bg-sunken"
                  }`}
                >
                  {formatDuration(m * 60)}
                </button>
              );
            })}
            <span className="ml-1 text-[13px] text-muted">or</span>
            <label htmlFor="budget-hours" className="sr-only">
              Hours
            </label>
            <input
              id="budget-hours"
              type="number"
              min={0}
              max={23}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="0"
              className="h-9 w-16 rounded-lg border border-line-strong px-2.5 font-mono text-sm outline-none focus:border-ink"
            />
            <span className="text-[13px] text-ink-2">h</span>
            <label htmlFor="budget-minutes" className="sr-only">
              Minutes
            </label>
            <input
              id="budget-minutes"
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="0"
              className="h-9 w-16 rounded-lg border border-line-strong px-2.5 font-mono text-sm outline-none focus:border-ink"
            />
            <span className="text-[13px] text-ink-2">m</span>
          </div>
        </fieldset>

        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold">Tasks</span>
            <span className="text-xs text-muted">worked in this order</span>
          </div>

          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {tasks.map((task, i) => {
              const locked = hasHistory(task.id);
              return (
                <li key={task.id} className="flex items-center gap-2">
                  <span className="w-5 text-center font-mono text-xs text-faint" aria-hidden="true">
                    {i + 1}
                  </span>
                  <label className="sr-only" htmlFor={`task-${task.id}-name`}>
                    Task {i + 1} name
                  </label>
                  <input
                    id={`task-${task.id}-name`}
                    type="text"
                    value={task.name}
                    onChange={(e) => updateTask(task.id, { name: e.target.value })}
                    className={`${inputBase} min-w-0 flex-1`}
                  />
                  <label className="sr-only" htmlFor={`task-${task.id}-min`}>
                    Task {i + 1} minutes
                  </label>
                  <input
                    id={`task-${task.id}-min`}
                    type="number"
                    min={1}
                    value={task.minutes}
                    disabled={locked}
                    title={locked ? "Started tasks keep their planned time" : undefined}
                    onChange={(e) => updateTask(task.id, { minutes: Number(e.target.value) })}
                    className={`${inputBase} w-16 font-mono disabled:text-faint`}
                  />
                  <span className="text-[13px] text-muted">m</span>
                  {locked ? (
                    <span className="w-9 text-center text-[10px] font-semibold uppercase tracking-wider text-faint" title="Has recorded history">
                      kept
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Remove ${task.name || `task ${i + 1}`}`}
                      onClick={() => setTasks((prev) => prev.filter((t) => t.id !== task.id))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-faint hover:bg-sunken hover:text-ink"
                    >
                      <CloseIcon size={16} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2 pl-7">
            <label htmlFor="new-task-name" className="sr-only">
              Task name
            </label>
            <input
              id="new-task-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={onAddKey}
              placeholder="Add a task, then press Enter"
              className="h-10 min-w-0 flex-1 rounded-lg border border-dashed border-line-strong px-3 text-sm outline-none focus:border-solid focus:border-ink"
            />
            <label htmlFor="new-task-minutes" className="sr-only">
              Task minutes
            </label>
            <input
              id="new-task-minutes"
              type="number"
              min={1}
              value={newMinutes}
              onChange={(e) => setNewMinutes(e.target.value)}
              onKeyDown={onAddKey}
              placeholder="min"
              className="h-10 w-16 rounded-lg border border-dashed border-line-strong px-2.5 font-mono text-sm outline-none focus:border-solid focus:border-ink"
            />
            <Button size="sm" onClick={addTask} disabled={!newName.trim() || !(Number(newMinutes) > 0)}>
              Add
            </Button>
          </div>
        </div>

        {(tasks.length > 0 || budget > 0) && (
          <div className="flex flex-col gap-2.5 rounded-tile bg-paper p-4">
            <div className="flex h-2.5 gap-0.5" aria-hidden="true">
              {tasks.map((t, i) => (
                <div
                  key={t.id}
                  className={`${SHADES[i % 3]} ${i === 0 ? "rounded-l-sm" : ""}`}
                  style={{ flex: `${(Number(t.minutes) || 0) / scale} 1 0` }}
                />
              ))}
              {budget > taskTotal && (
                <div
                  className="rounded-r-sm border border-dashed border-planned"
                  style={{ flex: `${(budget - taskTotal) / scale} 1 0` }}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <span className="font-mono text-ink-2">
                {formatDuration(taskTotal * 60)} of tasks · {formatDuration(budget * 60)} budget
              </span>
              <span className={`inline-flex items-center gap-1.5 font-semibold ${fit.over ? "text-over" : ""}`}>
                {taskTotal === budget && <CheckIcon size={14} strokeWidth={2.6} />}
                {fit.text}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {mode === "create" ? (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={startNow}
                onChange={(e) => setStartNow(e.target.checked)}
                className="h-[18px] w-[18px] accent-ink"
              />
              Start right away
            </label>
          ) : (
            <span />
          )}
          <div className="flex gap-2.5">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!name.trim() || budget <= 0}>
              {mode === "edit" ? "Save changes" : "Create block"}
            </Button>
          </div>
        </div>
        <SrOnly>{tasks.length} tasks planned</SrOnly>
      </form>
    </Dialog>
  );
};
