import { useSeiStore } from "../../sei/store/seiStoreContext";

export const SyncStatus = ({ compact = false }: { compact?: boolean }) => {
  const { status, pendingOps } = useSeiStore();

  const label =
    status === "loading"
      ? "Loading…"
      : status === "offline"
        ? `Offline · ${pendingOps} unsynced`
        : pendingOps > 0
          ? `Saving · ${pendingOps} pending`
          : "Synced · all events saved";

  const dot =
    status === "offline"
      ? "bg-amber-mid"
      : status === "loading" || pendingOps > 0
        ? "bg-faint animate-pulse"
        : "bg-ink";

  return (
    <span
      role="status"
      aria-label="sync status"
      className={`flex items-center gap-2 text-xs text-ink-2 ${
        compact ? "" : "rounded-lg border border-line px-3 py-2.5"
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
};
