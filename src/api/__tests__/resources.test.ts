import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  deleteResource,
  getResource,
  rollbackResource,
  updateResourceSpec,
} from "@/api/resources";
import { mockControl } from "@/mocks/fixtures";
import { mockCatalogControl } from "@/mocks/fixtures/catalog";
import { mockServer } from "@/mocks/server";
import { setCurrentTenant } from "@/tenant/current";

beforeAll(() => {
  setCurrentTenant("acme"); // helpers fall back to the active tenant
  mockServer.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
  mockCatalogControl.reset();
});
afterAll(() => mockServer.close());

describe("resources lifecycle api", () => {
  it("updates an instance spec in place", async () => {
    const res = await updateResourceSpec("tok", "ri-orders-db", { storageGi: 200 });
    expect(res.phase).toBe("syncing");
    const updated = await getResource("tok", "ri-orders-db");
    expect(updated.spec).toEqual({ storageGi: 200 });
    expect(updated.version).toBe("1.3.0");
  });

  it("rolls an instance back to an older version", async () => {
    const res = await rollbackResource("tok", "ri-orders-db", "1.2.1");
    expect(res.version).toBe("1.2.1");
    const updated = await getResource("tok", "ri-orders-db");
    expect(updated.version).toBe("1.2.1");
  });

  it("rejects a rollback to the current version with 409", async () => {
    await expect(rollbackResource("tok", "ri-orders-db", "1.3.0")).rejects.toMatchObject({
      status: 409,
    });
  });

  it("deletes (undeploys) an instance", async () => {
    const res = await deleteResource("tok", "ri-orders-db");
    expect(res.phase).toBe("syncing");
    await expect(getResource("tok", "ri-orders-db")).rejects.toMatchObject({ status: 404 });
  });

  it("returns 404 for unknown instances", async () => {
    await expect(deleteResource("tok", "ri-nope")).rejects.toMatchObject({ status: 404 });
    await expect(updateResourceSpec("tok", "ri-nope", {})).rejects.toMatchObject({
      status: 404,
    });
  });
});
