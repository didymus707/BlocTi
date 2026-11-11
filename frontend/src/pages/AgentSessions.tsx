import { AgentSessionTable } from "../components/blocks/AgentSessionTable";
import { EmptyState, Page, PageHeader } from "../components/layout/Page";
import { portfolioMetrics } from "../sei/domain/metrics";
import { useSeiSession } from "../sei/session/seiSessionContext";
import { useSeiStore } from "../sei/store/seiStoreContext";
import { MetricTile } from "../ui/MetricTile";
import { formatDuration, formatPercent, plural } from "../utils";

export const AgentSessions = () => {
  const { blocks, now } = useSeiSession();
  const { status } = useSeiStore();
  const agent = blocks.filter((b) => b.capturedByAgent).reverse();
  const totals = portfolioMetrics(agent.map((b) => b.metrics));
  const inferred = agent.reduce((acc, b) => acc + b.metrics.inferredPauseSec, 0);

  return (
    <Page>
      <PageHeader
        title="Agent sessions"
        meta="Recorded by the Claude Code hook, without a timer. Read-only, and kept out of fidelity averages."
      />
      {status === "loading" ? (
        <p className="text-sm text-muted">Loading sessions…</p>
      ) : agent.length === 0 ? (
        <EmptyState
          title="No agent sessions yet"
          body="Add the BlocTi hook to Claude Code and every session shows up here: each prompt becomes a task. See integrations/claude-code/README.md."
        />
      ) : (
        <>
          <section aria-label="Agent totals" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricTile label="Agent working" value={formatDuration(totals.focusSec)} hint={plural(agent.length, "session")} />
            <MetricTile
              label={
                <>
                  <span className="hatch-inferred h-2.5 w-3.5 rounded-sm" aria-hidden="true" />
                  Waiting on you
                </>
              }
              name="Waiting on you"
              value={formatDuration(inferred)}
              hint="inferred, not observed"
            />
            <MetricTile
              label="Turns completed"
              value={formatPercent(totals.totalTasks ? totals.completedTasks / totals.totalTasks : 0)}
              hint={`${totals.completedTasks} of ${totals.totalTasks} turns`}
            />
          </section>
          <AgentSessionTable views={agent} now={now} />
        </>
      )}
    </Page>
  );
};
