import * as React from "react";
import { Alert, Button, Input, Modal, Radio, Select } from "7k-design-system/react";

import {
  adoptAddon,
  type AddonMutationResult,
  type AddonViewModel,
} from "@/api/addons";
import { getCatalogItem } from "@/api/catalog";
import { ApiError } from "@/api/client";
import { listClusters } from "@/api/clusters";
import { listGitRepos } from "@/api/git-repos";
import { useAsyncResource } from "@/api/hooks";
import { listTeams } from "@/api/tenants";
import type { ClusterSummary } from "@/api/types";
import { useAuth } from "@/auth/auth-context";
import { PolicyDenialNotice } from "@/components/policy-denial";
import {
  ValuesEditor,
  validateValuesText,
} from "@/pages/clusters/addons/values-editor";
import { RepoPicker } from "@/pages/settings/org/git/repo-picker";
import { useTenant } from "@/tenant/tenant-context";

export interface AdoptAddonModalProps {
  addon: AddonViewModel | null;
  onClose: () => void;
  onAdopted: (result: AddonMutationResult) => void;
}

interface SelectorRow {
  key: string;
  value: string;
}

// Decision 8: fleet membership is computed by Inari server-side as an
// equality match of the selector against cluster labels. The preview below
// mirrors that semantics so users see the blast radius before adopting.
export function selectorMatches(
  selector: Record<string, string>,
  cluster: ClusterSummary,
): boolean {
  return Object.entries(selector).every(([k, v]) => cluster.labels[k] === v);
}

// Adopt dialog for discovered addons (Feature C): pick the GitOps repo
// (default = baseline), version, values, and deploy mode — this cluster via
// Application, or fleet-wide via ApplicationSet with a label selector.
export function AdoptAddonModal({ addon, onClose, onAdopted }: AdoptAddonModalProps) {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const [repoId, setRepoId] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState("");
  const [valuesText, setValuesText] = React.useState("{}");
  const [namespace, setNamespace] = React.useState("");
  const [deployMode, setDeployMode] = React.useState<"application" | "applicationset">(
    "application",
  );
  const [selectorRows, setSelectorRows] = React.useState<SelectorRow[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);

  React.useEffect(() => {
    if (addon) {
      setRepoId(null);
      setVersion("");
      setValuesText("{}");
      setNamespace(addon.discovered?.namespace ?? "");
      setDeployMode("application");
      setSelectorRows([]);
      setError(null);
    }
  }, [addon]);

  const repos = useAsyncResource((tok) => listGitRepos(tok, tenant), [tenant]);
  const teams = useAsyncResource((tok) => listTeams(tok, tenant), [tenant]);
  const clusters = useAsyncResource((tok) => listClusters(tok, tenant), [tenant]);
  const item = useAsyncResource(
    (tok) => getCatalogItem(tok, addon!.catalogItem, tenant),
    [addon?.catalogItem, tenant],
    { enabled: addon !== null },
  );

  // Default to the cluster's baseline (the org default repo) once repos load.
  React.useEffect(() => {
    if (repoId === null && repos.data) {
      const def = repos.data.find((r) => r.isDefault) ?? repos.data[0];
      if (def) setRepoId(def.id);
    }
  }, [repos.data, repoId]);

  // Default to the catalog's effective version (latest stable / pin).
  React.useEffect(() => {
    if (!version && item.data?.latestVersion) setVersion(item.data.latestVersion);
  }, [item.data, version]);

  if (!addon) return null;

  const versions = item.data?.versions ?? [];
  const schema = versions.find((v) => v.version === version)?.schema ?? item.data?.schema ?? null;
  const valuesState = validateValuesText(valuesText, schema);

  const selector: Record<string, string> = {};
  for (const row of selectorRows) {
    if (row.key && row.value) selector[row.key] = row.value;
  }
  const activeClusters = (clusters.data ?? []).filter(
    (c) => c.status === "connected" || c.status === "degraded",
  );
  const matchedClusters = activeClusters.filter((c) => selectorMatches(selector, c));
  const fleetEmpty = deployMode === "applicationset" && clusters.data !== null && matchedClusters.length === 0;

  const labelKeys = Array.from(
    new Set((clusters.data ?? []).flatMap((c) => Object.keys(c.labels))),
  ).sort();

  const canSubmit =
    !submitting &&
    repoId !== null &&
    valuesState.errors.length === 0 &&
    valuesState.values !== null &&
    !fleetEmpty;

  const setRow = (i: number, patch: Partial<SelectorRow>) => {
    setSelectorRows((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || valuesState.values === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await adoptAddon(
        token,
        addon.clusterId,
        addon.catalogItem,
        {
          repoId: repoId ?? undefined,
          version: version || undefined,
          values: valuesState.values,
          deployMode,
          ...(deployMode === "applicationset" ? { clusterSelector: selector } : {}),
          ...(namespace ? { namespace } : {}),
        },
        tenant,
      );
      onAdopted(result);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Failed to adopt addon"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} aria-label="Adopt addon into GitOps">
      <div className="decision-modal space-y-4 max-h-[85vh] overflow-y-auto pr-1">
        <div>
          <h2 className="mono-label">ADOPT INTO GITOPS</h2>
          <p className="text-lg font-semibold">{addon.catalogItem}</p>
          {addon.discovered && (
            <p className="text-sm u-muted">
              Discovered release {addon.discovered.releaseName ?? "unknown"}
              {addon.discovered.namespace ? ` in namespace ${addon.discovered.namespace}` : ""}
              {addon.discovered.detectedVersion
                ? ` (detected ${addon.discovered.detectedVersion})`
                : ""}
              . Adoption registers an ArgoCD app over the existing release with prune off.
            </p>
          )}
        </div>
        <form onSubmit={submit} className="space-y-4">
          {repos.data && (
            <RepoPicker
              repos={repos.data}
              teams={(teams.data ?? []).map((t) => ({ id: t.id, displayName: t.displayName }))}
              selectedId={repoId}
              onSelect={setRepoId}
            />
          )}
          <div className="space-y-1.5">
            <label className="form-label" htmlFor="adopt-version">
              Version
            </label>
            <Select
              id="adopt-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            >
              {version && !versions.some((v) => v.version === version) && (
                <option value={version}>{version}</option>
              )}
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  {v.version} ({v.channel})
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="form-label" htmlFor="adopt-namespace">
              Namespace
            </label>
            <Input
              id="adopt-namespace"
              value={namespace}
              onChange={(v) => setNamespace(v)}
              placeholder="e.g. cert-manager"
            />
          </div>
          <div className="space-y-1.5">
            <label className="form-label" htmlFor="adopt-values">
              Values (YAML)
            </label>
            <ValuesEditor
              id="adopt-values"
              value={valuesText}
              schema={schema}
              onChange={setValuesText}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="form-label">Deploy mode</legend>
            <Radio
              id="adopt-mode-app"
              name="deploy-mode"
              label="This cluster (Application)"
              checked={deployMode === "application"}
              onChange={() => setDeployMode("application")}
            />
            <Radio
              id="adopt-mode-appset"
              name="deploy-mode"
              label="Fleet-wide (ApplicationSet)"
              checked={deployMode === "applicationset"}
              onChange={() => setDeployMode("applicationset")}
            />
          </fieldset>
          {deployMode === "applicationset" && (
            <div className="space-y-2">
              <p className="form-label">Cluster selector</p>
              <p className="text-xs u-muted">
                Equality match on cluster labels, evaluated by Inari (not ArgoCD). Empty selector
                targets all clusters in the org.
              </p>
              {selectorRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    id={`adopt-selector-key-${i}`}
                    aria-label={`Selector key ${i + 1}`}
                    value={row.key}
                    onChange={(e) => setRow(i, { key: e.target.value })}
                  >
                    <option value="">label…</option>
                    {labelKeys.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </Select>
                  <Input
                    id={`adopt-selector-value-${i}`}
                    aria-label={`Selector value ${i + 1}`}
                    value={row.value}
                    onChange={(v) => setRow(i, { value: v })}
                    placeholder="value"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectorRows((rows) => rows.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectorRows((rows) => [...rows, { key: "", value: "" }])}
              >
                Add label match
              </Button>
              <p className="text-sm" role="status">
                {clusters.data === null
                  ? "Loading clusters…"
                  : fleetEmpty
                    ? "Matches no active clusters — the server will reject this selector."
                    : `Matches ${matchedClusters.length} cluster${matchedClusters.length === 1 ? "" : "s"}: ${matchedClusters.map((c) => c.name).join(", ")}`}
              </p>
            </div>
          )}
          {error &&
            (error.isPolicyDenial ? (
              <PolicyDenialNotice reason={error.message} remediation={error.remediation} />
            ) : (
              <Alert variant="danger">{error.message}</Alert>
            ))}
          <div className="wizard-actions">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={!canSubmit}>
              {submitting ? "Adopting…" : "Adopt into GitOps"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
