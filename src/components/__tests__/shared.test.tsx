import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { useConfirm } from "@/components/confirm";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { healthToBadge, statusToBadge, statusToDot } from "@/lib/status-badges";

describe("statusToBadge", () => {
  it("maps machine states to badge variants", () => {
    expect(statusToBadge("connected")).toBe("success");
    expect(statusToBadge("pending")).toBe("warning");
    expect(statusToBadge("degraded")).toBe("danger");
    expect(statusToBadge("cordoned")).toBe("neutral");
    expect(statusToBadge("totally-unknown")).toBe("neutral");
  });

  it("maps ArgoCD health to badge variants", () => {
    expect(healthToBadge("Healthy")).toBe("success");
    expect(healthToBadge("Progressing")).toBe("warning");
    expect(healthToBadge("Degraded")).toBe("danger");
    expect(healthToBadge("Suspended")).toBe("neutral");
  });

  it("maps status to status-dot classes", () => {
    expect(statusToDot("connected")).toBe("status-dot-live");
    expect(statusToDot("degraded")).toBe("status-dot-busy");
    expect(statusToDot("unknown")).toBe("status-dot-offline");
  });
});

describe("PageHeader", () => {
  it("renders breadcrumb, title, and actions", () => {
    render(
      <PageHeader
        breadcrumb="Operate / Clusters"
        title="Clusters"
        actions={<button>Register</button>}
      />,
    );
    expect(screen.getByText("Operate / Clusters")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Clusters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
  });
});

function LocationSpy() {
  const location = useLocation();
  return <span data-testid="search">{location.search}</span>;
}

describe("FilterBar", () => {
  it("syncs quick-filter tags and clear into the URL", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FilterBar
          tags={{
            param: "status",
            items: [{ value: "degraded", label: "Degraded", count: 2 }],
          }}
        />
        <LocationSpy />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Degraded" }));
    expect(screen.getByTestId("search")).toHaveTextContent("status=degraded");
    await user.click(screen.getByRole("button", { name: /Clear/ }));
    expect(screen.getByTestId("search")).not.toHaveTextContent("status=degraded");
  });
});

function ConfirmHarness({ onResult }: { onResult: (ok: boolean) => void }) {
  const [confirm, dialog] = useConfirm();
  return (
    <>
      <button
        onClick={() =>
          void confirm({ title: "Delete thing", body: "Sure?", confirmLabel: "Delete" }).then(
            onResult,
          )
        }
      >
        Trigger
      </button>
      {dialog}
    </>
  );
}

describe("useConfirm", () => {
  it("resolves true on confirm and false on cancel", async () => {
    const user = userEvent.setup();
    const results: boolean[] = [];
    render(<ConfirmHarness onResult={(ok) => results.push(ok)} />);

    await user.click(screen.getByRole("button", { name: "Trigger" }));
    let dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(results).toEqual([true]);

    await user.click(screen.getByRole("button", { name: "Trigger" }));
    dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(results).toEqual([true, false]);
  });
});
