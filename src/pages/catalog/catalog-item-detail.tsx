import * as React from "react";
import { Link, useParams } from "react-router-dom";

import { getCatalogItem } from "@/api/catalog";
import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { Alert, Card, Skeleton } from "7k-design-system/react";

import { PageHeader } from "@/components/page-header";
import { SchemaForm } from "@/components/schema-form/schema-form";
import { TemplateScopeBadge } from "@/components/templates/template-scope-badge";
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
      <Alert variant="danger">
        {notFound ? "Catalog item not found." : `Failed to load catalog item: ${error.message}`}
      </Alert>
    );
  }

  if (loading || !item) {
    return (
      <div className="overview-card-skeleton" aria-busy="true">
        <Skeleton height={32} width="40%" />
        <Skeleton height={200} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb="Deliver / Catalog"
        title={item.displayName}
        lede={item.description}
        actions={
          pinned ? (
            <Link
              to={`${tenantLink(tenant, `catalog/${item.id}/deploy`)}?version=${encodeURIComponent(pinned)}`}
              className="btn btn-glow-accent"
            >
              Deploy
            </Link>
          ) : (
            <button type="button" className="btn btn-glow-accent" disabled>
              Deploy
            </button>
          )
        }
      />
      <div className="catalog-detail-tags">
        <span className="tag">{item.source}</span>
        {item.scope && <TemplateScopeBadge scope={item.scope} />}
        {item.approvalPolicy !== "auto" && <span className="badge badge-warning">Approval required</span>}
      </div>

      <div className="catalog-detail-grid">
        <Card>
          <div className="card-header">
            <span className="mono-label">Schema preview</span>
          </div>
          <div className="card-body">
            {schema && (
              <SchemaForm
                schema={schema}
                uiSchema={uiSchema}
                formData={{}}
                onChange={() => undefined}
                disabled
              />
            )}
          </div>
        </Card>

        <Card>
          <div className="card-header">
            <span className="mono-label">Versions</span>
          </div>
          <div className="card-body wizard-body">
            {item.versions.length === 0 ? (
              <div className="empty">No versions published yet.</div>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="catalog-version" className="form-label">
                    Version
                  </label>
                  <select
                    id="catalog-version"
                    className="select-native"
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
                <ul className="list">
                  {item.versions.map((v) => (
                    <li key={v.version} className="list-item overview-count-row">
                      <span className={`mono-data${v.version === pinned ? " overview-stat-accent" : ""}`}>
                        {v.version}
                      </span>
                      <span className="tag">{v.channel}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
