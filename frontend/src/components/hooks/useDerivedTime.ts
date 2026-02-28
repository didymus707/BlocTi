import type { Block, Task } from "../../types";
import { useBlock } from "../../context/blockContext";
import { useSession } from "../../context/sessionContext";

export const useDerivedTime = (targetBlocks: Block | Block[]) => {
  const { blocks } = useBlock();
  const { activeBlockId, activeTaskId, sessionTime } = useSession();

  // normalize inputs making sure they are an array
  const blockArray = Array.isArray(targetBlocks)
    ? targetBlocks
    : [targetBlocks];

  // calculate static Time of elapsed and remaining
  const staticTotalElapsed = blockArray.reduce(
    (acc, block) =>
      acc + block.tasks.reduce((tAcc, task) => tAcc + task.elapsed, 0),
    0,
  );
  const staticTotalRemaining = blockArray.reduce(
    (acc, block) =>
      acc + block.tasks.reduce((tAcc, task) => tAcc + task.remaining, 0),
    0,
  );

  // check if active block and task are in the target blocks
  const isActiveInTarget = blockArray.some(
    (block) =>
      block.id === activeBlockId &&
      block.status !== "completed" &&
      block.tasks.some((task: Task) => task.id === activeTaskId),
  );

  const activeBlock = blocks.find((b) => b.id === activeBlockId);

  if (activeBlock?.status === "completed") {
    return {
      elapsed: staticTotalElapsed,
      remaining: staticTotalRemaining,
    };
  }

  // if block or task is active, find that specific task in the main blocks state, subtract its static time, and add the sessionTime.elapsed pulse.
  if (isActiveInTarget && activeBlockId && activeTaskId) {
    const activeBlock = blocks.find((b) => b.id === activeBlockId);
    const activeTask = activeBlock?.tasks.find((t) => t.id === activeTaskId);

    const savedElapsed = activeTask?.elapsed || 0;
    const savedRemaining = activeTask?.remaining || 0;

    return {
      elapsed: staticTotalElapsed - savedElapsed + sessionTime.elapsed,
      remaining: Math.max(
        0,
        staticTotalRemaining - savedRemaining + sessionTime.remaining,
      ),
    };
  }

  return {
    elapsed: staticTotalElapsed,
    remaining: staticTotalRemaining,
  };
};
