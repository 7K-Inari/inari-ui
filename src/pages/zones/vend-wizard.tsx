import * as React from "react";
import { useNavigate } from "react-router-dom";

import { createZone } from "@/api/zones";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const REGIONS = ["eu-west-1", "eu-central-1", "us-east-1"] as const;

export function VendZoneWizardPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [orgUnit, setOrgUnit] = React.useState("");
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
        name,
        slug,
        orgUnit,
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
        <h1 className="text-2xl font-semibold tracking-tight">Vend new zone</h1>
        <p className="text-sm text-muted-foreground">
          A zone provisions a dedicated cloud account, trust, an EKS cluster, and platform wiring.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zone details</CardTitle>
          <CardDescription>
            This requests a new tenant zone; provisioning starts once the request is accepted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="zone-name">Name</Label>
              <Input
                id="zone-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="acme-analytics"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zone-slug">Slug</Label>
              <Input
                id="zone-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme-analytics"
                required
              />
              {slugError && <p className="text-xs text-destructive">{slugError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zone-org-unit">Org unit</Label>
              <Input
                id="zone-org-unit"
                value={orgUnit}
                onChange={(e) => setOrgUnit(e.target.value)}
                placeholder="acme-data"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zone-region">Region</Label>
              <select
                id="zone-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zone-tier">Tier</Label>
              <select
                id="zone-tier"
                value="starter"
                disabled
                className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground shadow-sm"
              >
                <option value="starter">starter</option>
              </select>
              <p className="text-xs text-muted-foreground">Starter tier only during M3.</p>
            </div>
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !name || !slug || !orgUnit}>
                {submitting ? "Vending…" : "Vend zone"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
