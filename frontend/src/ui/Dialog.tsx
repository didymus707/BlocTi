import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

interface DialogProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

// Modal sheet: the only surface in the system with a shadow.
export const Dialog = ({ title, description, onClose, children, width = 640 }: DialogProps) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // callers pass onClose inline; a ref keeps focus from jumping on re-render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("input, button:not([data-close]), textarea, select")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 px-4 py-10 sm:py-16"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full flex-col gap-6 rounded-sheet bg-surface p-6 shadow-[0_24px_64px_rgba(17,17,19,0.28)] sm:p-7"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="m-0 text-[22px] font-bold tracking-tight">
              {title}
            </h2>
            {description && <div className="text-[13px] leading-relaxed text-muted">{description}</div>}
          </div>
          <button
            type="button"
            data-close
            aria-label="Close"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-sunken"
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// a label only screen readers hear
export const SrOnly = ({ children }: { children: ReactNode }) => (
  <span className="sr-only">{children}</span>
);
