import * as React from "react";
import YAML from "yaml";
import { Alert, Badge, Button, Drawer, Select } from "7k-design-system/react";

import { updateAddon, type AddonMutationResult, type AddonViewModel } from "@/api/addons";
import { getCatalogItem } from "@/api/catalog";
import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { PolicyDenialNotice } from "@/components/policy-denial";
import {
  ValuesEditor,
  validateValuesText,
} from "@/pages/clusters/addons/values-editor";
import { useTenant } from "@/tenant/tenant-context";

export interface EditAddonDrawerProps {
  addon: AddonViewModel | null;
  onClose: () => void;
  onSaved: (result: AddonMutationResult) => void;
}

// Edit drawer for managed addons (Feature C): version dropdown from the
// catalog's available versions and a YAML values editor validated against
// the selected version's values.schema.json. Deploy mode is fixed at adopt
// time and shown read-only. Save → PATCH; PR-policy repos return prUrl.
export function EditAddonDrawer({ addon, onClose, onSaved }: EditAddonDrawerProps) {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const [version, setVersion] = React.useState("");
  const [valuesText, setValuesText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);

  React.useEffect(() => {
    if (addon) {
      setVersion(addon.chartVersion ?? "");
      setValuesText(YAML.stringify(addon.values));
      setError(null);
    }
  }, [addon]);

  // The item detail carries per-version schemas for values validation.
  const { data: item } = useAsyncResource(
    (tok) => getCatalogItem(tok, addon!.catalogItem, tenant),
    [addon?.catalogItem, tenant],
    { enabled: addon !== null },
  );

  const versions = addon?.availableVersions.length
    ? addon.availableVersions
    : (item?.versions.map((v) => v.version) ?? []);
  const schema =
    item?.versions.find((v) => v.version === version)?.schema ?? item?.schema ?? null;
  const valuesState = validateValuesText(valuesText, schema);
  // Decision 4: warn when stored values fail the newly selected version's
  // schema before anything is committed.
  const incompatible =
    version !== (addon?.chartVersion ?? "") && valuesState.errors.length > 0;

  if (!addon) return null;

  const versionChanged = version !== (addon.chartVersion ?? "");
  const valuesChanged = valuesState.values !== null && valuesText !== YAML.stringify(addon.values);
  const canSave =
    !saving && valuesState.errors.length === 0 && (versionChanged || valuesChanged);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || valuesState.values === null) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateAddon(
        token,
        addon.id,
        {
          ...(versionChanged ? { chartVersion: version } : {}),
          ...(valuesChanged ? { values: valuesState.values } : {}),
        },
        tenant,
      );
      onSaved(result);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Failed to update addon"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open onClose={onClose} side="right" aria-label="Edit addon">
      <div className="drawer-header">
        <p className="mono-label">EDIT ADDON</p>
        <h2 className="text-xl font-semibold">{addon.catalogItem}</h2>
        <p className="font-mono text-sm u-muted">{addon.argocdApp ?? addon.repoPath ?? ""}</p>
      </div>
      <div className="drawer-body">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="form-label" htmlFor="addon-version">
              Version
            </label>
            <Select
              id="addon-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            >
              {version && !versions.includes(version) && (
                <option value={version}>{version} (current)</option>
              )}
              {versions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="form-label" htmlFor="addon-values">
              Values (YAML)
            </label>
            <ValuesEditor
              id="addon-values"
              value={valuesText}
              schema={schema}
              onChange={setValuesText}
            />
            {incompatible && (
              <Alert variant="warning">
                The stored values fail validation against version {version}&apos;s schema. Fix
                them before saving.
              </Alert>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="form-label">Deploy mode</p>
            <p className="text-sm u-muted">
              {addon.deployMode === "applicationset" ? (
                <>
                  <Badge variant="info">ApplicationSet</Badge> fleet-wide
                  {Object.keys(addon.clusterSelector).length > 0 &&
                    ` matching ${Object.entries(addon.clusterSelector)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(", ")}`}
                </>
              ) : (
                <>
                  <Badge variant="neutral">Application</Badge> this cluster only
                </>
              )}
              {" — "}deploy mode is fixed at adopt time.
            </p>
          </div>
          {error &&
            (error.isPolicyDenial ? (
              <PolicyDenialNotice reason={error.message} remediation={error.remediation} />
            ) : (
              <Alert variant="danger">{error.message}</Alert>
            ))}
          <Button type="submit" variant="accent" disabled={!canSave}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </form>
      </div>
    </Drawer>
  );
}
