import { describe, expect, it } from "vitest";

import { formatCountdown, formatRelative } from "@/lib/time";

const NOW = new Date("2026-08-14T12:00:00Z").getTime();

describe("formatRelative", () => {
  it("returns 'never' for null", () => {
    expect(formatRelative(null, NOW)).toBe("never");
  });

  it("returns 'just now' for timestamps under a minute old or in the future", () => {
    expect(formatRelative(new Date(NOW - 30_000).toISOString(), NOW)).toBe("just now");
    expect(formatRelative(new Date(NOW + 5_000).toISOString(), NOW)).toBe("just now");
  });

  it("formats minutes, hours, and days", () => {
    expect(formatRelative(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe("5m ago");
    expect(formatRelative(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe("3h ago");
    expect(formatRelative(new Date(NOW - 2 * 86_400_000).toISOString(), NOW)).toBe("2d ago");
  });
});

describe("formatCountdown", () => {
  it("returns 'expired' when the target has passed", () => {
    expect(formatCountdown(new Date(NOW - 1_000).toISOString(), NOW)).toBe("expired");
    expect(formatCountdown(new Date(NOW).toISOString(), NOW)).toBe("expired");
  });

  it("formats remaining time as m:ss", () => {
    expect(formatCountdown(new Date(NOW + 14 * 60_000 + 7_000).toISOString(), NOW)).toBe("14:07");
    expect(formatCountdown(new Date(NOW + 61_000).toISOString(), NOW)).toBe("1:01");
  });
});
