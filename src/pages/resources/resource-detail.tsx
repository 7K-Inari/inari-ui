import * as React from "react";
import { useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";

import { getResource } from "@/api/resources";
import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HealthBadge } from "@/pages/resources/resource-list";
import { UpgradeCard } from "@/pages/resources/upgrade-flow";

function ActionsMenu() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen((o) => !o)}>
        Actions
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-64 rounded-md border bg-popover p-2 text-sm text-muted-foreground shadow-md">
          Extension actions will appear here (ArgoCD sync, rollback, custom actions).
        </div>
      )}
    </div>
  );
}

export function ResourceDetailPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const { data: resource, loading, error } = useAsyncResource(
    (token) => getResource(token, instanceId!),
    [instanceId],
    { refetchIntervalMs: 15_000 },
  );

  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {notFound ? "Resource not found." : `Failed to load resource: ${error.message}`}
        </CardContent>
      </Card>
    );
  }

  if (loading || !resource) {
    return <p className="text-sm text-muted-foreground">Loading resource…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{resource.name}</h1>
            <HealthBadge health={resource.health} />
            <Badge variant="muted">{resource.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {resource.catalogItemName} v{resource.version} · {resource.clusterName} · owned by{" "}
            {resource.ownerTeam}
          </p>
        </div>
        <div className="flex gap-2">
          {resource.argocdUrl && (
            <Button asChild variant="outline">
              <a href={resource.argocdUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1" /> Open in ArgoCD
              </a>
            </Button>
          )}
          <ActionsMenu />
        </div>
      </div>

      <UpgradeCard resource={resource} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Composed resources</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {resource.composedResources.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                No composed resources reported yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Kind</th>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Namespace</th>
                    <th className="px-4 py-2 font-medium">Health</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.composedResources.map((c) => (
                    <tr key={`${c.kind}/${c.name}`} className="border-b last:border-0">
                      <td className="px-4 py-2">{c.kind}</td>
                      <td className="px-4 py-2">{c.name}</td>
                      <td className="px-4 py-2">{c.namespace}</td>
                      <td className="px-4 py-2">
                        <HealthBadge health={c.health} />
                      </td>
                      <td className="px-4 py-2">{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spec</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
              {JSON.stringify(resource.spec, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
