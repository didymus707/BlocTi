export interface BlockUIContextType {
  isModalOpen: boolean;
  mode: "create" | "edit";
  editingBlockId: string | null;
  openCreateModal: () => void;
  openEditModal: (blockId: string) => void;
  closeModal: () => void;
}
