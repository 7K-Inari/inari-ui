import { describe, expect, it } from "vitest";

import { applyHintsToSchema, hintsToUiSchema } from "@/components/schema-form/ui-hints";
import type { UiHints } from "@/api/types";

describe("hintsToUiSchema", () => {
  it("maps labels, descriptions, widgets and hidden hints", () => {
    const hints: UiHints = {
      engine: { label: "Engine version", description: "Major version", widget: "text" },
      password: { hidden: true },
      backup: { widget: "textarea" },
    };
    const uiSchema = hintsToUiSchema(hints);
    expect(uiSchema["engine"]).toMatchObject({
      "ui:title": "Engine version",
      "ui:description": "Major version",
    });
    expect(uiSchema["password"]).toMatchObject({ "ui:widget": "hidden" });
    expect(uiSchema["backup"]).toMatchObject({ "ui:widget": "textarea" });
  });

  it("maps field ordering onto ui:order at the root", () => {
    const hints: UiHints = {
      engine: { order: ["engine", "storageGi"] },
    };
    const uiSchema = hintsToUiSchema(hints);
    expect(uiSchema["ui:order"]).toEqual(["engine", "storageGi"]);
  });
});

describe("applyHintsToSchema", () => {
  it("converts option hints into oneOf const/title entries", () => {
    const schema = {
      type: "object",
      properties: { size: { type: "string", enum: ["s", "l"] } },
    };
    const hints: UiHints = {
      size: { options: [{ label: "Small", value: "s" }, { label: "Large", value: "l" }] },
    };
    const result = applyHintsToSchema(schema, hints) as {
      properties: { size: { oneOf: { const: string; title: string }[] } };
    };
    expect(result.properties.size.oneOf).toEqual([
      { const: "s", title: "Small" },
      { const: "l", title: "Large" },
    ]);
  });

  it("returns the schema unchanged when no option hints apply", () => {
    const schema = { type: "object", properties: { a: { type: "string" } } };
    expect(applyHintsToSchema(schema, {})).toEqual(schema);
  });
});
