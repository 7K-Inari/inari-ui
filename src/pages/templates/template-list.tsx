import { Link } from "react-router-dom";

import { listTemplates } from "@/api/templates";
import { useAsyncResource } from "@/api/hooks";
import { TemplateScopeBadge } from "@/components/templates/template-scope-badge";
import { Badge } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { LoadingState } from "@/components/loading";

export function TemplateListPage() {
  const { tenant } = useTenant();
  const templates = useAsyncResource((token) => listTemplates(token, tenant), [tenant]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header-title">Templates</h1>
        <p className="text-sm u-muted">
          Golden-path scaffolds: repo, pipeline, catalog entry, and tenant RBAC in one flow.
        </p>
      </div>

      {templates.error && (
        <Card>
          <div className="card-body">
            Failed to load templates: {templates.error.message}
          </div>
        </Card>
      )}

      {templates.loading && !templates.data && (
        <LoadingState label="Loading templates…" />
      )}

      {templates.data && templates.data.length === 0 && (
        <Card>
          <div className="card-body">
            No templates published yet.
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(templates.data ?? []).map((template) => (
          <Card key={template.id} className="flex flex-col">
            <div className="card-header">
              <div className="flex items-center justify-between gap-2">
                <h2 className="mono-label">{template.displayName}</h2>
                <span className="text-xs u-muted">v{template.version}</span>
              </div>
              <p className="card-lede">{template.description}</p>
            </div>
            <div className="card-body flex flex-1 flex-col">
              <div className="flex flex-wrap gap-1">
                <TemplateScopeBadge scope={template.scope} />
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="neutral">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="mt-auto flex justify-end pt-3">
                <Link
                  to={tenantLink(tenant, `templates/${template.name}/scaffold`)}
                  className="btn btn-primary btn-sm"
                >
                  Scaffold
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
