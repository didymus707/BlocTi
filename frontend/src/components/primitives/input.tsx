import React from "react";
import { twMerge } from "tailwind-merge";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  className?: string;
  inputValue: string;
  setValue: (value: string) => void;
}

/**
 * Blokr Input — design system input that matches your handwritten form style.
 *
 * Features:
 * - label
 * - helper text
 * - error state
 * - merged custom classes via twMerge
 * - consistent visual design across all forms
 */
export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  className = "",
  inputValue,
  setValue,
  ...rest
}) => {
  const base =
    "w-full bg-gray-100 p-2 rounded-lg mt-2 text-gray-900 transition-all";

  const focus = "focus:border-2 focus:border-gray-300 focus:outline-none";

  const errorClasses = error
    ? "border border-red-500 bg-red-50"
    : "border border-transparent";

  // Merge classes
  const merged = twMerge(`${base} ${focus} ${errorClasses} ${className}`);

  return (
    <div className="flex flex-col w-full">
      {label && (
        <label className="text-md font-medium text-gray-800 mb-1">
          {label}
        </label>
      )}

      <input
        value={inputValue}
        onChange={(e) => setValue(e.target.value)}
        className={merged}
        {...rest}
      />

      {/* Helper or Error */}
      {error ? (
        <span className="text-sm text-red-600 mt-1">{error}</span>
      ) : helperText ? (
        <span className="text-sm text-gray-500 mt-1">{helperText}</span>
      ) : null}
    </div>
  );
};
