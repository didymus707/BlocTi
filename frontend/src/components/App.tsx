import { useEffect } from "react";
import { Link, Outlet } from "react-router";
import { ToastContainer, toast } from "react-toastify";
import { Add } from "./primitives/icons";
import { BlockForm } from "./blocks/Form";
import { SyncStatus } from "./blocks/syncStatus";
import { useBlockUI } from "../context/blockUIContext";
import { useSeiStore } from "../sei/store/seiStoreContext";
import { useSeiSession } from "../sei/session/seiSessionContext";
import { planFromDraft, type PlanDraft } from "../sei/store/planDraft";
import type { BlockId } from "../sei/domain/ids";

function App() {
  const { savePlan, generateId, lastError, clearError } = useSeiStore();
  const { getBlock, actionsFor, clock } = useSeiSession();
  const { isModalOpen, mode, editingBlockId, openCreateModal, closeModal } =
    useBlockUI();

  const blockBeingEdited = getBlock(editingBlockId ?? undefined) ?? null;

  useEffect(() => {
    if (!lastError) return;
    toast.error(`Could not save: ${lastError}`);
    clearError();
  }, [lastError, clearError]);

  const handleSubmit = (draft: PlanDraft) => {
    if (mode === "edit" && blockBeingEdited) {
      const { block, tasks } = planFromDraft(draft, blockBeingEdited.block);
      savePlan(block, tasks);
      // a live block takes the new plan as a fresh snapshot; a finished
      // block keeps its recorded history untouched
      const { status } = blockBeingEdited.projection;
      if (status === "running" || status === "paused") {
        actionsFor(block.id as BlockId).replan();
      }
      toast("Block updated!");
    } else {
      const { block, tasks } = planFromDraft(draft, { generateId, now: clock() });
      savePlan(block, tasks);
      toast("Block added!");
    }
    closeModal();
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 text-gray-800">
        <header className="flex justify-between items-center mb-8 p-4 shadow-sm bg-white">
          <h1 className="text-2xl font-bold tracking-tight">
            <Link to="/" className="hover:opacity-80 transition">
              BlocTi
            </Link>
          </h1>
          <div className="flex items-center gap-4">
            <SyncStatus />
            <button
              onClick={openCreateModal}
              className="flex items-center px-4 py-2 bg-black hover:bg-gray-800 rounded-lg text-white font-medium transition"
            >
              <Add size="1.2em" classNames={["mr-4"]} />
              Add Block
            </button>
          </div>
        </header>

        {isModalOpen && (
          <BlockForm
            key={editingBlockId ?? "new"}
            mode={mode}
            closeForm={closeModal}
            onSubmit={handleSubmit}
            initialBlock={blockBeingEdited}
          />
        )}

        {/* 👇 Nested routes render here (Home or CardDetails) */}
        <main className="p-6">
          <Outlet />
        </main>
        <ToastContainer position="top-right" autoClose={3000} />
      </div>
    </>
  );
}

export default App;
