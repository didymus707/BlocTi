import type { ButtonHTMLAttributes, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

type Variant = "primary" | "secondary" | "quiet";
type Size = "md" | "sm";

const variants: Record<Variant, string> = {
  primary:
    "border-ink bg-ink text-white hover:bg-ink-2 disabled:border-line-strong disabled:bg-line-strong disabled:text-white",
  secondary:
    "border-line-strong bg-surface text-ink hover:bg-sunken disabled:text-faint",
  quiet: "border-transparent bg-transparent text-ink-2 hover:bg-sunken hover:text-ink disabled:text-faint",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-[18px] text-sm gap-2",
  sm: "h-9 px-3 text-[13px] gap-1.5",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

// One primary per view. 44px tall by default so every target is touchable.
export const Button = ({
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) => (
  <button
    type={type}
    className={twMerge(
      "inline-flex shrink-0 items-center justify-center rounded-lg border font-semibold transition-colors disabled:cursor-not-allowed",
      sizes[size],
      variants[variant],
      className,
    )}
    {...rest}
  >
    {icon}
    {children}
  </button>
);

interface RoundButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: "light" | "solid" | "night" | "night-solid";
  diameter?: number;
  children: ReactNode;
}

const tones = {
  light: "border border-line-strong bg-surface text-ink hover:bg-sunken",
  solid: "bg-ink text-white hover:bg-ink-2",
  night: "border border-night-line bg-transparent text-night-ink hover:bg-white/5",
  "night-solid": "bg-night-ink text-night hover:bg-white",
};

// icon-only round button; always named for screen readers
export const RoundButton = ({
  label,
  tone = "light",
  diameter = 44,
  className,
  children,
  type = "button",
  style,
  ...rest
}: RoundButtonProps) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={twMerge(
      "inline-flex shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50",
      tones[tone],
      className,
    )}
    style={{ width: diameter, height: diameter, ...style }}
    {...rest}
  >
    {children}
  </button>
);
