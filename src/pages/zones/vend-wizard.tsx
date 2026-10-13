import * as React from "react";
import { useNavigate } from "react-router-dom";

import { createZone } from "@/api/zones";
import { useAuth } from "@/auth/auth-context";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { Input } from "7k-design-system/react";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const REGIONS = ["eu-west-1", "eu-central-1", "us-east-1"] as const;

export function VendZoneWizardPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [slug, setSlug] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [ouId, setOuId] = React.useState("");
  const [managementAccountId, setManagementAccountId] = React.useState("");
  const [region, setRegion] = React.useState<string>(REGIONS[0]);
  const [slugError, setSlugError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!SLUG_PATTERN.test(slug)) {
      setSlugError("Use lowercase letters, numbers, and dashes (e.g. acme-analytics).");
      return;
    }
    setSlugError(null);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const zone = await createZone(token, tenant, {
        slug,
        displayName,
        ouId,
        managementAccountId,
        region,
        tier: "starter",
      });
      navigate(tenantLink(tenant, `tenant-zones/${zone.id}`));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to vend zone");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="page-header-title">Vend new zone</h1>
        <p className="text-sm u-muted">
          A zone provisions a dedicated cloud account, trust, an EKS cluster, and platform wiring.
        </p>
      </div>

      <Card>
        <div className="card-header">
          <h2 className="mono-label">Zone details</h2>
          <p className="card-lede">
            This requests a new tenant zone; provisioning starts once the request is accepted.
          </p>
        </div>
        <div className="card-body">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="zone-name">Name</label>
              <Input
                id="zone-name"
                value={displayName}
                onChange={(v) => setDisplayName(v)}
                placeholder="acme-analytics"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="zone-slug">Slug</label>
              <Input
                id="zone-slug"
                value={slug}
                onChange={(v) => setSlug(v)}
                placeholder="acme-analytics"
                required
              />
              {slugError && <p className="text-xs u-danger">{slugError}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="zone-org-unit">Org unit</label>
              <Input
                id="zone-org-unit"
                value={ouId}
                onChange={(v) => setOuId(v)}
                placeholder="acme-data"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="zone-management-account">Management account ID</label>
              <Input
                id="zone-management-account"
                value={managementAccountId}
                onChange={(v) => setManagementAccountId(v)}
                placeholder="ma-platform-prod"
                required
              />
              <p className="text-xs u-muted">
                The platform management account the new cloud account is vended under.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="zone-region">Region</label>
              <select
                id="zone-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="input"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="zone-tier">Tier</label>
              <select
                id="zone-tier"
                value="starter"
                disabled
                className="input u-muted"
              >
                <option value="starter">starter</option>
              </select>
              <p className="text-xs u-muted">Starter tier only during M3.</p>
            </div>
            {submitError && <p className="text-sm u-danger">{submitError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !displayName || !slug || !ouId || !managementAccountId}
              >
                {submitting ? "Vending…" : "Vend zone"}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
