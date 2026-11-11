import { useState } from "react";
import { BlockGrid } from "../components/blocks/BlockCard";
import { EmptyState, Page, PageHeader } from "../components/layout/Page";
import { useBlockUI } from "../context/blockUIContext";
import { useSeiSession } from "../sei/session/seiSessionContext";
import { useSeiStore } from "../sei/store/seiStoreContext";
import { Button } from "../ui/Button";
import { FilterTabs } from "../ui/FilterTabs";
import { PlusIcon } from "../ui/icons";
import { filterOf, type BlockFilter } from "../sei/view/filters";

export const Blocks = () => {
  const { blocks, now } = useSeiSession();
  const { status } = useSeiStore();
  const { openCreateModal } = useBlockUI();
  const [filter, setFilter] = useState<BlockFilter>("all");

  const timed = blocks.filter((b) => !b.capturedByAgent).reverse();
  const count = (f: BlockFilter) => (f === "all" ? timed.length : timed.filter((b) => filterOf(b) === f).length);
  const shown = filter === "all" ? timed : timed.filter((b) => filterOf(b) === filter);

  return (
    <Page>
      <PageHeader
        title="Blocks"
        meta="Every timed block, newest first."
        actions={
          <Button variant="primary" icon={<PlusIcon size={16} />} onClick={openCreateModal}>
            New block
          </Button>
        }
      />
      <FilterTabs
        label="Filter blocks"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All", count: count("all") },
          { value: "live", label: "Live", count: count("live") },
          { value: "finished", label: "Finished", count: count("finished") },
          { value: "planned", label: "Planned", count: count("planned") },
        ]}
      />
      {status === "loading" ? (
        <p className="text-sm text-muted">Loading blocks…</p>
      ) : timed.length === 0 ? (
        <EmptyState
          title="No blocks yet"
          action={
            <Button variant="primary" onClick={openCreateModal}>
              Create block
            </Button>
          }
        />
      ) : (
        <BlockGrid views={shown} now={now} />
      )}
    </Page>
  );
};
