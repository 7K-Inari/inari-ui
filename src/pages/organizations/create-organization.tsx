import * as React from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "@/api/client";
import { createTenant } from "@/api/tenants";
import { useAuth } from "@/auth/auth-context";
import { keycloak } from "@/auth/keycloak";
import { usePermissions } from "@/auth/permissions-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function CreateOrganizationPage() {
  const { token } = useAuth();
  const { canCreateOrganizations } = usePermissions();
  const navigate = useNavigate();

  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugError, setSlugError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  if (!canCreateOrganizations) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Not authorized</CardTitle>
            <CardDescription>
              You are not authorized to create organizations. Contact a platform
              administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!SLUG_PATTERN.test(slug)) {
      setSlugError("Use lowercase letters, numbers, and dashes (e.g. acme-analytics).");
      return;
    }
    const displayName = name.trim();
    if (!displayName) return;
    setSlugError(null);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const tenant = await createTenant(token, { slug, name: displayName });
      // Best-effort: the organization claim only lists the new org after the
      // token refreshes; navigation still lands safely via the all-tenants
      // fallback if the claim lags behind.
      await keycloak.updateToken(-1).catch(() => false);
      navigate(`/${tenant.slug}/overview`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSlugError(err.message);
      } else {
        setSubmitError(err instanceof Error ? err.message : "Failed to create organization");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create organization</h1>
          <p className="text-sm text-muted-foreground">
            A new organization provisions a Keycloak realm, DNS zone, and tenant
            namespaces on the platform cluster.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Organization details</CardTitle>
            <CardDescription>
              The slug is the organization's immutable identifier used in URLs and API
              paths.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Display name</Label>
                <Input
                  id="org-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Analytics"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-slug">Slug</Label>
                <Input
                  id="org-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="acme-analytics"
                  required
                />
                {slugError && <p className="text-xs text-destructive">{slugError}</p>}
              </div>
              {submitError && <p className="text-sm text-destructive">{submitError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" type="button" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !name.trim() || !slug}>
                  {submitting ? "Creating…" : "Create organization"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
