import { describe, expect, it } from "vitest";

import { parseOrganizations } from "@/auth/orgs";

describe("parseOrganizations", () => {
  it("parses multiple organizations from the organization claim", () => {
    const token = {
      organization: {
        acme: { name: "Acme Corp" },
        globex: {},
      },
    };
    expect(parseOrganizations(token)).toEqual([
      { id: "acme", name: "Acme Corp" },
      { id: "globex", name: "globex" },
    ]);
  });

  it("parses a single organization", () => {
    expect(parseOrganizations({ organization: { acme: {} } })).toEqual([
      { id: "acme", name: "acme" },
    ]);
  });

  it("returns an empty list when the claim is missing", () => {
    expect(parseOrganizations(undefined)).toEqual([]);
    expect(parseOrganizations({})).toEqual([]);
  });

  it("returns an empty list for malformed claims", () => {
    expect(parseOrganizations({ organization: "acme" })).toEqual([]);
    expect(parseOrganizations({ organization: null })).toEqual([]);
  });

  it("parses an array-shaped claim (mapper without organization attributes)", () => {
    expect(
      parseOrganizations({ organization: ["acme", "globex"] }),
    ).toEqual([
      { id: "acme", name: "acme" },
      { id: "globex", name: "globex" },
    ]);
  });
});
