import { useEffect, useReducer, useState, type ReactNode } from "react";
import { BlockContext, BlockUIContext } from "./blockContext";
import { blockReducer } from "../reducers/reducer";
import type { Block, BlockContextType } from "../types";

const initialState: Block[] = [];

export const BlockProvider = ({ children }: { children: ReactNode }) => {
  const loadStoredData = (): Block[] => {
    const storedBlocks = localStorage.getItem("blocks");
    return storedBlocks ? (JSON.parse(storedBlocks) as Block[]) : [];
  };
  const [blocks, dispatch] = useReducer(
    blockReducer,
    initialState,
    loadStoredData,
  );

  useEffect(() => {
    localStorage.setItem("blocks", JSON.stringify(blocks));
  }, [blocks]);

  return (
    <BlockContext.Provider value={{ blocks, dispatch } as BlockContextType}>
      {children}
    </BlockContext.Provider>
  );
};

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
