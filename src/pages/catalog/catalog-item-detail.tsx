import * as React from "react";
import { Link, useParams } from "react-router-dom";

import { getCatalogItem } from "@/api/catalog";
import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SchemaForm } from "@/components/schema-form/schema-form";
import { applyHintsToSchema, hintsToUiSchema } from "@/components/schema-form/ui-hints";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

export function CatalogItemDetailPage() {
  const { tenant } = useTenant();
  const { itemId } = useParams<{ itemId: string }>();
  const [version, setVersion] = React.useState<string | null>(null);

  const { data: item, loading, error } = useAsyncResource(
    (token) => getCatalogItem(token, itemId!),
    [itemId],
  );

  const pinned = version ?? item?.latestVersion ?? "";
  const schema = React.useMemo(
    () => (item ? applyHintsToSchema(item.schema, item.uiHints) : null),
    [item],
  );
  const uiSchema = React.useMemo(() => (item ? hintsToUiSchema(item.uiHints) : {}), [item]);

  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {notFound ? "Catalog item not found." : `Failed to load catalog item: ${error.message}`}
        </CardContent>
      </Card>
    );
  }

  if (loading || !item) {
    return <p className="text-sm text-muted-foreground">Loading catalog item…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{item.displayName}</h1>
            <Badge variant="secondary">{item.source}</Badge>
            <Badge variant="muted">{item.category}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{item.description}</p>
        </div>
        <Button asChild>
          <Link
            to={`${tenantLink(tenant, `catalog/${item.id}/deploy`)}?version=${encodeURIComponent(pinned)}`}
          >
            Deploy
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documentation</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap font-sans text-sm">{item.docs}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Schema preview</CardTitle>
            </CardHeader>
            <CardContent>
              {schema && (
                <SchemaForm
                  schema={schema}
                  uiSchema={uiSchema}
                  formData={{}}
                  onChange={() => undefined}
                  disabled
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Versions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="catalog-version">Version</Label>
                <select
                  id="catalog-version"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={pinned}
                  onChange={(e) => setVersion(e.target.value)}
                >
                  {item.versions.map((v) => (
                    <option key={v.version} value={v.version}>
                      {v.version}
                    </option>
                  ))}
                </select>
              </div>
              <ul className="space-y-1 text-sm">
                {item.versions.map((v) => (
                  <li key={v.version} className="flex items-center gap-2">
                    <span className={v.version === pinned ? "font-medium" : ""}>
                      {v.version}
                    </span>
                    <Badge variant="muted">{v.channel}</Badge>
                    {v.deprecated && <Badge variant="destructive">deprecated</Badge>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                GitOps mode:{" "}
                {item.policy.gitopsMode === "pull-request" ? "pull request" : "direct commit"}
              </p>
              {item.policy.approvalRequired && (
                <p>
                  <Badge variant="warning">Approval required</Badge>
                </p>
              )}
              {item.policy.lockedFields.length > 0 && (
                <div>
                  <p className="font-medium">Locked fields</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {item.policy.lockedFields.map((f) => (
                      <li key={f.path}>
                        <code>{f.path}</code>
                        {f.reason ? ` — ${f.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {item.policy.notes.map((n, i) => (
                <p key={i} className="text-muted-foreground">
                  {n}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
