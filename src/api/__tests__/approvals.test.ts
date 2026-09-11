import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { listApprovalsInbox } from "@/api/approvals";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
});
afterAll(() => mockServer.close());

describe("approvals inbox api", () => {
  it("lists pending approvals across all of the caller's orgs", async () => {
    const items = await listApprovalsInbox("tok");
    expect(items.length).toBeGreaterThan(0);
    expect(new Set(items.map((a) => a.tenant)).size).toBeGreaterThan(1);
    expect(items.every((a) => a.status === "pending")).toBe(true);
  });

  it("maps the wire shape to the ApprovalRequest view model", async () => {
    const [first] = await listApprovalsInbox("tok");
    expect(first).toMatchObject({
      id: expect.any(String),
      tenant: expect.any(String),
      kind: expect.any(String),
      title: expect.any(String),
      requestedBy: expect.any(String),
      requestedAt: expect.any(String),
      status: "pending",
    });
  });

  it("sends the bearer token", async () => {
    let seen: string | null = null;
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/approvals/inbox", ({ request }) => {
        seen = request.headers.get("authorization");
        return HttpResponse.json({ items: [] });
      }),
    );
    await listApprovalsInbox("tok");
    expect(seen).toBe("Bearer tok");
  });
});
