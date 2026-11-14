import { describe, expect, it } from "vitest";

import {
  canonicalAddonAdoptPath,
  canonicalItemPath,
  canonicalTemplatePath,
  itemRouteID,
  parseCanonicalItemID,
} from "@/api/identity";

describe("source-qualified catalog identity", () => {
  it("accepts exactly one source and package segment", () => {
    expect(parseCanonicalItemID("core/postgresql-aws")).toEqual({
      source: "core",
      name: "postgresql-aws",
    });
    expect(parseCanonicalItemID("postgresql-aws")).toBeNull();
    expect(parseCanonicalItemID("core/team/postgresql-aws")).toBeNull();
    expect(parseCanonicalItemID("curated:postgresql-aws")).toBeNull();
  });

  it("uses two path segments for external catalog and template deep links", () => {
    expect(canonicalItemPath("core/postgresql-aws")).toBe("/catalog/core/postgresql-aws");
    expect(canonicalTemplatePath("community/web-service")).toBe(
      "/templates/community/web-service",
    );
    expect(canonicalAddonAdoptPath("cluster-1", "core/cert-manager")).toBe(
      "/clusters/cluster-1/addons/core/cert-manager/adopt",
    );
  });

  it("preserves internal component/discovered identifiers without aliases", () => {
    expect(canonicalItemPath("component:payments-api")).toBe(
      "/catalog/component%3Apayments-api",
    );
    expect(canonicalItemPath("discovered:cert-manager")).toBe(
      "/catalog/discovered%3Acert-manager",
    );
  });

  it("reconstructs the canonical ID from source/name route params", () => {
    expect(itemRouteID({ source: "core", name: "postgresql-aws" })).toBe(
      "core/postgresql-aws",
    );
    expect(itemRouteID({ itemId: "component:payments-api" })).toBe(
      "component:payments-api",
    );
    expect(itemRouteID({})).toBe("");
  });
});
