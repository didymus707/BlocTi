import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { materializeEvents } from "../domain/append";
import type { ExecutionCommand } from "../domain/command/executionCommand";
import { resolveCommand } from "../domain/command/resolver";
import type { BlockId, IdGenerator } from "../domain/ids";
import type { BlockPlan, TaskPlan } from "../domain/plan";
import { LEGACY_BLOCKS_KEY, LEGACY_MIGRATED_KEY, migrateLegacyBlocks } from "./legacy";
import {
  applyOp,
  EMPTY_STATE,
  planFor,
  reconcileEvents,
  rollbackEvents,
  type Op,
  type SeiState,
} from "./ops";
import { PersistenceError, type SeiPersistence } from "./persistence";
import { SeiStoreContext, type StoreStatus } from "./seiStoreContext";

export const OUTBOX_KEY = "blocti:outbox:v1";
export const CACHE_KEY = "blocti:cache:v1";
const MAX_RETRY_DELAY_MS = 30_000;

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const perform = async (persistence: SeiPersistence, op: Op) => {
  switch (op.kind) {
    case "savePlan":
      await persistence.savePlan(op.block, op.tasks);
      return null;
    case "deleteBlock":
      await persistence.deleteBlock(op.blockId);
      return null;
    case "appendEvents":
      return persistence.appendEvents({
        idempotencyKey: op.id,
        blockId: op.blockId,
        events: op.events,
      });
  }
};

interface SeiProviderProps {
  persistence: SeiPersistence;
  children: ReactNode;
  generateId?: IdGenerator;
}

export const SeiProvider = ({
  persistence,
  children,
  generateId = () => crypto.randomUUID(),
}: SeiProviderProps) => {
  const [state, setState] = useState<SeiState>(EMPTY_STATE);
  const [status, setStatus] = useState<StoreStatus>("loading");
  const [pendingOps, setPendingOps] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  // refs hold the latest truth so back-to-back commands resolve in order
  const stateRef = useRef<SeiState>(EMPTY_STATE);
  const outboxRef = useRef<Op[]>(readJson<Op[]>(OUTBOX_KEY, []));
  const flushingRef = useRef(false);
  const retryDelayRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  const update = useCallback((fn: (s: SeiState) => SeiState) => {
    stateRef.current = fn(stateRef.current);
    setState(stateRef.current);
  }, []);

  const saveOutbox = useCallback(() => {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outboxRef.current));
    setPendingOps(outboxRef.current.length);
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current || !loadedRef.current) return;
    flushingRef.current = true;
    try {
      while (outboxRef.current.length > 0) {
        const op = outboxRef.current[0];
        try {
          const canonical = await perform(persistence, op);
          outboxRef.current = outboxRef.current.slice(1);
          saveOutbox();
          if (canonical) update((s) => reconcileEvents(s, canonical));
          retryDelayRef.current = 0;
          setStatus("ready");
        } catch (error) {
          const retryable = error instanceof PersistenceError && error.retryable;
          if (retryable) {
            // keep the op; the retry reuses its id as the idempotency key
            setStatus("offline");
            retryDelayRef.current = Math.min(
              MAX_RETRY_DELAY_MS,
              Math.max(1000, retryDelayRef.current * 2),
            );
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            retryTimerRef.current = setTimeout(() => void flush(), retryDelayRef.current);
            break;
          }
          outboxRef.current = outboxRef.current.slice(1);
          saveOutbox();
          update((s) => rollbackEvents(s, op));
          setLastError(error instanceof Error ? error.message : String(error));
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, [persistence, saveOutbox, update]);

  const commit = useCallback(
    (op: Op) => {
      update((s) => applyOp(s, op));
      outboxRef.current = [...outboxRef.current, op];
      saveOutbox();
      void flush();
    },
    [flush, saveOutbox, update],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let base: SeiState;
      let nextStatus: StoreStatus = "ready";
      try {
        base = await persistence.load();
      } catch {
        base = readJson<SeiState>(CACHE_KEY, EMPTY_STATE);
        nextStatus = "offline";
      }
      if (cancelled) return;
      // ops not yet acknowledged by the server go back on top
      stateRef.current = outboxRef.current.reduce(applyOp, base);
      setState(stateRef.current);
      setStatus(nextStatus);
      setPendingOps(outboxRef.current.length);
      loadedRef.current = true;

      if (!localStorage.getItem(LEGACY_MIGRATED_KEY)) {
        const legacy = migrateLegacyBlocks(localStorage.getItem(LEGACY_BLOCKS_KEY));
        for (const block of legacy.blocks) {
          if (stateRef.current.blockPlans.some((b) => b.id === block.id)) continue;
          const tasks = legacy.tasks.filter((t) => t.blockId === block.id);
          commit({ kind: "savePlan", id: generateId(), block, tasks });
        }
        localStorage.setItem(LEGACY_MIGRATED_KEY, new Date().toISOString());
      }
      void flush();
    })();
    return () => {
      cancelled = true;
    };
    // load once per persistence instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistence]);

  useEffect(() => {
    if (status === "loading") return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  }, [state, status]);

  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [flush]);

  const savePlan = useCallback(
    (block: BlockPlan, tasks: TaskPlan[]) =>
      commit({ kind: "savePlan", id: generateId(), block, tasks }),
    [commit, generateId],
  );

  const deleteBlock = useCallback(
    (blockId: BlockId) => commit({ kind: "deleteBlock", id: generateId(), blockId }),
    [commit, generateId],
  );

  const execute = useCallback(
    (command: ExecutionCommand) => {
      const current = stateRef.current;
      const plan = planFor(current, command.blockId);
      if (!plan) return [];
      const results = resolveCommand(plan.block, plan.tasks, current.events, command);
      if (results.length === 0) return [];
      const events = materializeEvents(current.events, results, generateId);
      commit({ kind: "appendEvents", id: generateId(), blockId: command.blockId, events });
      return events;
    },
    [commit, generateId],
  );

  const value = useMemo(
    () => ({
      state,
      status,
      pendingOps,
      lastError,
      clearError: () => setLastError(null),
      savePlan,
      deleteBlock,
      execute,
      generateId,
    }),
    [state, status, pendingOps, lastError, savePlan, deleteBlock, execute, generateId],
  );

  return <SeiStoreContext.Provider value={value}>{children}</SeiStoreContext.Provider>;
};
