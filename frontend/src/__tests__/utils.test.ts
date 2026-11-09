import { describe, expect, it } from "vitest";
import { formatClock, formatDuration, formatPercent, formatSignedDuration } from "../utils";

describe("formatting", () => {
  it("formats a clock like a stopwatch", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(75.9)).toBe("01:15");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-5)).toBe("00:00");
  });

  it("formats durations, flooring seconds to agree with the clock", () => {
    expect(formatDuration(31.6)).toBe("31s");
    expect(formatDuration(600)).toBe("10m");
    expect(formatDuration(3900)).toBe("1h 5m");
    expect(formatDuration(7200)).toBe("2h");
  });

  it("signs drift and calls zero on time", () => {
    expect(formatSignedDuration(300)).toBe("+5m");
    expect(formatSignedDuration(-120)).toBe("−2m");
    expect(formatSignedDuration(0.2)).toBe("on time");
  });

  it("clamps percentages", () => {
    expect(formatPercent(0.754)).toBe("75%");
    expect(formatPercent(1.4)).toBe("100%");
  });
});

describe("words and dates", () => {
  it("pluralises", async () => {
    const { plural } = await import("../utils");
    expect(plural(1, "session")).toBe("1 session");
    expect(plural(3, "session")).toBe("3 sessions");
    expect(plural(2, "switch", "switches")).toBe("2 switches");
  });
});
