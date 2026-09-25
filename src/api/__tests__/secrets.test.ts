import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  createSecretStore,
  deleteSecretStore,
  getSecretStoreStatus,
  listRegistrationTokens,
  listSecretStores,
  secretStoreProviderType,
  updateSecretStore,
  type SecretStoreProvider,
} from "@/api/secrets";
import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  policyMockControl.reset();
});
afterAll(() => mockServer.close());

const vaultInput = {
  name: "east-vault",
  scope: "cluster" as const,
  clusterIds: ["cl-1"],
  provider: {
    vault: {
      server: "https://vault.acme.example",
      authSecretRef: { name: "eso-token", namespace: "external-secrets" },
    },
  },
};

describe("secrets api — secret stores", () => {
  it("lists stores from the contract envelope", async () => {
    const stores = await listSecretStores("tok", "acme");
    expect(stores.map((s) => s.name)).toEqual(["inari-platform", "acme-vault"]);
    expect(stores[0].targets.clusterIds).toEqual(["*"]);
  });

  it("maps the input view model onto CreateInputBody1", async () => {
    let seenBody: unknown = null;
    mockServer.use(
      http.post("*/api/v1/tenants/:org/secret-stores", async ({ request }) => {
        seenBody = await request.json();
        return HttpResponse.json(
          {
            store: {
              id: "ss-1",
              orgId: "acme",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              ...(vaultInput as object),
              targets: { clusterIds: vaultInput.clusterIds },
            },
          },
          { status: 201 },
        );
      }),
    );
    await createSecretStore("tok", "acme", vaultInput);
    expect(seenBody).toEqual({
      name: "east-vault",
      scope: "cluster",
      provider: vaultInput.provider,
      targets: { clusterIds: ["cl-1"] },
    });
  });

  it("PATCHes provider and targets only on update", async () => {
    let seenBody: unknown = null;
    mockServer.use(
      http.patch(
        "*/api/v1/tenants/:org/secret-stores/:name",
        async ({ request }) => {
          seenBody = await request.json();
          return HttpResponse.json({ store: {} });
        },
      ),
    );
    await updateSecretStore("tok", "acme", "acme-vault", vaultInput);
    expect(seenBody).toEqual({
      provider: vaultInput.provider,
      targets: { clusterIds: ["cl-1"] },
    });
  });

  it("reads the delivery status projection", async () => {
    const status = await getSecretStoreStatus("tok", "acme", "acme-vault");
    expect(status.delivered).toBe(false);
    expect(status.conditions?.[0]).toMatchObject({
      type: "Ready",
      reason: "WaitingForAgent",
      clusterId: "cl-kind-dev",
    });
  });

  it("deletes a store", async () => {
    await deleteSecretStore("tok", "acme", "acme-vault");
    const stores = await listSecretStores("tok", "acme");
    expect(stores.map((s) => s.name)).toEqual(["inari-platform"]);
  });

  it("detects the provider type from the nested union", () => {
    const cases: [SecretStoreProvider, string | undefined][] = [
      [{ awsSM: { region: "r", authSecretRef: { name: "n", namespace: "s" } } }, "awsSM"],
      [{ vault: { server: "u", authSecretRef: { name: "n", namespace: "s" } } }, "vault"],
      [{ gcpsm: { projectId: "p", authSecretRef: { name: "n", namespace: "s" } } }, "gcpsm"],
      [{ azurekv: { vaultUrl: "u", authSecretRef: { name: "n", namespace: "s" } } }, "azurekv"],
      [{}, undefined],
    ];
    for (const [provider, expected] of cases) {
      expect(secretStoreProviderType(provider)).toBe(expected);
    }
  });
});

describe("secrets api — registration tokens", () => {
  it("normalizes a null token list to empty", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/clusters/:id/tokens", () =>
        HttpResponse.json({ tokens: null }),
      ),
    );
    await expect(
      listRegistrationTokens("tok", "acme", "cl-1"),
    ).resolves.toEqual([]);
  });
});
