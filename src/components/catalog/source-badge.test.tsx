import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SourceBadge } from "@/components/catalog/source-badge";

describe("SourceBadge", () => {
  it("labels a stale source alongside its identity and trust", () => {
    render(<SourceBadge sourceId="core" trustTier="reviewed" sourceState="stale" />);
    expect(screen.getByText("core")).toBeInTheDocument();
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.getByText("Stale source")).toBeInTheDocument();
  });

  it("does not mark a ready source as stale", () => {
    render(<SourceBadge sourceId="core" sourceState="ready" />);
    expect(screen.queryByText("Stale source")).not.toBeInTheDocument();
  });
});
