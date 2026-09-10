import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  decideExemption,
  listExemptions,
  requestExemption,
} from "@/api/policies";
import { useAuth } from "@/auth/auth-context";
import type { components } from "@/api/__generated__/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRelative } from "@/lib/time";
import {
  CapabilityGate,
  useOrgCapabilities,
} from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

type Exemption = components["schemas"]["Exemption"];

function stateVariant(state: string): "warning" | "success" | "destructive" | "muted" {
  switch (state) {
    case "pending":
      return "warning";
    case "approved":
      return "success";
    case "rejected":
      return "destructive";
    default:
      return "muted";
  }
}

export function ExemptionsPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { canWriteSettings } = useOrgCapabilities();
  const {
    data: exemptions,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listExemptions(t, tenant), [tenant]);

  const [showRequest, setShowRequest] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [policyId, setPolicyId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");

  const fail = (err: unknown, fallback: string) =>
    setActionError(err instanceof ApiError ? err.message : fallback);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await requestExemption(token, tenant, {
        policyId,
        reason,
        expiresAt: new Date(expiresAt).toISOString(),
        scope: {},
      });
      setShowRequest(false);
      setPolicyId("");
      setReason("");
      setExpiresAt("");
      refetch();
    } catch (err) {
      fail(err, "Failed to request exemption");
    }
  };

  const decide = async (id: string, approve: boolean) => {
    setActionError(null);
    try {
      await decideExemption(token, tenant, id, { approve });
      refetch();
    } catch (err) {
      fail(err, "Failed to record decision");
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Policy exemptions"
        description="Time-boxed exemptions from policy evaluation. Decisions are restricted to platform engineers and org admins."
        actions={
          <CapabilityGate
            capability="admin"
            fallback={
              <span className="text-xs text-muted-foreground">Read-only (org viewer)</span>
            }
          >
            <Button onClick={() => setShowRequest((v) => !v)}>
              {showRequest ? "Cancel" : "Request exemption"}
            </Button>
          </CapabilityGate>
        }
      />

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load exemptions: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !exemptions && (
        <p className="text-sm text-muted-foreground">Loading exemptions…</p>
      )}

      {actionError && (
        <Card>
          <CardContent className="py-3 text-sm text-destructive">{actionError}</CardContent>
        </Card>
      )}

      {showRequest && canWriteSettings && (
        <Card>
          <CardContent className="py-4">
            <form className="space-y-3" onSubmit={submitRequest}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ex-policy">Policy ID</Label>
                  <Input
                    id="ex-policy"
                    value={policyId}
                    onChange={(e) => setPolicyId(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ex-expires">Expires at</Label>
                  <Input
                    id="ex-expires"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ex-reason">Reason</Label>
                <Input
                  id="ex-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>
              <Button type="submit">Submit request</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {!error && exemptions && exemptions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No exemptions requested yet.
          </CardContent>
        </Card>
      )}

      {exemptions && exemptions.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Policy</th>
                <th className="px-4 py-2 font-medium">State</th>
                <th className="px-4 py-2 font-medium">Reason</th>
                <th className="px-4 py-2 font-medium">Requested by</th>
                <th className="px-4 py-2 font-medium">Expires</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exemptions.map((ex: Exemption) => (
                <tr key={ex.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{ex.policyId}</td>
                  <td className="px-4 py-2">
                    <Badge variant={stateVariant(ex.state)}>{ex.state}</Badge>
                  </td>
                  <td className="px-4 py-2">{ex.reason ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{ex.createdBy ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {formatRelative(ex.expiresAt)}
                  </td>
                  <td className="px-4 py-2">
                    {ex.state === "pending" && (
                      <CapabilityGate capability="admin">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => decide(ex.id, true)}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => decide(ex.id, false)}
                          >
                            Reject
                          </Button>
                        </div>
                      </CapabilityGate>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
