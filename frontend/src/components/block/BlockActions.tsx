import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import type { BlockView } from "../../sei/session/seiSessionContext";
import { useSeiStore } from "../../sei/store/seiStoreContext";
import { Button } from "../../ui/Button";
import { DownloadIcon, TrashIcon } from "../../ui/icons";

// Deleting removes the trace for good, so it takes two clicks.
export const DeleteBlockButton = ({ view }: { view: BlockView }) => {
  const navigate = useNavigate();
  const { deleteBlock } = useSeiStore();
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button variant="quiet" size="sm" icon={<TrashIcon size={15} />} aria-label="Delete block" onClick={() => setArmed(true)}>
        Delete
      </Button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-over-tint px-1.5">
      <span className="pl-1 text-xs text-over">Deletes its trace too.</span>
      <Button
        size="sm"
        className="border-over bg-over text-white hover:bg-over"
        onClick={() => {
          deleteBlock(view.block.id);
          toast("Block deleted");
          navigate("/blocks");
        }}
      >
        Confirm delete
      </Button>
      <Button size="sm" variant="quiet" onClick={() => setArmed(false)}>
        Keep
      </Button>
    </span>
  );
};

export const ExportTraceButton = ({ view }: { view: BlockView }) => {
  const exportTrace = () => {
    const ordered = [...view.events].sort((a, b) => a.seq - b.seq);
    const blob = new Blob([JSON.stringify({ block: view.block, events: ordered }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${view.block.name.replace(/[^\w-]+/g, "-").toLowerCase() || "block"}-trace.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button icon={<DownloadIcon size={16} />} onClick={exportTrace}>
      Export trace
    </Button>
  );
};
