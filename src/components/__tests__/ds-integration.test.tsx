import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable, EmptyState, Stat } from "7k-design-system/react";
import { describe, expect, it, vi } from "vitest";

// Integration smoke against the local DS build (dist/), covering behaviors the
// DS browser-mode test suite owns but this environment cannot run.

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
];

describe("DS DataTable integration", () => {
  it("puts aria-sort on the column header, not the button", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    const { container } = render(
      <DataTable<Row>
        columns={[{ key: "name", label: "Name", sortable: true }]}
        rows={rows}
        rowKey="id"
        onSort={onSort}
        sortKey="name"
        sortDirection="asc"
      />,
    );
    const th = container.querySelector("th");
    expect(th).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("button", { name: /Name/ })).not.toHaveAttribute("aria-sort");
    await user.click(screen.getByRole("button", { name: /Name/ }));
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("uses mobileLabel for the stacked layout data-label", () => {
    const { container } = render(
      <DataTable<Row>
        columns={[{ key: "name", label: <span>fancy</span>, mobileLabel: "Name" }]}
        rows={rows}
        rowKey="id"
      />,
    );
    expect(container.querySelector("td")).toHaveAttribute("data-label", "Name");
  });

  it("renders the empty slot when there are no rows", () => {
    render(
      <DataTable<Row>
        columns={[{ key: "name", label: "Name" }]}
        rows={[]}
        rowKey="id"
        empty={<EmptyState title="Nothing here" />}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Nothing here" }),
    ).toBeInTheDocument();
  });
});

describe("DS Stat integration", () => {
  it("renders value and label", () => {
    render(<Stat value={42} label="Clusters" />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Clusters")).toBeInTheDocument();
  });
});
