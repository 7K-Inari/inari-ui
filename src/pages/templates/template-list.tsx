import { Link } from "react-router-dom";

import { listTemplates } from "@/api/templates";
import { useAsyncResource } from "@/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

export function TemplateListPage() {
  const { tenant } = useTenant();
  const templates = useAsyncResource((token) => listTemplates(token, tenant), [tenant]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="text-sm text-muted-foreground">
          Golden-path scaffolds: repo, pipeline, catalog entry, and tenant RBAC in one flow.
        </p>
      </div>

      {templates.error && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            Failed to load templates: {templates.error.message}
          </CardContent>
        </Card>
      )}

      {templates.loading && !templates.data && (
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      )}

      {templates.data && templates.data.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No templates published yet.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(templates.data ?? []).map((template) => (
          <Card key={template.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{template.displayName}</CardTitle>
                <span className="text-xs text-muted-foreground">v{template.version}</span>
              </div>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex items-center justify-between gap-2 pt-0">
              <div className="flex flex-wrap gap-1">
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="muted">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Button asChild size="sm">
                <Link to={tenantLink(tenant, `templates/${template.id}/scaffold`)}>
                  Scaffold
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
