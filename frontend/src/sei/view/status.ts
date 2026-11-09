import type { BlockExecutionProjection } from "../domain/projection";

export type ChipKind = "planned" | "running" | "paused" | "break" | "completed" | "stopped" | "agent";

// how a block's state is named on screen
export const chipKind = (projection: BlockExecutionProjection): ChipKind => {
  switch (projection.status) {
    case "idle":
      return "planned";
    case "running":
      return "running";
    case "paused":
      return projection.pauseKind === "block" ? "break" : "paused";
    case "completed":
      return "completed";
    case "terminated":
      return "stopped";
  }
};
