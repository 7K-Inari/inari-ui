import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

import { useAsyncResource } from "@/api/hooks";
import type { ZoneStep, ZoneStepStatus } from "@/api/zones";
import { getZone, requestZoneDecommission } from "@/api/zones";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { ZoneStatusBadge } from "@/pages/zones/zone-list";

const STEP_LABELS: Record<ZoneStep["name"], string> = {
  account: "Cloud account",
  trust: "Trust setup",
  eks: "EKS cluster",
  wiring: "Platform wiring",
};

function StepIcon({ status }: { status: ZoneStepStatus }) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />;
    case "in_progress":
      return <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />;
    case "failed":
      return <XCircle className="h-5 w-5 text-destructive" aria-hidden />;
    default:
      return <Circle className="h-5 w-5 text-muted-foreground/50" aria-hidden />;
  }
}

function LifecycleSteps({ steps }: { steps: ZoneStep[] }) {
  return (
    <ol className="space-y-3" aria-label="Zone lifecycle">
      {steps.map((step) => (
        <li key={step.name} className="flex items-start gap-3">
          <StepIcon status={step.status} />
          <div>
            <p className={step.status === "pending" ? "text-muted-foreground" : "font-medium"}>
              {STEP_LABELS[step.name]}
              <span className="ml-2 text-xs text-muted-foreground">{step.status}</span>
            </p>
            {step.message && <p className="text-xs text-muted-foreground">{step.message}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ZoneDetailPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { zoneId } = useParams<{ zoneId: string }>();

  const [polling, setPolling] = React.useState(true);
  const { data: zone, loading, error } = useAsyncResource(
    (t) => getZone(t, zoneId!, tenant),
    [zoneId, tenant],
    { refetchIntervalMs: 3_000, enabled: polling },
  );

  React.useEffect(() => {
    if (!zone) return;
    setPolling(zone.status === "provisioning" || zone.status === "decommissioning");
  }, [zone]);

  const [reason, setReason] = React.useState("");
  const [decomError, setDecomError] = React.useState<string | null>(null);
  const [decomSubmitting, setDecomSubmitting] = React.useState(false);
  const [decomRequested, setDecomRequested] = React.useState(false);

  const submitDecommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setDecomSubmitting(true);
    setDecomError(null);
    try {
      await requestZoneDecommission(token, tenant, zone!.id, reason.trim());
      setDecomRequested(true);
    } catch (err) {
      setDecomError(err instanceof Error ? err.message : "Failed to request decommission");
    } finally {
      setDecomSubmitting(false);
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          Failed to load zone: {error.message}
        </CardContent>
      </Card>
    );
  }
  if (!zone) {
    return (
      <p className="text-sm text-muted-foreground">
        {loading ? "Loading zone…" : "Zone not found."}
      </p>
    );
  }

  const requested = decomRequested || zone.status === "decommission_requested";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{zone.name}</h1>
            <ZoneStatusBadge status={zone.status} />
            <Badge variant="outline">{zone.tier}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {zone.slug} · OU {zone.orgUnit} · {zone.region} · created{" "}
            {formatRelative(zone.createdAt)}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={tenantLink(tenant, "tenant-zones")}>Back to zones</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lifecycle</CardTitle>
          <CardDescription>
            {zone.status === "decommissioning"
              ? "Teardown in progress — steps roll back in reverse order."
              : "Provisioning pipeline: account, trust, EKS cluster, then platform wiring."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LifecycleSteps steps={zone.steps} />
          {(zone.cloudAccountId || zone.clusterId) && (
            <>
              <Separator className="my-4" />
              <dl className="space-y-1 text-sm">
                {zone.cloudAccountId && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Cloud account:</dt>
                    <dd className="font-mono text-xs">{zone.cloudAccountId}</dd>
                  </div>
                )}
                {zone.clusterId && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Cluster:</dt>
                    <dd className="font-mono text-xs">{zone.clusterId}</dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </CardContent>
      </Card>

      {zone.status === "active" && !requested && (
        <Card>
          <CardHeader>
            <CardTitle>Decommission</CardTitle>
            <CardDescription>
              Tears down the zone. This is gated on approval before any teardown starts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitDecommission} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="decommission-reason">Reason</Label>
                <Input
                  id="decommission-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this zone being decommissioned?"
                  required
                />
              </div>
              {decomError && <p className="text-sm text-destructive">{decomError}</p>}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={decomSubmitting || !reason.trim()}
                >
                  {decomSubmitting ? "Requesting…" : "Request decommission"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {requested && zone.status !== "decommissioning" && zone.status !== "decommissioned" && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Decommission requested. Teardown is gated on approval: a request has been added to the
            Approvals inbox, and the operator tears the zone down once it is approved.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
