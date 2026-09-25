import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  cancelScaffoldRun,
  createScaffoldRun,
  getScaffoldRun,
  getTemplate,
  listTemplates,
  mapRunView,
  retryScaffoldRun,
} from "@/api/templates";
import type { components } from "@/api/__generated__/schema";
import { m4MockControl } from "@/mocks/fixtures/m4";
import { mockServer } from "@/mocks/server";

type RunView = components["schemas"]["RunView"];

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  m4MockControl.reset();
});
afterAll(() => mockServer.close());

function runView(overrides: Partial<RunView> = {}): RunView {
  return {
    id: "run-1",
    templateName: "web-service",
    version: "1.4.0",
    displayName: "payments-api",
    phase: "running",
    steps: [
      { name: "render", state: "completed", attempts: 1 },
      { name: "create-repo", state: "running", attempts: 1 },
    ],
    createdBy: "user@example.com",
    createdAt: "2026-09-24T10:00:00Z",
    updatedAt: "2026-09-24T10:00:05Z",
    ...overrides,
  };
}

describe("mapRunView", () => {
  it("maps steps and extracts typed outputs from the untyped outputs map", () => {
    const run = mapRunView(
      runView({
        outputs: {
          repoUrl: "https://github.com/acme/payments-api",
          pipelineUrl: null,
          catalogItemId: "discovered-payments-api",
        },
      }),
    );
    expect(run.id).toBe("run-1");
    expect(run.templateName).toBe("web-service");
    expect(run.steps).toEqual([
      { name: "render", state: "completed", attempts: 1, error: null },
      { name: "create-repo", state: "running", attempts: 1, error: null },
    ]);
    expect(run.outputs).toEqual({
      repoUrl: "https://github.com/acme/payments-api",
      pipelineUrl: null,
      catalogItemId: "discovered-payments-api",
    });
    expect(run.terminal).toBe(false);
    expect(run.failed).toBe(false);
  });

  it("treats a run-level error as failed and terminal even when the phase string is unknown", () => {
    const run = mapRunView(runView({ phase: "rendering", error: "boom" }));
    expect(run.failed).toBe(true);
    expect(run.terminal).toBe(true);
  });

  it("treats completed and cancelled phases as terminal", () => {
    expect(mapRunView(runView({ phase: "completed" })).terminal).toBe(true);
    expect(mapRunView(runView({ phase: "cancelled" })).terminal).toBe(true);
    expect(mapRunView(runView({ phase: "pending" })).terminal).toBe(false);
  });

  it("handles missing steps and non-string output values defensively", () => {
    const run = mapRunView(runView({ steps: null, outputs: { repoUrl: 42 } }));
    expect(run.steps).toEqual([]);
    expect(run.outputs.repoUrl).toBeNull();
  });
});

describe("templates api (canonical endpoints)", () => {
  it("lists templates via GET /templates with normalized tags", async () => {
    const templates = await listTemplates("tok", "acme");
    expect(templates[0].name).toBe("web-service");
    expect(templates[0].tags).toContain("golden-path");
  });

  it("gets a template with a typed schema via GET /templates/{name}", async () => {
    const template = await getTemplate("tok", "acme", "web-service");
    expect(template.displayName).toBe("Web Service");
    expect(template.schema.type).toBe("object");
  });

  it("creates a run via POST /templates/{name}/runs with values body", async () => {
    let seenBody: unknown = null;
    let seenPath = "";
    mockServer.use(
      http.post("*/api/v1/tenants/:org/templates/:name/runs", async ({ params, request }) => {
        seenPath = `${params.org}/${params.name}`;
        seenBody = await request.json();
        return HttpResponse.json({ run: runView() });
      }),
    );
    const run = await createScaffoldRun("tok", "acme", "web-service", {
      displayName: "payments-api",
      values: { description: "Payments API", port: 8080 },
    });
    expect(seenPath).toBe("acme/web-service");
    expect(seenBody).toEqual({
      displayName: "payments-api",
      values: { description: "Payments API", port: 8080 },
    });
    expect(run.id).toBe("run-1");
  });

  it("polls a run via GET /scaffold-runs/{runId}", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/scaffold-runs/:runId", ({ params }) => {
        return HttpResponse.json({ run: runView({ id: params.runId as string }) });
      }),
    );
    const run = await getScaffoldRun("tok", "acme", "run-9");
    expect(run.id).toBe("run-9");
  });

  it("cancels a run via POST /scaffold-runs/{runId}/cancel", async () => {
    let called = false;
    mockServer.use(
      http.post("*/api/v1/tenants/:org/scaffold-runs/:runId/cancel", () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await cancelScaffoldRun("tok", "acme", "run-1");
    expect(called).toBe(true);
  });

  it("treats a null templates array as an empty list", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/templates", () =>
        HttpResponse.json({ templates: null }),
      ),
    );
    await expect(listTemplates("tok", "acme")).resolves.toEqual([]);
  });

  it("retries a run via POST /scaffold-runs/{runId}/retry and returns the mapped run", async () => {
    mockServer.use(
      http.post("*/api/v1/tenants/:org/scaffold-runs/:runId/retry", () => {
        return HttpResponse.json({ run: runView({ phase: "running" }) });
      }),
    );
    const run = await retryScaffoldRun("tok", "acme", "run-1");
    expect(run.phase).toBe("running");
    expect(run.terminal).toBe(false);
  });
});
