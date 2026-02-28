import type { Block, Task } from "./types";

export const formatHM = (time: number): string => {
  const hours = Math.floor(time / 60);
  const minutes = time % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
};

export const formatMmSs = (seconds: number): string => {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
};

export const getDefaultTask = (block: Block) =>
    block.tasks.find((task: Task) => !task.completed) ?? null;
