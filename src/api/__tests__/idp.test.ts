import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  deleteIdentityProvider,
  getIdentityProvider,
  putDomainHints,
  putIdentityProvider,
  rotateProviderSecret,
} from "@/api/idp";
import { policyMockControl, putIdpProviderMock } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  policyMockControl.reset();
});
afterAll(() => mockServer.close());

const input = {
  alias: "acme-sso",
  issuerUrl: "https://idp.acme.example",
  clientId: "inari-acme",
  clientSecret: "sec-initial",
  claimMapping: { email: "email", groups: "groups" },
  domainHints: ["acme.example"],
};

describe("idp api", () => {
  it("returns null when no provider is configured", async () => {
    await expect(getIdentityProvider("tok", "acme")).resolves.toBeNull();
  });

  it("creates a provider via the compat PUT contract", async () => {
    let seenBody: unknown = null;
    mockServer.use(
      http.put("*/api/v1/tenants/:org/identity/provider", async ({ request }) => {
        seenBody = await request.json();
        return HttpResponse.json({
          provider: {
            alias: "acme-sso",
            claimMapping: { email: "email", groups: "groups" },
            clientId: "inari-acme",
            createdAt: new Date().toISOString(),
            domainHints: ["acme.example"],
            issuerUrl: "https://idp.acme.example",
          },
        });
      }),
    );
    const provider = await putIdentityProvider("tok", "acme", input);
    expect(seenBody).toEqual(input);
    expect(provider.alias).toBe("acme-sso");
  });

  it("replaces domain hints", async () => {
    putIdpProviderMock("acme", input);
    const provider = await putDomainHints("tok", "acme", [
      "acme.example",
      "*.acme.example",
    ]);
    expect(provider.domainHints).toEqual(["acme.example", "*.acme.example"]);
  });

  it("rotates the write-only secret (204, no body)", async () => {
    putIdpProviderMock("acme", input);
    await expect(
      rotateProviderSecret("tok", "acme", "sec-rotated"),
    ).resolves.toBeUndefined();
  });

  it("deletes the provider", async () => {
    putIdpProviderMock("acme", input);
    await deleteIdentityProvider("tok", "acme");
    await expect(getIdentityProvider("tok", "acme")).resolves.toBeNull();
  });
});
