// 75 -> "01:15", 3725 -> "1:02:05"
export const formatClock = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

// 45 -> "45s", 600 -> "10m", 3900 -> "1h 5m"
export const formatDuration = (totalSeconds: number): string => {
  const exact = Math.abs(totalSeconds);
  // whole seconds count like a stopwatch, matching formatClock
  if (exact < 60) return `${Math.floor(exact)}s`;
  const seconds = Math.round(exact);
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

// drift-style numbers: +5m late, −3m early
export const formatSignedDuration = (totalSeconds: number): string => {
  if (Math.round(totalSeconds) === 0) return "on time";
  return `${totalSeconds > 0 ? "+" : "−"}${formatDuration(totalSeconds)}`;
};

export const formatPercent = (ratio: number): string =>
  `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;

export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

// "09:14"
export const formatHM = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

// "Monday 9 November"
export const formatLongDate = (iso: string): string => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { weekday: "long" })} ${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "long" })}`;
};

// "1 session", "3 sessions"
export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

// "8 Nov"
export const formatShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export const isSameLocalDay = (a: string, b: string): boolean =>
  new Date(a).toDateString() === new Date(b).toDateString();

export const minutesToSeconds = (minutes: number) => Math.round(minutes * 60);
export const secondsToMinutes = (seconds: number) => Math.round(seconds / 60);
