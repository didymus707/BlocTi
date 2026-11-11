import { useState, type ReactNode } from "react";
import { BlockUIContext } from "./blockUIContext";

export const BlockUIProvider = ({ children }: { children: ReactNode }) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const openCreateModal = () => {
    setMode("create");
    setEditingBlockId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (blockId: string) => {
    setMode("edit");
    setEditingBlockId(blockId);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setMode("create");
    setIsModalOpen(false);
    setEditingBlockId(null);
  };

  return (
    <BlockUIContext.Provider
      value={{
        isModalOpen,
        mode,
        editingBlockId,
        openCreateModal,
        openEditModal,
        closeModal,
      }}
    >
      {children}
    </BlockUIContext.Provider>
  );
};
