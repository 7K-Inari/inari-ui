import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "@/layout/sidebar";
import { NAV_SECTIONS } from "@/layout/nav";

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

vi.mock("@/api/hooks", () => ({
  useAsyncResource: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
}));

describe("Sidebar", () => {
  it("renders every IA section with tenant-prefixed links", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        // The responsive shell renders both a full sidebar and an icon rail.
        const links = screen.getAllByRole("link", { name: item.label });
        expect(links.length).toBeGreaterThan(0);
        for (const link of links) {
          expect(link).toHaveAttribute("href", `/acme/${item.path}`);
        }
      }
    }
  });
});
