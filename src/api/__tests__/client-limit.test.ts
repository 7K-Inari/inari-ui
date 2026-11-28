import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { API_BASE_URL, ApiError, apiFetch } from "@/api/client";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledFrame: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

async function rejection(path: string): Promise<unknown> {
  try {
    await apiFetch(path);
    return null;
  } catch (error) {
    return error;
  }
}

describe("plan-limit API errors", () => {
  it("retains validated quota details", async () => {
    mockServer.use(
      http.get(`${API_BASE_URL}/clusters`, () =>
        HttpResponse.json(
          {
            status: 429,
            detail: "cluster limit exceeded",
            code: "plan_limit_exceeded",
            limitKind: "quota",
            limit: "clusters",
            currentUsage: 2,
            maxAllowed: 2,
            requested: 1,
            upgradeUrl: "https://7kgroup.org",
          },
          { status: 429 },
        ),
      ),
    );
    const error = await rejection("/clusters");
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isLimitExceeded).toBe(true);
    expect((error as ApiError).limitExceeded).toEqual({
      limitKind: "quota",
      limit: "clusters",
      currentUsage: 2,
      maxAllowed: 2,
      requested: 1,
      upgradeUrl: "https://7kgroup.org",
    });
  });

  it("retains feature denials and zero-valued quota fields", async () => {
    mockServer.use(
      http.get(`${API_BASE_URL}/zones`, () =>
        HttpResponse.json(
          { status: 403, code: "plan_limit_exceeded", limitKind: "feature", limit: "zone-vending" },
          { status: 403 },
        ),
      ),
      http.get(`${API_BASE_URL}/members`, () =>
        HttpResponse.json(
          { status: 429, code: "plan_limit_exceeded", limitKind: "quota", limit: "developer-seats", currentUsage: 0, maxAllowed: 0 },
          { status: 429 },
        ),
      ),
    );
    expect((await rejection("/zones") as ApiError).limitExceeded).toEqual({ limitKind: "feature", limit: "zone-vending" });
    expect((await rejection("/members") as ApiError).limitExceeded).toMatchObject({ currentUsage: 0, maxAllowed: 0 });
  });

  it("does not classify malformed or unavailable errors as plan denials", async () => {
    mockServer.use(
      http.get(`${API_BASE_URL}/malformed`, () =>
        HttpResponse.json(
          { status: 429, code: "plan_limit_exceeded", limitKind: "quota", limit: "clusters", currentUsage: "two", maxAllowed: 2 },
          { status: 429 },
        ),
      ),
      http.get(`${API_BASE_URL}/unavailable`, () =>
        HttpResponse.json({ status: 503, code: "plan_limits_unavailable" }, { status: 503 }),
      ),
    );
    expect((await rejection("/malformed") as ApiError).isLimitExceeded).toBe(false);
    expect((await rejection("/unavailable") as ApiError).isLimitExceeded).toBe(false);
  });
});
