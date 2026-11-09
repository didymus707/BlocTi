import { useState } from "react";
import { useNavigate } from "react-router";
import { AgentSessionTable } from "../components/blocks/AgentSessionTable";
import { BlockGrid } from "../components/blocks/BlockCard";
import { LiveStrip } from "../components/blocks/LiveStrip";
import { EmptyState, Page, PageHeader, Section } from "../components/layout/Page";
import { useBlockUI } from "../context/blockUIContext";
import { portfolioMetrics } from "../sei/domain/metrics";
import { useSeiSession, type BlockView } from "../sei/session/seiSessionContext";
import { useSeiStore } from "../sei/store/seiStoreContext";
import { filterOf, type BlockFilter } from "../sei/view/filters";
import { Button } from "../ui/Button";
import { FilterTabs } from "../ui/FilterTabs";
import { ExpandIcon, PlusIcon } from "../ui/icons";
import { MetricTile } from "../ui/MetricTile";
import { formatDuration, formatLongDate, formatPercent, formatSignedDuration, isSameLocalDay, plural } from "../utils";

export const Today = () => {
  const navigate = useNavigate();
  const { blocks, now, clock, activeBlockId, getBlock, actionsFor } = useSeiSession();
  const { status } = useSeiStore();
  const { openCreateModal } = useBlockUI();
  const [filter, setFilter] = useState<BlockFilter>("all");

  const today = clock();
  // today = anything live, planned and not yet run, or started today
  const onToday = (v: BlockView) =>
    filterOf(v) !== "finished" ||
    (v.projection.startedAt !== null && isSameLocalDay(v.projection.startedAt, today));

  const timed = blocks.filter((b) => !b.capturedByAgent && onToday(b));
  const agent = blocks.filter((b) => b.capturedByAgent && onToday(b));
  const portfolio = portfolioMetrics(timed.map((b) => b.metrics));
  const agentPortfolio = portfolioMetrics(agent.map((b) => b.metrics));
  const active = activeBlockId ? getBlock(activeBlockId) : undefined;

  const count = (f: BlockFilter) => (f === "all" ? timed.length : timed.filter((b) => filterOf(b) === f).length);
  const shown = filter === "all" ? timed : timed.filter((b) => filterOf(b) === filter);

  return (
    <Page>
      <PageHeader
        eyebrow={formatLongDate(today)}
        title="Today"
        actions={
          <>
            <Button
              icon={<ExpandIcon size={16} />}
              disabled={!active}
              onClick={() => active && navigate(`/focus/${active.block.id}`)}
            >
              Focus mode
            </Button>
            <Button variant="primary" icon={<PlusIcon size={16} />} onClick={openCreateModal}>
              New block
            </Button>
          </>
        }
      />

      {active && !active.capturedByAgent && <LiveStrip view={active} actions={actionsFor(active.block.id)} />}

      <section aria-label="Today in numbers" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Focus time"
          value={formatDuration(portfolio.focusSec)}
          hint={`of ${formatDuration(portfolio.plannedFocusSec)} planned`}
        />
        <MetricTile
          label="Avg fidelity"
          value={portfolio.averageFidelity === null ? "—" : formatPercent(portfolio.averageFidelity)}
          hint={plural(portfolio.finishedBlocks, "finished block")}
        />
        <MetricTile
          label="Execution drift"
          value={portfolio.finishedBlocks === 0 ? "—" : formatSignedDuration(portfolio.executionDriftSec)}
          tone={portfolio.finishedBlocks > 0 && portfolio.executionDriftSec > 60 ? "over" : "default"}
          hint="wall clock vs budget, finished blocks"
        />
        {agent.length > 0 ? (
          <MetricTile
            label="Agent time"
            value={formatDuration(agentPortfolio.focusSec)}
            hint={`${plural(agent.length, "session")} · kept out of fidelity`}
            dashed
          />
        ) : (
          <MetricTile
            label="Tasks done"
            value={`${portfolio.completedTasks} / ${portfolio.totalTasks}`}
            hint="across today's blocks"
          />
        )}
      </section>

      <Section
        title="Blocks"
        aside={
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
        }
      >
        {status === "loading" ? (
          <p className="text-sm text-muted">Loading blocks…</p>
        ) : timed.length === 0 ? (
          <EmptyState
            title="No blocks yet"
            body="A block is a stretch of time with a plan: for example a 2-hour sprint with four tasks. BlocTi records how it really goes."
            action={
              <Button variant="primary" icon={<PlusIcon size={16} />} onClick={openCreateModal}>
                Create block
              </Button>
            }
          />
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted">Nothing here.</p>
        ) : (
          <BlockGrid views={shown} now={now} />
        )}
      </Section>

      {agent.length > 0 && (
        <Section
          title="Agent sessions"
          aside={<span className="text-xs text-muted">Recorded by the Claude Code hook. Hatched time is inferred, not observed.</span>}
        >
          <AgentSessionTable views={agent} now={now} />
        </Section>
      )}
    </Page>
  );
};
