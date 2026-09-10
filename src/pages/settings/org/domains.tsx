import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { getIdentityProvider, putDomainHints } from "@/api/idp";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CapabilityGate,
  useOrgCapabilities,
} from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

const DOMAIN_PATTERN =
  /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export function OrgDomainsPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { canWriteSettings } = useOrgCapabilities();
  const {
    data: provider,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => getIdentityProvider(t, tenant), [tenant]);

  const [newDomain, setNewDomain] = React.useState("");
  const [actionError, setActionError] = React.useState<string | null>(null);

  const domains = provider?.domainHints ?? [];

  const fail = (err: unknown, fallback: string) => {
    if (err instanceof ApiError && err.status === 409) {
      setActionError(
        `Domain is already claimed by another organization: ${err.message}`,
      );
    } else {
      setActionError(err instanceof ApiError ? err.message : fallback);
    }
  };

  const save = async (next: string[], fallback: string) => {
    setActionError(null);
    try {
      await putDomainHints(token, tenant, next);
      refetch();
      return true;
    } catch (err) {
      fail(err, fallback);
      return false;
    }
  };

  const add = async () => {
    const value = newDomain.trim().toLowerCase();
    if (!DOMAIN_PATTERN.test(value)) {
      setActionError(
        "Enter a valid domain (acme.example) or wildcard (*.acme.example).",
      );
      return;
    }
    if (domains.includes(value)) {
      setActionError(`Domain "${value}" is already listed.`);
      return;
    }
    if (await save([...domains, value], "Failed to add domain")) {
      setNewDomain("");
    }
  };

  const remove = (domain: string) =>
    save(
      domains.filter((d) => d !== domain),
      "Failed to remove domain",
    );

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Domains"
        description="Email domains claimed by this organization. At login, users are routed to the organization SSO provider based on their email domain."
        actions={
          <CapabilityGate
            capability="admin"
            fallback={
              <span className="text-xs text-muted-foreground">
                Read-only (org viewer)
              </span>
            }
          >
            <></>
          </CapabilityGate>
        }
      />

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load domains: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !provider && (
        <p className="text-sm text-muted-foreground">Loading domains…</p>
      )}

      {actionError && (
        <Card>
          <CardContent className="py-3 text-sm text-destructive">
            {actionError}
          </CardContent>
        </Card>
      )}

      {!error && !provider && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No domains claimed. Configure an SSO provider first — claimed
            domains route users to it at login.
          </CardContent>
        </Card>
      )}

      {provider && (
        <>
          {canWriteSettings && (
            <Card>
              <CardContent className="space-y-2 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-domain">Add domain</Label>
                  <div className="flex gap-2">
                    <Input
                      id="new-domain"
                      placeholder="acme.example or *.acme.example"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          add();
                        }
                      }}
                    />
                    <Button onClick={add} disabled={!newDomain.trim()}>
                      Add domain
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Exact domains match one domain; a *. wildcard matches all
                    subdomains. A domain already in use by another organization
                    is rejected.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {domains.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No domains claimed yet. Add a domain so users with matching
                email addresses are routed to this organization&apos;s SSO
                provider at login.
              </CardContent>
            </Card>
          )}

          {domains.length > 0 && (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Domain</th>
                    <th className="px-4 py-2 font-medium">Match</th>
                    <th className="px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map((d) => (
                    <tr key={d} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">{d}</td>
                      <td className="px-4 py-2">
                        {d.startsWith("*.") ? (
                          <Badge variant="secondary">Wildcard</Badge>
                        ) : (
                          <Badge variant="muted">Exact</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <CapabilityGate capability="admin">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(d)}
                          >
                            Remove
                          </Button>
                        </CapabilityGate>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
