import { Link, NavLink } from "react-router";
import type { ComponentType } from "react";
import { AgentIcon, BlocksIcon, CalendarIcon, LogoMark, ReportsIcon } from "../../ui/icons";
import { SyncStatus } from "./SyncStatus";

const ITEMS: Array<{ to: string; label: string; short: string; Icon: ComponentType<{ size?: number }>; end?: boolean }> = [
  { to: "/", label: "Today", short: "Today", Icon: CalendarIcon, end: true },
  { to: "/blocks", label: "Blocks", short: "Blocks", Icon: BlocksIcon },
  { to: "/agents", label: "Agent sessions", short: "Agent", Icon: AgentIcon },
  { to: "/reports", label: "Reports", short: "Reports", Icon: ReportsIcon },
];

export const Wordmark = () => (
  <Link to="/" aria-label="BlocTi" className="flex items-center gap-2.5 px-2 text-ink no-underline">
    <LogoMark />
    <span className="text-xl font-extrabold tracking-[-0.02em]">BlocTi</span>
  </Link>
);

// desktop: a left rail
export const Sidebar = () => (
  <nav
    aria-label="Main"
    className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col gap-7 border-r border-line bg-surface px-4 py-6 md:flex"
  >
    <Wordmark />
    <div className="flex flex-col gap-0.5">
      {ITEMS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm no-underline ${
              isActive ? "bg-sunken font-semibold text-ink" : "font-medium text-ink-2 hover:bg-paper hover:text-ink"
            }`
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </div>
    <div className="mt-auto">
      <SyncStatus />
    </div>
  </nav>
);

// phone: a bottom tab bar
export const BottomNav = () => (
  <nav
    aria-label="Main"
    className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-surface px-2 pb-5 pt-2 md:hidden"
  >
    {ITEMS.map(({ to, short, Icon, end }) => (
      <NavLink
        key={to}
        to={to}
        end={end}
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 py-1.5 text-[11px] no-underline ${
            isActive ? "font-bold text-ink" : "font-medium text-muted"
          }`
        }
      >
        <Icon size={22} />
        {short}
      </NavLink>
    ))}
  </nav>
);
