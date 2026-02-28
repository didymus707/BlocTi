import React from "react";

type TooltipProps = {
  description: string;
  children: React.ReactNode;
  position: string;
  positionH?: string;
};

const Tooltip = (props: TooltipProps) => {
  const { description, children, position, positionH } = props;

  return (
    <div className="group relative flex">
      {children}
      <span
        className={`absolute ${position} scale-0 transition-all rounded bg-stone-500 p-2 mt-2 mx-[-20px] text-xs text-white ${positionH} group-hover:scale-100`}
      >
        {description}
      </span>
    </div>
  );
};

export default Tooltip;
