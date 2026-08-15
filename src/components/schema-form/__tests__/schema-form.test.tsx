import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { SchemaForm, type SchemaFormHandle } from "@/components/schema-form/schema-form";

const schema = {
  type: "object",
  required: ["engine"],
  properties: {
    engine: { type: "string", title: "Engine version" },
    storageGi: { type: "integer", title: "Storage", minimum: 10 },
    ha: { type: "boolean", title: "High availability" },
  },
};

function Harness() {
  const [data, setData] = React.useState<Record<string, unknown>>({});
  return (
    <div>
      <output data-testid="data">{JSON.stringify(data)}</output>
      <SchemaForm schema={schema} formData={data} onChange={setData} />
    </div>
  );
}

describe("SchemaForm", () => {
  it("renders fields from the schema and reports changes", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText(/Engine version/);
    await user.type(input, "16");
    expect(screen.getByTestId("data").textContent).toContain('"engine":"16"');
  });

  it("validate() reports false when required fields are missing", () => {
    const ref = React.createRef<SchemaFormHandle>();
    render(<SchemaForm ref={ref} schema={schema} formData={{}} onChange={() => undefined} />);
    expect(ref.current!.validate()).toBe(false);
  });

  it("validate() reports true when the data is valid", () => {
    const ref = React.createRef<SchemaFormHandle>();
    render(
      <SchemaForm ref={ref} schema={schema} formData={{ engine: "16" }} onChange={() => undefined} />,
    );
    expect(ref.current!.validate()).toBe(true);
  });

  it("does not render a submit button", () => {
    render(<SchemaForm schema={schema} formData={{}} onChange={() => undefined} />);
    expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
  });
});
