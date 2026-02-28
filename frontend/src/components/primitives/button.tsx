import React from "react";

type ButtonSize = "sm" | "md" | "lg";
type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}

/**
 * Blokr Button — matches your handwritten style but works as a full design-system primitive.
 *
 * - primary: solid black (your handwritten "Create Session" button)
 * - secondary: white with gray border (your handwritten "Cancel" button)
 * - ghost: transparent (rare use)
 */
export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  children,
  ...rest
}) => {
  // Your handwritten button uses rounded-lg + p-2
  const base =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all";

  // Matches your handwritten padding exactly
  const sizeMap: Record<ButtonSize, string> = {
    sm: "p-2 text-sm",
    md: "p-2 text-md",
    lg: "p-3 text-lg",
  };

  // Matches your Create / Cancel button exactly
  const variantMap: Record<ButtonVariant, string> = {
    primary:
      "bg-black text-white hover:bg-gray-900 disabled:bg-gray-300 disabled:text-white disabled:cursor-not-allowed",

    secondary:
      "border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-60",

    ghost: "bg-transparent text-gray-900 hover:bg-gray-100 disabled:opacity-60",
  };

  const classes = `${base} ${sizeMap[size]} ${variantMap[variant]} ${className}`;

  return (
    <button {...rest} className={classes} disabled={disabled}>
      {children}
    </button>
  );
};

export default Button;
