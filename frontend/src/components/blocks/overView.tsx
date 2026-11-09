import { type ReactNode } from "react";
import { Card } from "../primitives/card";
import { TimeProgress } from "./timeProgress";
import { CheckCircle, Clock, Pause, Play, Task } from "../primitives/icons";
import { useSeiSession } from "../../sei/session/seiSessionContext";
import { portfolioMetrics } from "../../sei/domain/metrics";
import { formatDuration, formatPercent, formatSignedDuration } from "../../utils";

export const Overview = () => {
  const { blocks } = useSeiSession();
  // timer blocks and agent-captured blocks measure different things
  // (agent plans are inferred, with no estimates), so they are never averaged together
  const timed = blocks.filter((b) => !b.capturedByAgent);
  const agent = blocks.filter((b) => b.capturedByAgent);
  const portfolio = portfolioMetrics(timed.map((b) => b.metrics));
  const agentPortfolio = portfolioMetrics(agent.map((b) => b.metrics));

  const count = (status: string) =>
    blocks.filter((b) => b.projection.status === status).length;

  const progress =
    portfolio.plannedFocusSec > 0
      ? (portfolio.focusSec / portfolio.plannedFocusSec) * 100
      : 0;

  return (
    <Card
      className="bg-transparent mb-8 px-6 py-8 border border-gray-200 shadow-none "
      title="Sessions Overview"
      icon={<Clock color="black" classNames={["mr-2"]} />}
    >
      <div className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox
            label="Completed"
            value={count("completed")}
            icon={<CheckCircle color="green" />}
          />
          <StatBox label="Running" value={count("running")} icon={<Play color="blue" />} />
          <StatBox label="Paused" value={count("paused")} icon={<Pause color="orange" />} />
          <StatBox
            label="Tasks Done"
            icon={<Task color="purple" />}
            value={`${portfolio.completedTasks} / ${portfolio.totalTasks}`}
          />
        </div>
        <div
          className={`grid grid-cols-1 gap-4 ${agent.length ? "md:grid-cols-4" : "md:grid-cols-3"}`}
        >
          <StatBox label="Focus Time" value={formatDuration(portfolio.focusSec)} />
          <StatBox
            label="Avg Fidelity"
            value={
              portfolio.averageFidelity === null
                ? "—"
                : formatPercent(portfolio.averageFidelity)
            }
            hint={`over ${portfolio.finishedBlocks} finished block${portfolio.finishedBlocks === 1 ? "" : "s"}`}
          />
          <StatBox
            label="Total Drift"
            value={
              portfolio.finishedBlocks === 0
                ? "—"
                : formatSignedDuration(portfolio.executionDriftSec)
            }
            hint="wall clock vs budget, finished blocks"
          />
          {agent.length > 0 && (
            <StatBox
              label="Agent Time"
              value={formatDuration(agentPortfolio.focusSec)}
              hint={`${agent.length} agent session${agent.length === 1 ? "" : "s"}, not in fidelity`}
            />
          )}
        </div>
      </div>

      <TimeProgress
        label="Focus vs Plan"
        elapsed={portfolio.focusSec}
        planned={portfolio.plannedFocusSec}
        progress={progress}
        variant="total"
      />
    </Card>
  );
};

const StatBox = ({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  hint?: string;
}) => {
  return (
    <div
      aria-label={label}
      className="bg-gray-100 p-4 rounded-lg flex flex-col items-center justify-center space-y-1"
    >
      {icon && <span className="text-2xl">{icon}</span>}
      <span className="text-xl font-bold text-gray-900 py-2">{value}</span>
      <span className="text-md text-gray-600">{label}</span>
      {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
    </div>
  );
};
