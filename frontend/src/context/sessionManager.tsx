import { useEffect, useRef, useState } from "react";
import type { Block, Task } from "../types";
import { useBlock } from "./blockContext";
import { SessionContext } from "./sessionContext";

export const SessionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { dispatch, blocks } = useBlock();

  const SESSION_KEY = "active-session";

  // GLOBAL STATE
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [remaining, setRemaining] = useState<number>(0);
  const blocksRef = useRef<Block[]>(blocks);

  const activeBlock = blocks.find((b) => b.id === activeBlockId) || null;

  const hasRestoredRef = useRef(false);

  // GLOBAL REFS
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<number>(0);
  const remainingRef = useRef<number>(0);
  const activeTaskIdRef = useRef<string | null>(null);
  const virtualTimerRef = useRef<number | null>(null);

  const terminateSession = (opts?: { resetBlockStatus?: boolean }) => {
    const resetBlockStatus = opts?.resetBlockStatus ?? true;

    // stop the interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // reset refs
    elapsedRef.current = 0;
    remainingRef.current = 0;

    // reset block status if it exists
    if (activeBlockId && resetBlockStatus) {
      dispatch({
        type: "UPDATE_BLOCK",
        payload: { id: activeBlockId, status: "idle" },
      });
    }

    // clear session state
    setActiveBlockId(null);
    setActiveTaskId(null);
    activeTaskIdRef.current = null;

    // Clear persisted session
    localStorage.removeItem(SESSION_KEY);
  };

  const completeBlockAndEndSession = (blockId: string) => {
    // complete Block
    dispatch({
      type: "UPDATE_BLOCK",
      payload: { id: blockId, status: "completed" },
    });

    // terminate session
    terminateSession({ resetBlockStatus: false });
  };

  const resolveNextTask = (
    block: Block,
    currentTaskId: string,
  ): Task | null => {
    const currentTask = block.tasks.find((t) => t.id === currentTaskId);
    if (!currentTask) return block.tasks.find((t) => !t.completed) || null;

    const currentIndex = block.tasks.indexOf(currentTask);
    if (currentIndex === -1 || currentIndex === block.tasks.length - 1)
      return null;
    const nextTaskArray = block.tasks.slice(currentIndex + 1);
    const nextTask = nextTaskArray.find((t) => !t.completed);
    return nextTask || null;
  };

  const start = (block: Block) => {
    const currentBlock =
      blocksRef.current.find((b) => b.id === block.id) || block;
    // 1. Register active session
    setActiveBlockId(currentBlock.id);

    const firstTask = currentBlock.tasks.find((t) => !t.completed);
    if (!firstTask) return;

    setActiveTaskId(firstTask.id);
    activeTaskIdRef.current = firstTask.id;

    elapsedRef.current = firstTask.elapsed || 0;

    // 2. Persist session
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        blockId: currentBlock.id,
        taskId: firstTask.id,
        isPaused: false,
        lastStartedAt: Date.now(),
      }),
    );

    // 3. Update block status
    dispatch({
      type: "UPDATE_BLOCK",
      payload: { ...currentBlock, status: "running" },
    });

    // 4. Start interval
    startInterval(currentBlock, firstTask.id);
  };

  const startInterval = (block: Block, taskId: string) => {
    // clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    activeTaskIdRef.current = taskId;
    const activeBlock = blocksRef.current.find((b) => b.id === block.id);
    if (!activeBlock) return;
    const task = activeBlock.tasks.find((t) => t.id === taskId);
    if (!task) return;
    console.log("current Task", task);

    // initialize refs
    // mental note:
    // actualTime is Date.now()
    // timeAlreadySpent is elapsedRef.current or task.elapsed as at when starting/resuming
    // virtualTimerRef which is the onTickTime or elapsed.current is the actualTime - timeAlreadySpent
    virtualTimerRef.current = Date.now() - elapsedRef.current * 1000;
    const total = task.duration * 60;

    // start new interval
    intervalRef.current = setInterval(() => {
      // calculate elapsed time
      elapsedRef.current =
        (Date.now() - (virtualTimerRef.current ?? Date.now())) / 1000;
      setElapsed(Math.floor(elapsedRef.current));

      // calculate remaining time
      remainingRef.current = Math.max(total - elapsedRef.current, 0);
      setRemaining(Math.floor(remainingRef.current));

      // calculate progress
      const progress = total === 0 ? 0 : (elapsedRef.current / total) * 100;
      setProgress(progress);

      if (elapsedRef.current >= total) {
        // complete task
        dispatch({
          type: "UPDATE_TASK",
          payload: {
            blockId: block.id,
            taskId: task.id,
            data: {
              completed: true,
              elapsed: total,
              remaining: 0,
              progress: 100,
            },
          },
        });

        clearInterval(intervalRef.current!);
        intervalRef.current = null;

        const freshBlock = blocksRef.current.find((b) => b.id === block.id);
        if (!freshBlock) return;

        const nextTask = resolveNextTask(freshBlock, task.id);

        if (nextTask) {
          setActiveTaskId(nextTask.id);
          activeTaskIdRef.current = nextTask.id;
          elapsedRef.current = nextTask.elapsed ?? 0;
          remainingRef.current = nextTask.remaining ?? nextTask.duration * 60;
          // start next task
          startInterval(freshBlock, nextTask.id);

          // persist session
          localStorage.setItem(
            SESSION_KEY,
            JSON.stringify({
              blockId: freshBlock.id,
              taskId: nextTask.id,
              isPaused: false,
              lastStartedAt: Date.now(),
            }),
          );
        } else {
          completeBlockAndEndSession(freshBlock.id);
          return;
        }
      }
    }, 1000);
  };

  const resume = (block: Block, taskId: string) => {
    // get from local storage
    const stored = localStorage.getItem(SESSION_KEY);
    let savedElapsed = 0;

    if (stored) {
      const data = JSON.parse(stored);
      if (data.taskId === taskId) {
        savedElapsed = data.lastElapsed || 0;
      }
    }

    const currentBlock =
      blocksRef.current.find((b) => b.id === block.id) || block;
    const taskToResume = currentBlock.tasks.find((t) => t.id === taskId);
    if (!taskToResume) return;

    const finalElapsed = savedElapsed || taskToResume.elapsed || 0;

    setActiveBlockId(currentBlock.id);
    setActiveTaskId(taskToResume.id);

    activeTaskIdRef.current = taskToResume.id;
    elapsedRef.current = finalElapsed;

    dispatch({
      type: "UPDATE_BLOCK",
      payload: { ...currentBlock, status: "running" },
    });

    startInterval(currentBlock, taskId);
  };

  const pause = () => {
    const currentBlock = blocks.find((b) => b.id === activeBlockId);
    if (!intervalRef.current || !activeTaskId || !currentBlock) return;
    const activeTask = currentBlock.tasks.find((t) => t.id === activeTaskId);
    if (!activeTask) return;

    // 1. Stop the global interval
    clearInterval(intervalRef.current);
    intervalRef.current = null;

    const total = activeTask.duration * 60;
    const progress = total === 0 ? 0 : (elapsedRef.current / total) * 100;

    // 2. Persist task state
    dispatch({
      type: "UPDATE_TASK",
      payload: {
        blockId: currentBlock.id,
        taskId: activeTask.id,
        data: {
          elapsed: elapsedRef.current,
          remaining: remainingRef.current,
          progress,
        },
      },
    });

    // 3. Update block status
    dispatch({
      type: "UPDATE_BLOCK",
      payload: { ...currentBlock, status: "paused" },
    });

    // 4. Persist session state
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...data,
          isPaused: true,
          lastElapsed: elapsedRef.current,
        }),
      );
    }
  };

  const reset = () => {
    const currentBlock = blocks.find((b) => b.id === activeBlockId);
    const currentTask = currentBlock?.tasks.find((t) => t.id === activeTaskId);
    if (!currentTask || !currentBlock) return;

    // 1. Stop interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const total = currentTask.duration * 60;

    // 2. Reset refs
    elapsedRef.current = 0;
    remainingRef.current = total;
    virtualTimerRef.current = Date.now();

    setElapsed(0);
    setProgress(0);
    setRemaining(total);

    // 3. Reset task in reducer
    dispatch({
      type: "UPDATE_TASK",
      payload: {
        blockId: currentBlock.id,
        taskId: currentTask.id ?? "",
        data: {
          completed: false,
          elapsed: 0,
          remaining: total,
          progress: 0,
        },
      },
    });

    // 4. Reset block status
    dispatch({
      type: "UPDATE_BLOCK",
      payload: { id: currentBlock.id, status: "idle" },
    });

    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...data,
          isPaused: true,
          lastElapsed: 0,
          lastStartedAt: Date.now(),
        }),
      );
    }
  };

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // restoring from local storage on mount
  useEffect(() => {
    if (hasRestoredRef.current || blocks.length === 0) return;
    hasRestoredRef.current = true;

    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return;

    try {
      const { blockId, taskId, lastStartedAt, isPaused, lastElapsed } =
        JSON.parse(stored);
      const block = blocks.find((b) => b.id === blockId);
      const task = block?.tasks.find((b) => b.id === taskId);

      if (block && task && !task.completed && block.tasks.length > 0) {
        setActiveBlockId(block.id);
        setActiveTaskId(taskId);

        const now = Date.now();
        const timeSpentSinceLastStartInSecs = (now - lastStartedAt) / 1000;
        // 1. If it was paused when they closed it, use the saved elapsed time
        // 2. If it was running, calculate the gap
        const updatedElapsed = isPaused
          ? lastElapsed
          : (task.elapsed ?? 0) + timeSpentSinceLastStartInSecs;
        elapsedRef.current = updatedElapsed;
        remainingRef.current = task.remaining ?? task.duration * 60;
        virtualTimerRef.current = now - updatedElapsed * 1000;

        setElapsed(Math.floor(elapsedRef.current));
        setRemaining(Math.floor(remainingRef.current));

        const total = task.duration * 60;
        const progress = total === 0 ? 0 : (elapsedRef.current / total) * 100;
        setProgress(progress);

        if (!isPaused) {
          // start interval if it was not paused
          startInterval(block, taskId);
        }

        dispatch({
          type: "UPDATE_BLOCK",
          payload: { ...block, status: isPaused ? "paused" : "running" },
        });
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  // terminate session if block or task no longer exist
  useEffect(() => {
    if (!activeBlock || !activeTaskId) return;

    const block = blocks.find((b) => b.id === activeBlock.id);
    if (!block) {
      terminateSession();
      return;
    }

    const taskStillExists = block?.tasks.some((t) => t.id === activeTaskId);

    if (!taskStillExists) {
      terminateSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  return (
    <SessionContext.Provider
      value={{
        activeBlock,
        activeBlockId,
        activeTaskId,
        start,
        pause,
        reset,
        resume,
        sessionTime: { elapsed, remaining, progress },
        terminateSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};
