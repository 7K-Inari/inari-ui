import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  assignPolicyPack,
  createPolicyPack,
  listPolicyPacks,
  unassignPolicyPack,
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

type PolicyPack = components["schemas"]["PolicyPack"];
type PolicyAssignment = components["schemas"]["PolicyAssignment"];

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function PolicyPacksPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { canWriteSettings } = useOrgCapabilities();
  const {
    data: packs,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listPolicyPacks(t, tenant), [tenant]);

  const [showCreate, setShowCreate] = React.useState(false);
  const [assigningPackId, setAssigningPackId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [assignments, setAssignments] = React.useState<PolicyAssignment[]>([]);

  const [name, setName] = React.useState("");
  const [engine, setEngine] = React.useState("kyverno");
  const [version, setVersion] = React.useState("");
  const [ociRef, setOciRef] = React.useState("");
  const [manifests, setManifests] = React.useState("");

  const [targetType, setTargetType] = React.useState("clusterset");
  const [targetId, setTargetId] = React.useState("");

  const fail = (err: unknown, fallback: string) =>
    setActionError(err instanceof ApiError ? err.message : fallback);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    let parsedManifests: unknown;
    try {
      parsedManifests = manifests.trim() ? JSON.parse(manifests) : [];
    } catch {
      setActionError("Manifests must be valid JSON.");
      return;
    }
    try {
      await createPolicyPack(token, tenant, {
        name,
        engine,
        version,
        ociRef: ociRef || undefined,
        manifests: parsedManifests,
      });
      setShowCreate(false);
      setName("");
      setVersion("");
      setOciRef("");
      setManifests("");
      refetch();
    } catch (err) {
      fail(err, "Failed to create policy pack");
    }
  };

  const submitAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningPackId) return;
    setActionError(null);
    try {
      const assignment = await assignPolicyPack(token, tenant, assigningPackId, {
        targetType,
        targetId,
      });
      setAssignments((prev) => [...prev, assignment]);
      setAssigningPackId(null);
      setTargetId("");
    } catch (err) {
      fail(err, "Failed to assign policy pack");
    }
  };

  const removeAssignment = async (assignment: PolicyAssignment) => {
    if (!window.confirm(`Remove assignment of this pack to ${assignment.targetType} "${assignment.targetId}"?`)) {
      return;
    }
    setActionError(null);
    try {
      await unassignPolicyPack(token, tenant, assignment.packId, assignment.id);
      setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
    } catch (err) {
      fail(err, "Failed to remove assignment");
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Policy packs"
        description="Kyverno / CEL-VAP policy packs available to this organization (org and platform-global)."
        actions={
          <CapabilityGate
            capability="admin"
            fallback={
              <span className="text-xs text-muted-foreground">Read-only (org viewer)</span>
            }
          >
            <Button onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? "Cancel" : "New pack"}
            </Button>
          </CapabilityGate>
        }
      />

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load policy packs: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !packs && (
        <p className="text-sm text-muted-foreground">Loading policy packs…</p>
      )}

      {actionError && (
        <Card>
          <CardContent className="py-3 text-sm text-destructive">{actionError}</CardContent>
        </Card>
      )}

      {showCreate && canWriteSettings && (
        <Card>
          <CardContent className="py-4">
            <form className="space-y-3" onSubmit={submitCreate}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pack-name">Name</Label>
                  <Input
                    id="pack-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pack-version">Version</Label>
                  <Input
                    id="pack-version"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pack-engine">Engine</Label>
                  <select
                    id="pack-engine"
                    className={selectClass}
                    value={engine}
                    onChange={(e) => setEngine(e.target.value)}
                  >
                    <option value="kyverno">kyverno</option>
                    <option value="cel-vap">cel-vap</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pack-oci">OCI reference (optional)</Label>
                  <Input
                    id="pack-oci"
                    value={ociRef}
                    onChange={(e) => setOciRef(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pack-manifests">Manifests (JSON)</Label>
                <textarea
                  id="pack-manifests"
                  className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
                  value={manifests}
                  onChange={(e) => setManifests(e.target.value)}
                  placeholder="[]"
                />
              </div>
              <Button type="submit">Create pack</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {!error && packs && packs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No policy packs available yet.
          </CardContent>
        </Card>
      )}

      {packs && packs.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Engine</th>
                <th className="px-4 py-2 font-medium">Version</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((pack: PolicyPack) => (
                <React.Fragment key={pack.id}>
                  <tr className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{pack.name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{pack.engine}</td>
                    <td className="px-4 py-2 font-mono text-xs">{pack.version}</td>
                    <td className="px-4 py-2">
                      {pack.orgId ? (
                        <Badge variant="secondary">Org</Badge>
                      ) : (
                        <Badge variant="muted">Platform</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {formatRelative(pack.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      <CapabilityGate capability="admin">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setAssigningPackId((cur) =>
                              cur === pack.id ? null : pack.id,
                            )
                          }
                        >
                          Assign
                        </Button>
                      </CapabilityGate>
                    </td>
                  </tr>
                  {assigningPackId === pack.id && (
                    <tr className="border-t bg-muted/20">
                      <td colSpan={6} className="px-4 py-3">
                        <form
                          className="flex flex-wrap items-end gap-3"
                          onSubmit={submitAssign}
                        >
                          <div className="space-y-1.5">
                            <Label htmlFor={`assign-type-${pack.id}`}>Target type</Label>
                            <select
                              id={`assign-type-${pack.id}`}
                              className={selectClass}
                              value={targetType}
                              onChange={(e) => setTargetType(e.target.value)}
                            >
                              <option value="clusterset">clusterset</option>
                              <option value="tenant">tenant</option>
                              <option value="cluster">cluster</option>
                            </select>
                          </div>
                          <div className="min-w-56 flex-1 space-y-1.5">
                            <Label htmlFor={`assign-target-${pack.id}`}>Target ID</Label>
                            <Input
                              id={`assign-target-${pack.id}`}
                              value={targetId}
                              onChange={(e) => setTargetId(e.target.value)}
                              required
                            />
                          </div>
                          <Button type="submit" size="sm">
                            Assign pack
                          </Button>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignments.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Assignments (this session)</h2>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Pack</th>
                  <th className="px-4 py-2 font-medium">Target</th>
                  <th className="px-4 py-2 font-medium">State</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{a.packId}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {a.targetType}/{a.targetId}
                    </td>
                    <td className="px-4 py-2">{a.state}</td>
                    <td className="px-4 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAssignment(a)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
