import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SlotBoundary } from "@/ext/slot-boundary";

function Throwing(): never {
  throw new Error("boom");
}

describe("SlotBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <SlotBoundary>
        <p>healthy slot</p>
      </SlotBoundary>,
    );
    expect(screen.getByText("healthy slot")).toBeInTheDocument();
  });

  it("contains a throwing remote component and renders a fallback", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <div>
        <p>shell intact</p>
        <SlotBoundary extensionName="bad-ext">
          <Throwing />
        </SlotBoundary>
      </div>,
    );
    expect(screen.getByText("shell intact")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Extension content unavailable");
    spy.mockRestore();
  });
});
