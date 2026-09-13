import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  createEndpoint,
  deleteEndpoint,
  eventLabel,
  EVENT_OPTIONS,
  listEndpoints,
  maskUrl,
  testEndpoint,
  updateEndpoint,
} from "@/api/notifications";
import type {
  EndpointInput,
  EndpointKind,
  NotificationDelivery,
  NotificationEndpoint,
} from "@/api/notifications";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRelative } from "@/lib/time";
import { useOrgCapabilities } from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

const EVENT_GROUPS = [...new Set(EVENT_OPTIONS.map((o) => o.group))];

interface FormState {
  name: string;
  kind: EndpointKind;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
}

const emptyForm: FormState = {
  name: "",
  kind: "slack",
  url: "",
  secret: "",
  events: [],
  enabled: true,
};

function formFromEndpoint(ep: NotificationEndpoint): FormState {
  return {
    name: ep.name,
    kind: ep.kind as EndpointKind,
    url: ep.url,
    secret: "",
    events: ep.events ?? [],
    enabled: ep.enabled,
  };
}

function EndpointForm({
  initial,
  editing,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial: FormState;
  editing: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (input: EndpointInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = React.useState<FormState>(initial);
  const [formError, setFormError] = React.useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleEvent = (value: string) =>
    set(
      "events",
      form.events.includes(value)
        ? form.events.filter((e) => e !== value)
        : [...form.events, value],
    );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("Name is required");
      return;
    }
    if (!/^https?:\/\/.+/.test(form.url.trim())) {
      setFormError("URL must be an http(s) URL");
      return;
    }
    onSubmit({
      name: form.name.trim(),
      kind: form.kind,
      url: form.url.trim(),
      secret: form.secret.trim() || undefined,
      events: form.events,
      enabled: form.enabled,
    });
  };

  return (
    <Card>
      <CardContent className="py-4">
        <form onSubmit={submit} className="max-w-2xl space-y-4">
          <div className="space-y-1.5">
            <Label>Kind</Label>
            <div className="flex gap-4">
              {(["slack", "webhook"] as const).map((kind) => (
                <label
                  key={kind}
                  className="flex items-center gap-1.5 text-sm capitalize"
                >
                  <input
                    type="radio"
                    name="endpoint-kind"
                    value={kind}
                    checked={form.kind === kind}
                    disabled={editing}
                    onChange={() => set("kind", kind)}
                  />
                  {kind === "slack" ? "Slack" : "Webhook"}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="endpoint-name">Name</Label>
            <Input
              id="endpoint-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="ops-alerts"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="endpoint-url">URL</Label>
            <Input
              id="endpoint-url"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder={
                form.kind === "slack"
                  ? "https://hooks.slack.com/services/…"
                  : "https://example.com/inari-hook"
              }
            />
            {form.kind === "slack" ? (
              <p className="text-xs text-muted-foreground">
                Create an incoming webhook for your Slack channel at{" "}
                <span className="font-medium">api.slack.com</span> (Apps →
                Incoming Webhooks) and paste its URL here. Notifications arrive
                as Slack messages.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Inari POSTs a JSON envelope{" "}
                <code>{"{event, text, payload, sentAt}"}</code> to this URL.
                Set a signing secret below to verify deliveries with
                HMAC-SHA256 (header{" "}
                <code>X-Inari-Signature: sha256=…</code>).
              </p>
            )}
          </div>

          {form.kind === "webhook" && (
            <div className="space-y-1.5">
              <Label htmlFor="endpoint-secret">Signing secret (optional)</Label>
              <Input
                id="endpoint-secret"
                type="password"
                value={form.secret}
                onChange={(e) => set("secret", e.target.value)}
                placeholder={
                  editing ? "Leave blank to keep the current secret" : ""
                }
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Events</Label>
            <p className="text-xs text-muted-foreground">
              Select none to subscribe to all events.
            </p>
            <div className="space-y-2">
              {EVENT_GROUPS.map((group) => (
                <div key={group}>
                  <p className="pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {EVENT_OPTIONS.filter((o) => o.group === group).map(
                      (opt) => {
                        const active = form.events.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleEvent(opt.value)}
                            className={
                              active
                                ? "rounded-md border border-transparent bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
                                : "rounded-md border px-2 py-0.5 text-xs font-medium text-foreground hover:bg-accent"
                            }
                          >
                            {opt.label}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => set("enabled", e.target.checked)}
            />
            Enabled
          </label>

          {(formError ?? error) && (
            <p className="text-sm text-destructive">{formError ?? error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Create endpoint"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function EndpointRow({
  tenant,
  endpoint,
  canWrite,
  testResult,
  onChanged,
  onEdit,
  onTested,
}: {
  tenant: string;
  endpoint: NotificationEndpoint;
  canWrite: boolean;
  testResult: NotificationDelivery | null;
  onChanged: () => void;
  onEdit: () => void;
  onTested: (endpointId: string, delivery: NotificationDelivery) => void;
}) {
  const { token } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Request failed",
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = () =>
    run(async () => {
      await updateEndpoint(token, tenant, endpoint.id, {
        name: endpoint.name,
        url: endpoint.url,
        events: endpoint.events ?? [],
        enabled: !endpoint.enabled,
      });
      onChanged();
    });

  const sendTest = () =>
    run(async () => {
      const delivery = await testEndpoint(token, tenant, endpoint.id);
      onTested(endpoint.id, delivery);
    });

  const remove = () => {
    if (
      !window.confirm(
        `Delete notification endpoint "${endpoint.name}"? Deliveries stop immediately.`,
      )
    )
      return;
    void run(async () => {
      await deleteEndpoint(token, tenant, endpoint.id);
      onChanged();
    });
  };

  return (
    <tr className="border-t hover:bg-muted/30">
      <td className="px-4 py-2 font-medium">{endpoint.name}</td>
      <td className="px-4 py-2">
        <Badge variant={endpoint.kind === "slack" ? "default" : "secondary"}>
          {endpoint.kind}
        </Badge>
      </td>
      <td className="px-4 py-2">
        <span
          className="font-mono text-xs text-muted-foreground"
          title={endpoint.url}
        >
          {maskUrl(endpoint.url)}
        </span>
      </td>
      <td className="px-4 py-2">
        <div className="flex max-w-xs flex-wrap gap-1">
          {!endpoint.events || endpoint.events.length === 0 ? (
            <Badge variant="muted">All events</Badge>
          ) : (
            endpoint.events.map((e) => (
              <Badge key={e} variant="outline">
                {eventLabel(e)}
              </Badge>
            ))
          )}
        </div>
      </td>
      <td className="px-4 py-2">
        <input
          type="checkbox"
          aria-label={`Enabled: ${endpoint.name}`}
          checked={endpoint.enabled}
          disabled={!canWrite || busy}
          onChange={toggleEnabled}
        />
      </td>
      <td className="px-4 py-2 text-xs text-muted-foreground">
        {formatRelative(endpoint.createdAt)}
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          {actionError && (
            <span className="text-xs text-destructive">{actionError}</span>
          )}
          {testResult &&
            (testResult.status === "delivered" ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                Test delivered{" "}
                {testResult.deliveredAt
                  ? formatRelative(testResult.deliveredAt)
                  : ""}
              </span>
            ) : (
              <span className="text-xs text-destructive">
                Test failed: {testResult.lastError ?? "unknown error"}
              </span>
            ))}
          {canWrite && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={sendTest}
              >
                Send test
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onEdit}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={remove}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export function NotificationsPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { canWriteSettings } = useOrgCapabilities();

  const {
    data: endpoints,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listEndpoints(t, tenant), [tenant]);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<NotificationEndpoint | null>(
    null,
  );
  const [formBusy, setFormBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [testResults, setTestResults] = React.useState<
    Record<string, NotificationDelivery>
  >({});

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (ep: NotificationEndpoint) => {
    setEditing(ep);
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const submit = async (input: EndpointInput) => {
    setFormError(null);
    setFormBusy(true);
    try {
      if (editing) {
        await updateEndpoint(token, tenant, editing.id, {
          name: input.name,
          url: input.url,
          secret: input.secret,
          events: input.events,
          enabled: input.enabled,
        });
      } else {
        await createEndpoint(token, tenant, input);
      }
      closeForm();
      refetch();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Failed to save endpoint",
      );
    } finally {
      setFormBusy(false);
    }
  };

  const onTested = (endpointId: string, delivery: NotificationDelivery) =>
    setTestResults((prev) => ({ ...prev, [endpointId]: delivery }));

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Notifications"
        description="Send tenant events to Slack or a webhook endpoint you control."
        actions={
          canWriteSettings ? (
            <Button onClick={openCreate}>New endpoint</Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Read-only (org viewer)
            </span>
          )
        }
      />

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load notification endpoints: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !endpoints && (
        <p className="text-sm text-muted-foreground">Loading endpoints…</p>
      )}

      {formOpen && (
        <EndpointForm
          key={editing?.id ?? "new"}
          initial={editing ? formFromEndpoint(editing) : emptyForm}
          editing={editing !== null}
          busy={formBusy}
          error={formError}
          onSubmit={submit}
          onCancel={closeForm}
        />
      )}

      {endpoints && endpoints.length === 0 && !formOpen && (
        <Card>
          <CardContent className="space-y-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No notification endpoints yet.
            </p>
            {canWriteSettings && (
              <Button onClick={openCreate}>Create your first endpoint</Button>
            )}
          </CardContent>
        </Card>
      )}

      {endpoints && endpoints.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Kind</th>
                  <th className="px-4 py-2 font-medium">URL</th>
                  <th className="px-4 py-2 font-medium">Events</th>
                  <th className="px-4 py-2 font-medium">Enabled</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {endpoints.map((ep) => (
                  <EndpointRow
                    key={ep.id}
                    tenant={tenant}
                    endpoint={ep}
                    canWrite={canWriteSettings}
                    testResult={testResults[ep.id] ?? null}
                    onChanged={refetch}
                    onEdit={() => openEdit(ep)}
                    onTested={onTested}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Per-event delivery history is not exposed by the API yet (follow-up
            server task); use Send test to verify an endpoint.
          </p>
        </>
      )}
    </div>
  );
}
