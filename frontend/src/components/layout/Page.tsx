import type { ReactNode } from "react";
import { Link } from "react-router";
import { BackIcon } from "../../ui/icons";

export const Page = ({ children }: { children: ReactNode }) => (
  <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-7 px-4 py-6 sm:px-8 lg:px-10 lg:py-8">
    {children}
  </main>
);

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  chip?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}

export const PageHeader = ({ eyebrow, title, chip, meta, actions, back }: PageHeaderProps) => (
  <div className="flex flex-col gap-3.5">
    {back && (
      <Link to={back.to} className="inline-flex items-center gap-1.5 self-start text-[13px] text-ink-2 no-underline hover:text-ink">
        <BackIcon size={14} />
        {back.label}
      </Link>
    )}
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <span className="label-caps">{eyebrow}</span>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-[30px]">{title}</h1>
          {chip}
        </div>
        {meta && <span className="text-[13px] text-muted">{meta}</span>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  </div>
);

export const Section = ({
  title,
  aside,
  children,
  className = "",
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section aria-label={title} className={`flex flex-col gap-4 ${className}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="m-0 text-lg font-semibold tracking-[-0.01em]">{title}</h2>
      {aside}
    </div>
    {children}
  </section>
);

export const Panel = ({
  title,
  aside,
  children,
  className = "",
  tone = "default",
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "default" | "live";
}) => (
  <section
    aria-label={title}
    className={`flex flex-col gap-4 rounded-section border bg-surface p-5 sm:p-6 ${
      tone === "live" ? "border-live-line" : "border-line"
    } ${className}`}
  >
    {(title || aside) && (
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        {title && <h2 className="m-0 text-[15px] font-semibold">{title}</h2>}
        {aside}
      </div>
    )}
    {children}
  </section>
);

export const EmptyState = ({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) => (
  <div className="flex flex-col items-center gap-3 rounded-section border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
    <span className="text-base font-semibold">{title}</span>
    {body && <p className="m-0 max-w-md text-sm leading-relaxed text-muted">{body}</p>}
    {action}
  </div>
);
