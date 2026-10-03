// Edge-case coverage: error paths, encoding, disabled states for the Connect tab.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { ConnectTab } from "@/pages/clusters/connect-tab";
import { downloadKubeconfig } from "@/api/clusters";
import { connectedCluster } from "@/mocks/fixtures";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
beforeEach(() => mockControl.reset());
afterAll(() => mockServer.close());

function stubAnchor() {
  const origCreate = document.createElement.bind(document);
  const anchor = {
    href: "",
    download: "",
    click: vi.fn(),
  } as unknown as HTMLAnchorElement;
  vi.spyOn(document, "createElement").mockImplementation(((
    tag: string,
    options?: ElementCreationOptions,
  ) =>
    tag === "a"
      ? anchor
      : origCreate(tag, options)) as typeof document.createElement);
  URL.createObjectURL = vi.fn().mockReturnValue("blob:mock");
  URL.revokeObjectURL = vi.fn();
  return anchor;
}

describe("QA probes", () => {
  it("shows an error when access-info fetch fails", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get(
        "*/api/v1/tenants/acme/clusters/cl-kind-dev/access-info",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    render(<ConnectTab cluster={connectedCluster} />);
    expect(
      await screen.findByText(/Failed to load connection info/),
    ).toBeInTheDocument();
  });

  it("surfaces download failure in the UI and re-enables the button", async () => {
    const user = userEvent.setup();
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/clusters/cl-kind-dev/kubeconfig", () =>
        HttpResponse.json(
          {
            title: "Unprocessable",
            status: 422,
            detail: "server URL is required in direct mode",
          },
          { status: 422 },
        ),
      ),
    );
    mockControl.setAccessInfo("cl-kind-dev", { tunnelAvailable: false });
    render(<ConnectTab cluster={connectedCluster} />);
    const btn = await screen.findByRole("button", {
      name: /download kubeconfig/i,
    });
    await user.click(btn);
    expect(
      await screen.findByText(/server URL is required in direct mode/),
    ).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("direct mode with empty server omits the server param", async () => {
    const user = userEvent.setup();
    let seenUrl: string | null = null;
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get(
        "*/api/v1/tenants/acme/clusters/cl-kind-dev/kubeconfig",
        ({ request }) => {
          seenUrl = request.url;
          return new HttpResponse("apiVersion: v1\n", {
            headers: { "Content-Type": "application/yaml" },
          });
        },
      ),
    );
    stubAnchor();
    mockControl.setAccessInfo("cl-kind-dev", { tunnelAvailable: false });
    render(<ConnectTab cluster={connectedCluster} />);
    const btn = await screen.findByRole("button", {
      name: /download kubeconfig/i,
    });
    await user.click(btn);
    await waitFor(() => expect(seenUrl).not.toBeNull());
    const url = new URL(seenUrl!);
    expect(url.searchParams.get("mode")).toBe("direct");
    expect(url.searchParams.get("server")).toBeNull();
  });

  it("server URL with special characters is query-encoded", async () => {
    let seenUrl: string | null = null;
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get(
        "*/api/v1/tenants/acme/clusters/cl-kind-dev/kubeconfig",
        ({ request }) => {
          seenUrl = request.url;
          return new HttpResponse("ok", {
            headers: { "Content-Type": "application/yaml" },
          });
        },
      ),
    );
    stubAnchor();
    await downloadKubeconfig("tok", "cl-kind-dev", {
      mode: "direct",
      server: "https://api.example.com:6443/path?x=1&y=2",
    });
    const url = new URL(seenUrl!);
    expect(url.searchParams.get("server")).toBe(
      "https://api.example.com:6443/path?x=1&y=2",
    );
  });

  it("gateway radio is disabled when the tunnel is unavailable", async () => {
    mockControl.setAccessInfo("cl-kind-dev", { tunnelAvailable: false });
    render(<ConnectTab cluster={connectedCluster} />);
    await screen.findByRole("radio", { name: /direct/i });
    expect(screen.getByRole("radio", { name: /gateway/i })).toBeDisabled();
  });

  it("cluster id with special chars is URL-encoded in requests but readable in command", async () => {
    let seenPath: string | null = null;
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get(
        "*/api/v1/tenants/acme/clusters/*/access-info",
        ({ request }) => {
          seenPath = new URL(request.url).pathname;
          return HttpResponse.json({
            accessInfo: {
              audience: "kubernetes",
              issuerUrl: "https://kc",
              kubectlAccessEnabled: true,
              kubectlClientId: "x",
              organization: "acme",
              tunnelAvailable: true,
            },
          });
        },
      ),
    );
    const weird = { ...connectedCluster, id: "cl kind/dev" };
    render(<ConnectTab cluster={weird} />);
    await screen.findByText("inari login");
    expect(seenPath).toContain("cl%20kind%2Fdev");
    expect(
      screen.getByText("inari cluster connect cl kind/dev"),
    ).toBeInTheDocument();
  });
});
