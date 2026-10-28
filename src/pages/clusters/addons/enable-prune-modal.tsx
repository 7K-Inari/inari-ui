import * as React from "react";
import { Alert, Button, Modal } from "7k-design-system/react";

import { enableAddonPrune, type AddonMutationResult, type AddonViewModel } from "@/api/addons";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { useTenant } from "@/tenant/tenant-context";

export interface EnablePruneModalProps {
  addon: AddonViewModel | null;
  onClose: () => void;
  onEnabled: (result: AddonMutationResult) => void;
}

// Decision 2: prune is only ever enabled by an explicit human action, and
// the confirmation spells out what prune would delete. There is no server
// dry-run endpoint, so the list is derived from the addon row: the ArgoCD
// app, repo path, namespace, and source that bound the managed resources.
export function EnablePruneModal({ addon, onClose, onEnabled }: EnablePruneModalProps) {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (addon) setError(null);
  }, [addon]);

  if (!addon) return null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await enableAddonPrune(token, addon.id, tenant);
      onEnabled(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to enable prune");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} aria-label="Enable prune">
      <div className="decision-modal space-y-4">
        <div>
          <h2 className="mono-label">ENABLE PRUNE</h2>
          <p className="text-lg font-semibold">{addon.catalogItem}</p>
        </div>
        <p className="text-sm">
          With prune enabled, ArgoCD deletes any live resources that are no longer part of the
          rendered manifests for this addon. For {addon.catalogItem} that means resources managed
          by:
        </p>
        <ul className="text-sm list-disc pl-5 space-y-1">
          {addon.argocdApp && (
            <li>
              ArgoCD {addon.deployMode === "applicationset" ? "ApplicationSet" : "Application"}{" "}
              <span className="font-mono">{addon.argocdApp}</span>
              {addon.isFleet &&
                Object.keys(addon.clusterSelector).length > 0 &&
                ` (clusters matching ${Object.entries(addon.clusterSelector)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")})`}
            </li>
          )}
          {addon.repoPath && (
            <li>
              rendered manifests at <span className="font-mono">{addon.repoPath}</span> in the
              addon&apos;s GitOps repo
            </li>
          )}
          {addon.namespace && (
            <li>
              deployed into namespace <span className="font-mono">{addon.namespace}</span>
            </li>
          )}
          {addon.helm && (
            <li>
              helm chart <span className="font-mono">{addon.helm.chart}</span> from{" "}
              <span className="font-mono">{addon.helm.repoUrl}</span>
            </li>
          )}
        </ul>
        <Alert variant="warning">
          Resources removed from the git-rendered manifests (for example by a values change) will
          be deleted from the cluster on the next sync. This cannot be undone by ArgoCD.
        </Alert>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="wizard-actions">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Enabling…" : "Enable prune"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
