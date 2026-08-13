import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "@/layout/sidebar";
import { NAV_SECTIONS } from "@/layout/nav";

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
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
        const link = screen.getByRole("link", { name: item.label });
        expect(link).toHaveAttribute("href", `/acme/${item.path}`);
      }
    }
  });
});
