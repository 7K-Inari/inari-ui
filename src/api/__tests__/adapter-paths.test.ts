import { describe, expect, it, vi } from "vitest";

import schemaRaw from "@/api/__generated__/schema.ts?raw";

// Guard test: every path handed to apiFetch must exist in the huma-generated
// OpenAPI contract (src/api/__generated__/schema.ts). Catches doc/code drift
// like "notifications/endpoints" vs "notification-endpoints" at test time.
//
// Mechanism: apiFetch and resolveTenant are mocked, each adapter module is
// imported and every exported function is invoked with canned args, and every
// path argument is recorded. Paths are then normalized positionally (dynamic
// segments become {}) and compared against the schema path keys (whose
// {param} segments also become {} — server param names intentionally differ
// from UI variable names, so the comparison is positional, never name-based).

const { captured } = vi.hoisted(() => ({ captured: [] as string[] }));

vi.mock("@/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/api/client")>();
  return {
    ...original,
    apiFetch: vi.fn((path: string): Promise<unknown> => {
      captured.push(path);
      return Promise.resolve({});
    }),
  };
});

vi.mock("@/tenant/current", () => ({
  resolveTenant: () => "__tenant__",
  setCurrentTenant: () => undefined,
  getCurrentTenant: () => "__tenant__",
}));

// Every adapter module under src/api/ that talks to the control plane.
// hooks.ts is excluded: it holds React data-fetching hooks with no HTTP
// paths of its own. client.ts/types.ts are infrastructure, not adapters.
// When adding a new adapter, add it here so its paths are guarded too.
const ADAPTERS = [
  "approvals",
  "audit",
  "catalog",
  "cloud-accounts",
  "clusters",
  "deploys",
  "extensions",
  "fleet",
  "identity",
  "idp",
  "me",
  "notifications",
  "platform",
  "policies",
  "rbac",
  "resources",
  "secret-stores",
  "secrets",
  "templates",
  "tenants",
  "zones",
] as const;

const SCHEMA_PATHS: string[] = [
  ...schemaRaw.matchAll(/^ {4}"(\/api\/v1[^"]*)": \{$/gm),
].map((m) => m[1]);

// Literal (non-parameter) segments used anywhere in the schema. During
// normalization any captured segment that is not a known literal is treated
// as a dynamic value (tenant slug, id, name, ...) and replaced with {}.
const LITERAL_SEGMENTS = new Set<string>();
for (const path of SCHEMA_PATHS) {
  for (const segment of path.split("/")) {
    if (segment && !segment.startsWith("{")) LITERAL_SEGMENTS.add(segment);
  }
}

const NORMALIZED_SCHEMA_PATHS = new Set(SCHEMA_PATHS.map(normalizeSchemaPath));

function normalizeSchemaPath(path: string): string {
  return path
    .split("/")
    .map((segment) => (segment.startsWith("{") ? "{}" : segment))
    .join("/");
}

function normalizeCapturedPath(path: string): string {
  const withoutQuery = path.split("?")[0];
  const prefixed = withoutQuery.startsWith("/api/v1")
    ? withoutQuery
    : `/api/v1${withoutQuery}`;
  return prefixed
    .split("/")
    .map((segment) =>
      segment === "" || LITERAL_SEGMENTS.has(segment) ? segment : "{}",
    )
    .join("/");
}

// Canned arguments: (token, tenant, id, more ids..., input object, opts).
// resolveTenant is mocked, so tenant-position args don't need to be valid.
const ARGS: unknown[] = [
  "tok",
  "acme",
  "dummy-id",
  "dummy-id-2",
  "dummy-id-3",
  { name: "x", kind: "slack", url: "https://example.com", events: [], enabled: true },
  {},
];

async function captureModulePaths(name: string): Promise<string[]> {
  const start = captured.length;
  const mod: Record<string, unknown> = await import(`@/api/${name}.ts`);
  for (const value of Object.values(mod)) {
    if (typeof value !== "function") continue;
    const fn = value as (...args: unknown[]) => unknown;
    try {
      await fn(...ARGS.slice(0, fn.length));
    } catch {
      // Mapping code after the fetch may reject on the {} mock response or
      // on canned args; the path was already recorded before that point.
    }
  }
  return captured.slice(start);
}

describe("adapter paths match the OpenAPI schema", () => {
  it("extracted a non-empty schema path list", () => {
    expect(SCHEMA_PATHS.length).toBeGreaterThan(0);
  });

  for (const name of ADAPTERS) {
    describe(name, () => {
      it("captures at least one apiFetch path", async () => {
        const paths = await captureModulePaths(name);
        expect(
          paths.length,
          `no apiFetch calls captured for ${name} — did its exports change?`,
        ).toBeGreaterThan(0);
      });

      it("only calls paths that exist in the schema", async () => {
        const paths = await captureModulePaths(name);
        const missing = [...new Set(paths.map(normalizeCapturedPath))].filter(
          (p) => !NORMALIZED_SCHEMA_PATHS.has(p),
        );
        expect(
          missing,
          `${name} calls paths missing from src/api/__generated__/schema.ts:\n` +
            missing.map((p) => `  ${p}`).join("\n"),
        ).toEqual([]);
      });
    });
  }
});
