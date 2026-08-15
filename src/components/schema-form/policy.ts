import type { UiSchema } from "@rjsf/utils";

import type { LockedField, PolicySummary } from "@/api/types";

export interface PolicyApplication {
  uiSchema: UiSchema;
  formDefaults: Record<string, unknown>;
}

export function applyPolicy(
  _schema: Record<string, unknown>,
  policy: PolicySummary,
): PolicyApplication {
  const uiSchema: UiSchema = {};
  const formDefaults: Record<string, unknown> = {};
  for (const field of policy.lockedFields) {
    uiSchema[field.path] = {
      "ui:disabled": true,
      "ui:description": field.reason
        ? `Locked by platform policy — ${field.reason}`
        : "Locked by platform policy",
    };
    formDefaults[field.path] = field.value;
  }
  return { uiSchema, formDefaults };
}

export function injectLockedValues(
  formData: Record<string, unknown>,
  lockedFields: LockedField[],
): Record<string, unknown> {
  const result = { ...formData };
  for (const field of lockedFields) {
    result[field.path] = field.value;
  }
  return result;
}
