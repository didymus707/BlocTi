import { useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router";
import { ToastContainer, toast } from "react-toastify";
import { BlockForm } from "./blocks/BlockForm";
import { BottomNav, Sidebar } from "./shell/Navigation";
import { useBlockUI } from "../context/blockUIContext";
import { useSeiStore } from "../sei/store/seiStoreContext";
import { useSeiSession } from "../sei/session/seiSessionContext";
import { planFromDraft, type PlanDraft } from "../sei/store/planDraft";
import { LogoMark } from "../ui/icons";

function App() {
  const navigate = useNavigate();
  const { savePlan, generateId, lastError, clearError, status, pendingOps } = useSeiStore();
  const { getBlock, actionsFor, clock } = useSeiSession();
  const { isModalOpen, mode, editingBlockId, closeModal } = useBlockUI();

  const blockBeingEdited = getBlock(editingBlockId ?? undefined) ?? null;

  useEffect(() => {
    if (!lastError) return;
    toast.error(`Could not save: ${lastError}`);
    clearError();
  }, [lastError, clearError]);

  const handleSubmit = (draft: PlanDraft, { startNow }: { startNow: boolean }) => {
    if (mode === "edit" && blockBeingEdited) {
      const { block, tasks } = planFromDraft(draft, blockBeingEdited.block);
      savePlan(block, tasks);
      // a live block takes the new plan as a fresh snapshot; a finished
      // block keeps its recorded history untouched
      const { status: blockStatus } = blockBeingEdited.projection;
      if (blockStatus === "running" || blockStatus === "paused") {
        actionsFor(block.id).replan();
      }
      toast("Plan saved");
    } else {
      const { block, tasks } = planFromDraft(draft, { generateId, now: clock() });
      savePlan(block, tasks);
      if (startNow && tasks.length > 0) {
        actionsFor(block.id).start();
        navigate(`/block/${block.id}`);
      } else {
        toast("Block created");
      }
    }
    closeModal();
  };

  const syncDot =
    status === "offline" ? "bg-amber-mid" : status === "loading" || pendingOps > 0 ? "bg-faint" : "bg-ink";

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-0">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
          <Link to="/" aria-label="BlocTi home" className="flex items-center gap-2 text-ink no-underline">
            <LogoMark size={26} />
            <span className="text-lg font-extrabold tracking-[-0.02em]">BlocTi</span>
          </Link>
          <span className={`h-2 w-2 rounded-full ${syncDot}`} aria-hidden="true" />
        </header>
        <Outlet />
      </div>
      <BottomNav />

      {isModalOpen && (
        <BlockForm
          key={editingBlockId ?? "new"}
          mode={mode}
          initialBlock={blockBeingEdited}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      )}
      <ToastContainer position="bottom-right" autoClose={3000} hideProgressBar theme="light" />
    </div>
  );
}

export default App;
