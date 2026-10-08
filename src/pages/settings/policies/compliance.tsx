import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { evaluatePolicies, listPolicies } from "@/api/policies";
import { useAuth } from "@/auth/auth-context";
import type { components } from "@/api/__generated__/schema";
import { Badge } from "7k-design-system/react";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { Input } from "7k-design-system/react";
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
  variant: "danger" | "warning";
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
              <Badge variant="neutral" className="ml-1">
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
          <div className="card-body">
            Failed to load policies: {error.message}
          </div>
        </Card>
      )}

      {!error && loading && !policies && (
        <p className="text-sm text-muted-foreground">Loading policies…</p>
      )}

      {!error && policies && policies.length === 0 && (
        <Card>
          <div className="card-body">
            No policies defined for this organization.
          </div>
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
                      <Badge variant="neutral">disabled</Badge>
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
        <div className="card-header">
          <h2 className="mono-label">Dry-run evaluation</h2>
        </div>
        <div className="card-body">
          <form className="space-y-3" onSubmit={submitEvaluate}>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="form-label" htmlFor="eval-item">Catalog item ID</label>
                <Input
                  id="eval-item"
                  value={itemId}
                  onChange={(v) => setItemId(v)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="form-label" htmlFor="eval-version">Version</label>
                <Input
                  id="eval-version"
                  value={version}
                  onChange={(v) => setVersion(v)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="form-label" htmlFor="eval-cluster">Cluster ID</label>
                <Input
                  id="eval-cluster"
                  value={clusterId}
                  onChange={(v) => setClusterId(v)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="eval-spec">Spec (JSON)</label>
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
                  <Badge variant="danger">deny</Badge>
                )}
              </p>
              <ViolationList
                title="Violations"
                items={decision.violations ?? []}
                variant="danger"
              />
              <ViolationList
                title="Warnings"
                items={decision.warnings ?? []}
                variant="warning"
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
