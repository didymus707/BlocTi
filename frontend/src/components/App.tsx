import type { Block } from "../types";
import { Add } from "./primitives/icons";
import { Link, Outlet } from "react-router";
import { BlockForm } from "./blocks/Form";
import { ToastContainer, toast } from "react-toastify";
import { useBlock, useBlockUI } from "../context/blockContext";

function App() {
  const { blocks, dispatch } = useBlock();
  const notify = () => toast("Block added!");
  const { isModalOpen, mode, editingBlockId, openCreateModal, closeModal } =
    useBlockUI();

  const blockBeingEditied = blocks.find((b) => b.id === editingBlockId) ?? null;

  const handleAddingBlock = (newBlock: Block) => {
    dispatch({ type: "ADD_BLOCK", payload: newBlock });
    notify();
    closeModal();
  };

  const handleUpdateBlock = (payload: { id: string } & Partial<Block>) => {
    dispatch({ type: "UPDATE_BLOCK", payload });
    toast("Block Updated!");
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
          <button
            onClick={openCreateModal}
            className="flex items-center px-4 py-2 bg-black hover:bg-gray-800 rounded-lg text-white font-medium transition"
          >
            <Add size="1.2em" classNames={["mr-4"]} />
            Add Block
          </button>
        </header>

        {isModalOpen && (
          <BlockForm
            mode={mode}
            closeForm={closeModal}
            addBlock={handleAddingBlock}
            updateBlock={handleUpdateBlock}
            initialBlock={blockBeingEditied}
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
