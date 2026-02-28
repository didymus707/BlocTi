import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  className?: string;
}

/**
 * Accessible Input primitive.
 * - If `label` is provided a visually-associated <label> is rendered.
 * - Error text is rendered below the input and the input receives aria-invalid.
 */
export const Input: React.FC<InputProps> = ({ label, id, error, className = "", ...rest }) => {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <div className={`blokr-input-wrapper ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium mb-2">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...rest}
        aria-invalid={!!error}
        className="w-full rounded-md border border-neutral-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--blokr-color-focus)]"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--blokr-color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;