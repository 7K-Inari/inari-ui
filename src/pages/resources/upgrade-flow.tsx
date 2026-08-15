import * as React from "react";

import { getUpgradeDiff, upgradeResource } from "@/api/resources";
import { useAsyncResource } from "@/api/hooks";
import type { ResourceInstanceDetail } from "@/api/types";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function UpgradeCard({ resource }: { resource: ResourceInstanceDetail }) {
  const { token } = useAuth();
  const [showDiff, setShowDiff] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [upgraded, setUpgraded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const update = resource.updateAvailable;
  const diff = useAsyncResource(
    (t) => getUpgradeDiff(t, resource.id, update!.to),
    [resource.id, update?.to],
    { enabled: showDiff && !!update },
  );

  if (!update) return null;

  if (upgraded) {
    return (
      <Card>
        <CardContent className="py-4 text-sm">
          <Badge variant="success">Upgrade to {update.to} submitted</Badge>{" "}
          <span className="text-muted-foreground">
            Track progress on the deploy status screen.
          </span>
        </CardContent>
      </Card>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await upgradeResource(token, resource.id, update.to);
      setUpgraded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upgrade failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <Badge variant="warning" className="mr-2">
            Update available
          </Badge>
          New version available: {update.from} → {update.to}
        </CardTitle>
        <CardDescription>
          Preview the rendered changes, then upgrade in one click.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDiff((s) => !s)}>
            {showDiff ? "Hide diff" : "Preview upgrade"}
          </Button>
          <Button size="sm" onClick={submit} disabled={submitting}>
            {submitting ? "Upgrading…" : `Upgrade to ${update.to}`}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {showDiff && diff.data && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Current (v{diff.data.from})
              </p>
              <pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                {diff.data.currentManifest}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Upgraded (v{diff.data.to})
              </p>
              <pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                {diff.data.upgradedManifest}
              </pre>
            </div>
          </div>
        )}
        {showDiff && diff.loading && !diff.data && (
          <p className="text-sm text-muted-foreground">Rendering diff…</p>
        )}
      </CardContent>
    </Card>
  );
}
