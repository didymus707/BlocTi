import React from "react";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string; // required for accessibility
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

/**
 * IconButton for icon-only controls. Always require a visible or an aria-label via `label`.
 * It renders a focus-visible ring to improve keyboard navigation.
 */
export const IconButton: React.FC<IconButtonProps> = ({ label, children, size = "md", className = "", ...rest }) => {
  const sizeMap: Record<string, string> = {
    sm: "p-1 text-sm",
    md: "p-2 text-md",
    lg: "p-3 text-lg",
  };

  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={`${sizeMap[size]} inline-flex items-center justify-center rounded-md hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-[var(--blokr-color-focus)] ${className}`}
    >
      {children}
    </button>
  );
};

export default IconButton;