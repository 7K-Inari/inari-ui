import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/api/client";
import { ActionErrorNotice, DEFAULT_UPGRADE_URL, LimitExceededNotice } from "@/components/limit-exceeded";

function quotaError(upgradeUrl?: string) {
  return new ApiError(429, "cluster limit exceeded", undefined, "plan_limit_exceeded", {
    limitKind: "quota", limit: "clusters", currentUsage: 2, maxAllowed: 2, requested: 1, upgradeUrl,
  });
}

describe("LimitExceededNotice", () => {
  it("renders API usage and a safe outbound upgrade CTA without commercial catalog data", () => {
    render(<LimitExceededNotice error={quotaError("https://7kgroup.org/inari")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("2 of 2");
    const link = screen.getByRole("link", { name: /View upgrade options/i });
    expect(link).toHaveAttribute("href", "https://7kgroup.org/inari");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(screen.queryByText(/Cloud Team|\$999|Stripe/)).not.toBeInTheDocument();
  });

  it("falls back to the commercial surface for an unsafe CTA and preserves zero usage", () => {
    const error = new ApiError(429, "seat limit", undefined, "plan_limit_exceeded", {
      limitKind: "quota", limit: "developer-seats", currentUsage: 0, maxAllowed: 0, upgradeUrl: "https://evil.example/upgrade",
    });
    render(<LimitExceededNotice error={error} />);
    expect(screen.getByRole("alert")).toHaveTextContent("0 of 0");
    expect(screen.getByRole("link", { name: /View upgrade options/i })).toHaveAttribute("href", DEFAULT_UPGRADE_URL);
  });

  it("renders generic feature guidance without inventing plan names", () => {
    const error = new ApiError(403, "zone vending is unavailable", undefined, "plan_limit_exceeded", {
      limitKind: "feature", limit: "zone-vending",
    });
    render(<LimitExceededNotice error={error} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/current plan/i);
    expect(screen.queryByText(/Enterprise/)).not.toBeInTheDocument();
  });
});

describe("ActionErrorNotice", () => {
  it("uses the shared notice only for typed limit errors", () => {
    const { rerender } = render(<ActionErrorNotice error={quotaError()} fallback="Failed" />);
    expect(screen.getByRole("link", { name: /View upgrade options/i })).toBeInTheDocument();
    rerender(<ActionErrorNotice error={new ApiError(500, "server failed")} fallback="Failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent("server failed");
    expect(screen.queryByRole("link", { name: /View upgrade options/i })).not.toBeInTheDocument();
    rerender(<ActionErrorNotice error={new Error("other")} fallback="Failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
  });
});
