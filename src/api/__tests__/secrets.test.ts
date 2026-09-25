import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { listRegistrationTokens } from "@/api/secrets";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

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
