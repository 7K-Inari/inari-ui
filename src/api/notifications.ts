import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// Notifications (plan §5.2): per-tenant opt-in Slack/webhook endpoints
// subscribed to the server outbox fan-out. Wire shapes come from the
// huma-generated OpenAPI contract (pinned snapshot in openapi/openapi.yaml);
// server validation lives in inari-server internal/notifications.

export type NotificationEndpoint =
  components["schemas"]["NotificationEndpoint"];
export type NotificationDelivery =
  components["schemas"]["NotificationDelivery"];

type EndpointOutputBody = components["schemas"]["EndpointOutputBody"];
type ListOutputBody = components["schemas"]["ListOutputBody3"];
type TestOutputBody = components["schemas"]["TestOutputBody"];

export type EndpointKind = "slack" | "webhook";

export interface EndpointInput {
  name: string;
  kind: EndpointKind;
  url: string;
  /** Webhook HMAC-SHA256 secret. Blank on update = keep the stored secret. */
  secret?: string;
  /** Empty = subscribe to all events. */
  events: string[];
  enabled: boolean;
}

// Mirrors subscribedEvents in inari-server internal/notifications
// (event literals from internal/types). Grouped for the filter picker.
export const EVENT_OPTIONS: { value: string; label: string; group: string }[] =
  [
    { value: "approval.requested", label: "Approval requested", group: "Approvals" },
    { value: "approval.decided", label: "Approval decided", group: "Approvals" },
    { value: "approval.cancelled", label: "Approval cancelled", group: "Approvals" },
    { value: "approval.expired", label: "Approval expired", group: "Approvals" },
    { value: "capabilities.ingested", label: "Capabilities ingested", group: "Capabilities & instances" },
    { value: "instance.status", label: "Instance status", group: "Capabilities & instances" },
    { value: "instance.upgraded", label: "Instance upgraded", group: "Capabilities & instances" },
    { value: "deploy.requested", label: "Deploy requested", group: "Deploys & rollouts" },
    { value: "rollout.completed", label: "Rollout completed", group: "Deploys & rollouts" },
    { value: "rollout.failed", label: "Rollout failed", group: "Deploys & rollouts" },
    { value: "rollout.rolled_back", label: "Rollout rolled back", group: "Deploys & rollouts" },
    { value: "drift.detected", label: "Drift detected", group: "Deploys & rollouts" },
    { value: "drift.resolved", label: "Drift resolved", group: "Deploys & rollouts" },
    { value: "extension.state_changed", label: "Extension state changed", group: "Extensions" },
    { value: "scaffold.completed", label: "Provisioning completed", group: "Provisioning" },
    { value: "scaffold.failed", label: "Provisioning failed", group: "Provisioning" },
  ];

export function eventLabel(value: string): string {
  return EVENT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// Client-side display masking only: authorized viewers receive the full URL
// from the API; we render scheme + host and mask the path (which carries the
// Slack/webhook secret material).
export function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}/•••`;
  } catch {
    return "•••";
  }
}

function base(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}/notification-endpoints`;
}

export async function listEndpoints(
  token: string | undefined,
  tenant: string,
): Promise<NotificationEndpoint[]> {
  const res = await apiFetch<ListOutputBody>(base(tenant), { token });
  return res.endpoints ?? [];
}

export async function createEndpoint(
  token: string | undefined,
  tenant: string,
  input: EndpointInput,
): Promise<NotificationEndpoint> {
  const body: Record<string, unknown> = {
    name: input.name,
    kind: input.kind,
    url: input.url,
    events: input.events,
    enabled: input.enabled,
  };
  if (input.secret) body.secret = input.secret;
  const res = await apiFetch<EndpointOutputBody>(base(tenant), {
    token,
    method: "POST",
    body,
  });
  return res.endpoint;
}

export async function updateEndpoint(
  token: string | undefined,
  tenant: string,
  id: string,
  input: Omit<EndpointInput, "kind">,
): Promise<NotificationEndpoint> {
  // UpdateInputBody has no kind (immutable post-create); a blank secret
  // preserves the stored one server-side, so omit it.
  const body: Record<string, unknown> = {
    name: input.name,
    url: input.url,
    events: input.events,
    enabled: input.enabled,
  };
  if (input.secret) body.secret = input.secret;
  const res = await apiFetch<EndpointOutputBody>(
    `${base(tenant)}/${encodeURIComponent(id)}`,
    { token, method: "PUT", body },
  );
  return res.endpoint;
}

export async function deleteEndpoint(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<void> {
  await apiFetch(`${base(tenant)}/${encodeURIComponent(id)}`, {
    token,
    method: "DELETE",
  });
}

export async function testEndpoint(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<NotificationDelivery> {
  const res = await apiFetch<TestOutputBody>(
    `${base(tenant)}/${encodeURIComponent(id)}/test`,
    { token, method: "POST" },
  );
  return res.delivery;
}
