import * as React from "react";
import { useParams } from "react-router-dom";

import { getResource } from "@/api/resources";
import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import type { ResourceInstanceDetail } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InstanceActionButtons } from "@/ext/slots";
import { HealthBadge } from "@/pages/resources/resource-list";
import { UpgradeCard } from "@/pages/resources/upgrade-flow";

function ActionsMenu({ resource }: { resource: ResourceInstanceDetail }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen((o) => !o)}>
        Actions
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-64 rounded-md border bg-popover p-2 text-sm shadow-md">
          <InstanceActionButtons instance={resource} />
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
            {resource.catalogItemName} v{resource.version} · cluster {resource.clusterId} · owned by{" "}
            {resource.ownerTeam}
          </p>
        </div>
        <ActionsMenu resource={resource} />
      </div>

      <UpgradeCard resource={resource} />

      <div className="grid gap-6 lg:grid-cols-2">
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
