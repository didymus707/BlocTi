import { type ReactNode } from "react";
import { Card } from "../primitives/card";
import { TimeProgress } from "./timeProgress";
import { useBlock } from "../../context/blockContext";
import { useDerivedTime } from "../hooks/useDerivedTime";
import { CheckCircle, Clock, Pause, Play, Task } from "../primitives/icons";

export const Overview = () => {
  const { blocks } = useBlock();
  const { elapsed: appElapsed } = useDerivedTime(blocks);

  const total = blocks.length;
  const paused = blocks.filter((b) => b.status === "paused").length;
  const running = blocks.filter((b) => b.status === "running").length;
  const completed = blocks.filter((b) => b.status === "completed").length;
  const tasksCompleted = blocks.reduce(
    (acc, block) => acc + block.tasks.filter((t) => t.completed).length,
    0
  );
  const totalTasks = blocks.reduce((acc, block) => acc + block.tasks.length, 0);

  let totalPlanned = 0;
  for (const block of blocks) {
    for (const task of block.tasks) {
      totalPlanned += task.duration;
    }
  }

  const progress = (appElapsed / (totalPlanned * 60)) * 100 || 0;

  return (
    <>
      <Card
        className="bg-transparent mb-8 px-6 py-8 border border-gray-200 shadow-none "
        title="Sessions Overview"
        icon={<Clock color="black" classNames={["mr-2"]} />}
      >
        {/*  TASKS GRID  */}
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatBox
              label="Completed"
              value={completed}
              icon={<CheckCircle color="green" />}
            />
            <StatBox
              label="Running"
              value={running}
              icon={<Play color="blue" />}
            />
            <StatBox
              label="Paused"
              value={paused}
              icon={<Pause color="orange" />}
            />
            <StatBox
              label="Total Sessions"
              value={total}
              icon={<Clock color="gray" />}
            />
            <StatBox
              label="Tasks Done"
              icon={<Task color="purple" />}
              value={tasksCompleted + " / " + totalTasks}
            />
            {/*   */}
          </div>
        </div>

        {/*  PROGRESS BAR  */}
        <TimeProgress
          elapsed={appElapsed}
          planned={totalPlanned * 60}
          progress={progress}
          variant="total"
        />
      </Card>
    </>
  );
};

const StatBox = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
}) => {
  return (
    <div className="bg-gray-100 p-4 rounded-lg flex flex-col items-center justify-center space-y-1">
      <span className="text-2xl">{icon}</span>
      <span className="text-xl font-bold text-gray-900 py-2">{value}</span>
      <span className="text-md text-gray-600">{label}</span>
    </div>
  );
};
