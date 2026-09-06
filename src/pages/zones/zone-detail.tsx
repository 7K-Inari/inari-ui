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
import { Separator } from "@/components/ui/separator";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { ZoneStatusBadge } from "@/pages/zones/zone-list";

const STEP_LABELS: Record<string, string> = {
  preflight: "Preflight checks",
  account_vend: "Cloud account",
  trust_bootstrap: "Trust setup",
  eks_provision: "EKS cluster",
  inari_wiring: "Platform wiring",
  cordon: "Cordon workloads",
  drain: "Drain workloads",
  eks_delete: "Delete EKS cluster",
  account_close: "Close cloud account",
  identity_revoke: "Revoke platform access",
  audit_archive: "Archive audit trail",
};

function stepLabel(name: string): string {
  return STEP_LABELS[name] ?? name;
}

function StepIcon({ status }: { status: ZoneStepStatus }) {
  switch (status) {
    case "succeeded":
      return <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />;
    case "running":
    case "waiting":
      return <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />;
    case "failed":
      return <XCircle className="h-5 w-5 text-destructive" aria-hidden />;
    case "skipped":
      return <CheckCircle2 className="h-5 w-5 text-muted-foreground/50" aria-hidden />;
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
              {stepLabel(step.name)}
              <span className="ml-2 text-xs text-muted-foreground">{step.status}</span>
            </p>
            {step.detail && <p className="text-xs text-muted-foreground">{step.detail}</p>}
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
  const { data: zone, loading, error, refetch } = useAsyncResource(
    (t) => getZone(t, zoneId!, tenant),
    [zoneId, tenant],
    { refetchIntervalMs: 3_000, enabled: polling },
  );

  React.useEffect(() => {
    if (!zone) return;
    setPolling(zone.status === "provisioning" || zone.status === "decommissioning");
  }, [zone]);

  const [decomError, setDecomError] = React.useState<string | null>(null);
  const [decomSubmitting, setDecomSubmitting] = React.useState(false);
  const [decomApprovalId, setDecomApprovalId] = React.useState<string | null | undefined>(
    undefined,
  );

  const submitDecommission = async (e: React.FormEvent) => {
    e.preventDefault();
    setDecomSubmitting(true);
    setDecomError(null);
    try {
      const result = await requestZoneDecommission(token, tenant, zone!.id);
      setDecomApprovalId(result.approvalId);
      // Re-enable fetching (it is paused for non-transitional zones) so the
      // zone reflects its new decommission_pending_approval state.
      setPolling(true);
      refetch();
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

  const requested =
    decomApprovalId !== undefined ||
    zone.status === "decommission_pending_approval" ||
    zone.status === "cordoning" ||
    zone.status === "draining";

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
              : "Provisioning pipeline: preflight, cloud account, trust, EKS cluster, then platform wiring."}
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
              {decomError && <p className="text-sm text-destructive">{decomError}</p>}
              <div className="flex justify-end">
                <Button type="submit" variant="destructive" disabled={decomSubmitting}>
                  {decomSubmitting ? "Requesting…" : "Request decommission"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {requested && zone.status !== "decommissioning" && zone.status !== "closed" && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            {decomApprovalId === null ? (
              <>Decommission requested. Teardown has started.</>
            ) : (
              <>
                Decommission requested. Teardown is gated on approval: a request has been added to
                the Approvals inbox, and the operator tears the zone down once it is approved.
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
