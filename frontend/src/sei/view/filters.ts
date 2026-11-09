import type { BlockView } from "../session/seiSessionContext";

export type BlockFilter = "all" | "live" | "finished" | "planned";

export const filterOf = (v: BlockView): Exclude<BlockFilter, "all"> => {
  const s = v.projection.status;
  return s === "running" || s === "paused" ? "live" : s === "idle" ? "planned" : "finished";
};
