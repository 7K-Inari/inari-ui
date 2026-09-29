import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { apiFetch, API_BASE_URL } from "@/api/client";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

function captureHeaders() {
  let seen: Headers | null = null;
  mockServer.use(
    http.get(`${API_BASE_URL}/probe`, ({ request }) => {
      seen = request.headers;
      return HttpResponse.json({ ok: true });
    }),
  );
  return () => seen;
}

describe("apiFetch", () => {
  // Pins the git-connections live failure (run 7045f491): endpoints that
  // negotiate on Accept (e.g. usergit authorize: 200 JSON vs 302 to the
  // provider) must see the console as a JSON client — otherwise fetch
  // follows the cross-origin redirect and surfaces "control plane
  // unreachable".
  it("always sends Accept: application/json", async () => {
    const headers = captureHeaders();
    await apiFetch("/probe");
    expect(headers()?.get("accept")).toBe("application/json");
  });

  it("sends the bearer token and JSON content type when provided", async () => {
    const headers = captureHeaders();
    await apiFetch("/probe", { token: "tok-1" });
    expect(headers()?.get("authorization")).toBe("Bearer tok-1");
  });
});
