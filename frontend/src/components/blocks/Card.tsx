import { Card } from "../primitives/card";
import { useNavigate } from "react-router";
import { Clock, Task } from "../primitives/icons";
import { StatusBadge } from "./statusBadge";
import { orderedTaskStates } from "../../sei/domain/projection";
import type { BlockView } from "../../sei/session/seiSessionContext";
import { formatPercent } from "../../utils";

interface BlockCardProps {
  view: BlockView;
}

export const BlockCard = ({ view }: BlockCardProps) => {
  const navigate = useNavigate();
  const { block, projection, metrics, capturedByAgent } = view;
  const tasks = orderedTaskStates(projection);

  const remainingSec = tasks.reduce((acc, t) => acc + t.remainingSec, 0);
  const progress =
    metrics.plannedFocusSec > 0
      ? (metrics.focusSec / metrics.plannedFocusSec) * 100
      : 0;
  const finalProgress =
    projection.status === "completed" ? 100 : Math.max(0, Math.min(100, progress));

  return (
    <div>
      <Card
        title={block.name}
        headerRight={
          <div className="flex items-center gap-2">
            {capturedByAgent ? (
              <span
                title="Recorded by an agent hook"
                className="text-xs font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-700"
              >
                agent
              </span>
            ) : metrics.isFinal && metrics.fidelity && (
              <span
                title="Execution fidelity"
                className="text-xs font-medium px-2 py-1 rounded-full bg-black text-white"
              >
                {formatPercent(metrics.fidelity.score)} fidelity
              </span>
            )}
            <StatusBadge status={projection.status} />
          </div>
        }
        onClick={() => navigate(`/block/${block.id}`)}
        className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition cursor-pointer"
      >
        <div className="text-sm text-gray-400 flex items-center gap-1">
          <div className="duration flex items-center gap-1">
            <Clock color="red" />
            <span>{Math.ceil(remainingSec / 60)} min left</span>
          </div>
          <div className="tasks flex items-center gap-1 ml-4">
            <Task color="purple" />
            <span>{tasks.length} tasks</span>
          </div>
        </div>
        <div className="mt-3 bg-gray-200 h-2 rounded-full">
          <div
            className="h-2 bg-black rounded-full"
            style={{ width: `${finalProgress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {Math.floor(finalProgress)}% complete
        </p>

        <ul className="text-sm text-gray-400 mt-2">
          {tasks.slice(0, 3).map((t) => (
            <li
              key={t.taskId}
              className={`truncate ${t.status === "completed" ? "line-through" : ""}`}
            >
              • {t.title}
            </li>
          ))}
          {tasks.length <= 3 &&
            Array.from({ length: 4 - tasks.length }).map((_, i) => (
              <li key={`placeholder-${i}`} className="opacity-0">
                •
              </li>
            ))}
          {tasks.length > 3 && <li>+{tasks.length - 3} more</li>}
        </ul>
      </Card>
    </div>
  );
};
