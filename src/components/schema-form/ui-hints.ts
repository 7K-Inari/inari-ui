import type { UiSchema } from "@rjsf/utils";

import type { UiHints } from "@/api/types";

type JsonSchema = Record<string, unknown>;

export function hintsToUiSchema(hints: UiHints): UiSchema {
  const uiSchema: UiSchema = {};
  for (const [path, hint] of Object.entries(hints)) {
    const entry: Record<string, unknown> = {};
    if (hint.label) entry["ui:title"] = hint.label;
    if (hint.description) entry["ui:description"] = hint.description;
    if (hint.hidden) entry["ui:widget"] = "hidden";
    else if (hint.widget) entry["ui:widget"] = hint.widget;
    if (hint.order) uiSchema["ui:order"] = hint.order;
    if (Object.keys(entry).length > 0) uiSchema[path] = entry;
  }
  return uiSchema;
}

export function applyHintsToSchema(schema: JsonSchema, hints: UiHints): JsonSchema {
  const properties = schema.properties as Record<string, JsonSchema> | undefined;
  if (!properties) return schema;
  let changed = false;
  const next: Record<string, JsonSchema> = { ...properties };
  for (const [path, hint] of Object.entries(hints)) {
    const prop = properties[path];
    if (!prop || !hint.options) continue;
    changed = true;
    const rest = { ...prop };
    delete rest.enum;
    next[path] = {
      ...rest,
      oneOf: hint.options.map((o) => ({ const: o.value, title: o.label })),
    };
  }
  if (!changed) return schema;
  return { ...schema, properties: next };
}
