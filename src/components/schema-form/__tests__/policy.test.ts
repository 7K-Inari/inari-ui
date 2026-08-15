import { describe, expect, it } from "vitest";

import { applyPolicy, injectLockedValues } from "@/components/schema-form/policy";
import type { PolicySummary } from "@/api/types";

const schema = {
  type: "object",
  properties: {
    engine: { type: "string" },
    instanceClass: { type: "string", enum: ["db.t3.medium", "db.r6g.large"] },
  },
};

const policy: PolicySummary = {
  gitopsMode: "pull-request",
  approvalRequired: false,
  lockedFields: [
    { path: "instanceClass", value: "db.t3.medium", reason: "Cost guardrail" },
  ],
  notes: [],
};

describe("applyPolicy", () => {
  it("marks locked fields disabled with the locked value as default", () => {
    const { uiSchema, formDefaults } = applyPolicy(schema, policy);
    expect(uiSchema["instanceClass"]).toMatchObject({
      "ui:disabled": true,
      "ui:description": expect.stringContaining("Cost guardrail"),
    });
    expect(formDefaults).toEqual({ instanceClass: "db.t3.medium" });
  });

  it("leaves other fields untouched", () => {
    const { uiSchema } = applyPolicy(schema, policy);
    expect(uiSchema["engine"]).toBeUndefined();
  });
});

describe("injectLockedValues", () => {
  it("forces locked values into form data, overriding user edits", () => {
    const result = injectLockedValues(
      { engine: "16", instanceClass: "db.r6g.large" },
      policy.lockedFields,
    );
    expect(result).toEqual({ engine: "16", instanceClass: "db.t3.medium" });
  });

  it("adds locked values missing from form data", () => {
    expect(injectLockedValues({}, policy.lockedFields)).toEqual({
      instanceClass: "db.t3.medium",
    });
  });
});
