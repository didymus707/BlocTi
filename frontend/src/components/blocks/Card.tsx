import type { Block } from "../../types";
import { Card } from "../primitives/card";
import { useNavigate } from "react-router";
import { Clock, Task } from "../primitives/icons";
import { useDerivedTime } from "../hooks/useDerivedTime";

interface BlockCardProps {
  block: Block;
}

export const BlockCard = ({ block }: BlockCardProps) => {
  const navigate = useNavigate();
  const { elapsed, remaining } = useDerivedTime(block);
  const handleCardClick = () => {
    navigate(`/block/${block.id}`);
  };

  const plannedCap = (block.plannedDuration ?? 0) * 60;

  const progress = plannedCap > 0 ? (elapsed / plannedCap) * 100 : 0;
  const clamped = Math.max(0, Math.min(100, progress));

  const finalProgress = block.status === "completed" ? 100 : clamped;

  return (
    <div>
      <Card
        title={block.name}
        headerRight={
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                block.status === "running"
                  ? "bg-green-100 text-green-700"
                  : block.status === "paused"
                    ? "bg-yellow-100 text-yellow-700"
                    : block.status === "completed"
                      ? "bg-gray-200 text-gray-700"
                      : "bg-blue-100 text-blue-700"
              }`}
            >
              {block.status}
            </span>
          </div>
        }
        onClick={handleCardClick}
        className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition cursor-pointer"
      >
        <div className="text-sm text-gray-400 flex items-center gap-1">
          <div className="duration flex items-center gap-1">
            <Clock color="red" />
            <span>{Math.floor(remaining / 60)} min</span>
          </div>
          <div className="tasks flex items-center gap-1 ml-4">
            <Task color="purple" />
            <span>{block.tasks.length} tasks</span>
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
          {block.tasks.slice(0, 3).map((t, i) => (
            <li key={t.id || i} className="truncate">
              • {t.name}
            </li>
          ))}
          {block.tasks.length <= 3 &&
            Array.from({ length: 4 - block.tasks.length }).map((_, i) => (
              <li key={`placeholder-${i}`} className="opacity-0">
                •
              </li>
            ))}
          {block.tasks.length > 3 && <li>+{block.tasks.length - 3} more</li>}
        </ul>
      </Card>
    </div>
  );
};
