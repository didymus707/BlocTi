import { useSeiStore } from "../../sei/store/seiStoreContext";

export const SyncStatus = () => {
  const { status, pendingOps } = useSeiStore();

  const label =
    status === "loading"
      ? "Loading…"
      : status === "offline"
        ? `Offline · ${pendingOps} unsynced`
        : pendingOps > 0
          ? "Saving…"
          : "Saved";

  const dot =
    status === "offline"
      ? "bg-yellow-500"
      : status === "loading" || pendingOps > 0
        ? "bg-gray-400 animate-pulse"
        : "bg-green-500";

  return (
    <span
      role="status"
      aria-label="sync status"
      className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
};
