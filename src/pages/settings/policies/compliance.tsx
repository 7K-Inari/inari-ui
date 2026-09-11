import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { evaluatePolicies, listPolicies } from "@/api/policies";
import { useAuth } from "@/auth/auth-context";
import type { components } from "@/api/__generated__/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRelative } from "@/lib/time";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

type Policy = components["schemas"]["Policy"];
type PolicyDecision = components["schemas"]["PolicyDecision"];
type PolicyViolation = components["schemas"]["PolicyViolation"];

function ViolationList({
  title,
  items,
  variant,
}: {
  title: string;
  items: PolicyViolation[];
  variant: "destructive" | "warning";
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((v, i) => (
          <li key={`${v.rule}-${i}`} className="text-sm">
            <Badge variant={variant}>{v.rule}</Badge>{" "}
            {v.reason}{" "}
            <span className="text-xs text-muted-foreground">
              Remediation: {v.remediation}
            </span>
            {v.exempted && (
              <Badge variant="muted" className="ml-1">
                exempted
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CompliancePage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const {
    data: policies,
    loading,
    error,
  } = useAsyncResource((t) => listPolicies(t, tenant), [tenant]);

  const [itemId, setItemId] = React.useState("");
  const [version, setVersion] = React.useState("");
  const [clusterId, setClusterId] = React.useState("");
  const [spec, setSpec] = React.useState("");
  const [evaluating, setEvaluating] = React.useState(false);
  const [evalError, setEvalError] = React.useState<string | null>(null);
  const [decision, setDecision] = React.useState<PolicyDecision | null>(null);

  const submitEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    setEvalError(null);
    setDecision(null);
    let parsedSpec: unknown;
    try {
      parsedSpec = spec.trim() ? JSON.parse(spec) : {};
    } catch {
      setEvalError("Spec must be valid JSON.");
      return;
    }
    setEvaluating(true);
    try {
      const result = await evaluatePolicies(token, tenant, {
        itemId,
        version,
        clusterId,
        spec: parsedSpec,
      });
      setDecision(result);
    } catch (err) {
      setEvalError(
        err instanceof ApiError ? err.message : "Failed to evaluate policies",
      );
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Compliance"
        description="Active policies and dry-run pre-flight evaluation. Read-only."
      />

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load policies: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !policies && (
        <p className="text-sm text-muted-foreground">Loading policies…</p>
      )}

      {!error && policies && policies.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No policies defined for this organization.
          </CardContent>
        </Card>
      )}

      {policies && policies.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Target</th>
                <th className="px-4 py-2 font-medium">Engine</th>
                <th className="px-4 py-2 font-medium">State</th>
                <th className="px-4 py-2 font-medium">Version</th>
                <th className="px-4 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p: Policy) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{p.target}</td>
                  <td className="px-4 py-2 font-mono text-xs">{p.engine}</td>
                  <td className="px-4 py-2">
                    {p.enabled ? (
                      <Badge variant="success">enabled</Badge>
                    ) : (
                      <Badge variant="muted">disabled</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">v{p.version}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {formatRelative(p.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dry-run evaluation</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submitEvaluate}>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="eval-item">Catalog item ID</Label>
                <Input
                  id="eval-item"
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eval-version">Version</Label>
                <Input
                  id="eval-version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eval-cluster">Cluster ID</Label>
                <Input
                  id="eval-cluster"
                  value={clusterId}
                  onChange={(e) => setClusterId(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eval-spec">Spec (JSON)</Label>
              <textarea
                id="eval-spec"
                className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                placeholder="{}"
              />
            </div>
            <Button type="submit" disabled={evaluating}>
              {evaluating ? "Evaluating…" : "Evaluate"}
            </Button>
          </form>

          {evalError && (
            <p className="mt-3 text-sm text-destructive">{evalError}</p>
          )}

          {decision && (
            <div className="mt-4 space-y-3 rounded-md border p-4">
              <p className="text-sm font-medium">
                Decision:{" "}
                {decision.allow ? (
                  <Badge variant="success">allow</Badge>
                ) : (
                  <Badge variant="destructive">deny</Badge>
                )}
              </p>
              <ViolationList
                title="Violations"
                items={decision.violations ?? []}
                variant="destructive"
              />
              <ViolationList
                title="Warnings"
                items={decision.warnings ?? []}
                variant="warning"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
