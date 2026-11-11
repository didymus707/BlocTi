import type { ReactNode, SVGProps } from "react";

// Stroke icons drawn on a 24px grid; they take the text colour.
type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

const icon = (paths: ReactNode, strokeWidth = 2) =>
  function Icon({ size = 18, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {paths}
      </svg>
    );
  };

export const CalendarIcon = icon(
  <>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </>,
);
export const BlocksIcon = icon(
  <>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </>,
);
export const AgentIcon = icon(
  <>
    <rect x="5" y="8" width="14" height="11" rx="3" />
    <path d="M12 4v4M9.5 13.5h.01M14.5 13.5h.01" />
  </>,
);
export const ReportsIcon = icon(<path d="M5 20V11M12 20V5M19 20v-6" />);
export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />, 2.2);
export const PauseIcon = icon(<path d="M9 6v12M15 6v12" />, 2.2);
export const PlayIcon = icon(<path d="M8 5.5v13l10-6.5z" />);
export const CheckIcon = icon(<path d="M5 12.5l4.5 4.5L19 7" />, 2.2);
export const SkipIcon = icon(
  <>
    <path d="M6 5l10 7-10 7z" />
    <path d="M19 5v14" />
  </>,
);
export const BreakIcon = icon(
  <>
    <path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
    <path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17" />
  </>,
);
export const StopIcon = icon(<rect x="6" y="6" width="12" height="12" rx="2" />);
export const ExpandIcon = icon(<path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" />);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6L6 18" />);
export const BackIcon = icon(<path d="M19 12H5M11 6l-6 6 6 6" />);
export const InfoIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5h.01" />
  </>,
);
export const DownloadIcon = icon(<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />);
export const TrashIcon = icon(<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />);

// the BlocTi mark: a block (rounded frame) holding a clock and a task list
export const LogoMark = ({ size = 30, ...rest }: IconProps) => (
  <svg
    width={size}
    height={(size * 2) / 3}
    viewBox="0 0 48 32"
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    strokeLinecap="round"
    aria-hidden="true"
    {...rest}
  >
    <rect x="1.5" y="1.5" width="45" height="29" rx="7" />
    <circle cx="15" cy="16" r="8" />
    <path d="M15 11.5v4.5h3.5" />
    <path d="M30 10h9M30 16h9M30 22h9" />
  </svg>
);
