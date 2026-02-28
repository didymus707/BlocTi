import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  icon?: ReactNode;
  className?: string;
  onClick?: () => void;
  children?: ReactNode;
  headerRight?: ReactNode;
}

export const Card = ({
  title,
  icon,
  children,
  onClick,
  headerRight,
  className = "",
}: CardProps) => {
  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 rounded-xl p-4  ${className}`}
    >
      {/* Header section */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="text-blue-400 text-xl flex items-center justify-center">
              {icon}
            </div>
          )}
          {title && (
            <h2 className="text-lg font-semibold text-black">{title}</h2>
          )}
        </div>
        {headerRight && <div>{headerRight}</div>}
      </div>

      {/* Content */}
      <div className="text-gray-300 text-sm">{children}</div>
    </div>
  );
};
// Example: 4-hour study block with reading (20min), guitar practice (30min), coding challenges (1hr), and project work (90min)
