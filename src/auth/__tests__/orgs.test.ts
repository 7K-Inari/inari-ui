import { describe, expect, it } from "vitest";

import { hasOrganization, parseOrganizations } from "@/auth/orgs";

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

  it("deduplicates organizations and ignores non-string array entries", () => {
    expect(
      parseOrganizations({ organization: ["acme", "acme", 42, "globex"] }),
    ).toEqual([
      { id: "acme", name: "acme" },
      { id: "globex", name: "globex" },
    ]);
  });

  it("falls back to the alias when the name attribute is not a string", () => {
    expect(
      parseOrganizations({ organization: { acme: { name: 42 } } }),
    ).toEqual([{ id: "acme", name: "acme" }]);
  });
});

describe("hasOrganization", () => {
  const token = {
    organization: { acme: { name: "Acme Corp" }, globex: {} },
  };

  it("returns true when the alias is present in the claim", () => {
    expect(hasOrganization(token, "acme")).toBe(true);
    expect(hasOrganization(token, "globex")).toBe(true);
  });

  it("returns false when the alias is absent or the token is malformed", () => {
    expect(hasOrganization(token, "evilcorp")).toBe(false);
    expect(hasOrganization(undefined, "acme")).toBe(false);
    expect(hasOrganization({ organization: "acme" }, "acme")).toBe(false);
  });

  it("supports array-shaped claims", () => {
    expect(hasOrganization({ organization: ["acme"] }, "acme")).toBe(true);
    expect(hasOrganization({ organization: ["acme"] }, "globex")).toBe(false);
  });
});
