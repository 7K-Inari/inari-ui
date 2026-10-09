import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getCatalogItem } from "@/api/catalog";
import {
  deleteResource,
  getResource,
  rollbackResource,
  updateResourceSpec,
} from "@/api/resources";
import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import type { CatalogItemDetail, ResourceInstanceDetail } from "@/api/types";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "7k-design-system/react";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { SchemaForm, type SchemaFormHandle } from "@/components/schema-form/schema-form";
import { applyHintsToSchema, hintsToUiSchema } from "@/components/schema-form/ui-hints";
import { InstanceActionButtons } from "@/ext/slots";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { HealthBadge } from "@/pages/resources/resource-list";
import { UpgradeCard } from "@/pages/resources/upgrade-flow";

function ActionsMenu({ resource }: { resource: ResourceInstanceDetail }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen((o) => !o)}>
        Actions
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-64 menu p-2 text-sm">
          <InstanceActionButtons instance={resource} />
        </div>
      )}
    </div>
  );
}

// Loose semver-ish compare for "x.y.z" catalog versions (negative = a < b).
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((p) => parseInt(p, 10) || 0);
  const pb = b.split(".").map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function EditSpecCard({
  resource,
  item,
  onUpdated,
}: {
  resource: ResourceInstanceDetail;
  item: CatalogItemDetail;
  onUpdated: () => void;
}) {
  const { token } = useAuth();
  const formRef = React.useRef<SchemaFormHandle>(null);
  const [formData, setFormData] = React.useState<Record<string, unknown>>(resource.spec);
  const [submitting, setSubmitting] = React.useState(false);
  const [updated, setUpdated] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current?.validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await updateResourceSpec(token, resource.id, formData);
      if (res.phase === "pending") {
        setError("Spec update is gated on approval — track it in the Approvals inbox.");
      } else {
        setUpdated(true);
        onUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Spec update failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <div className="card-header">
        <h2 className="mono-label">Edit spec</h2>
        <p className="card-lede">
          Changes re-render the instance at its current version (v{resource.version}).
        </p>
      </div>
      <div className="card-body">
        {updated ? (
          <p className="text-sm">
            <Badge variant="success">Spec update submitted</Badge>{" "}
            <span className="u-muted">The instance re-renders shortly.</span>
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <SchemaForm
              ref={formRef}
              schema={applyHintsToSchema(item.schema, item.uiHints)}
              uiSchema={hintsToUiSchema(item.uiHints)}
              formData={formData}
              onChange={setFormData}
              disabled={submitting}
            />
            {error && <p className="text-sm u-danger">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save spec"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

function RollbackCard({
  resource,
  item,
  onRolledBack,
}: {
  resource: ResourceInstanceDetail;
  item: CatalogItemDetail;
  onRolledBack: () => void;
}) {
  const { token } = useAuth();
  const older = item.versions
    .map((v) => v.version)
    .filter((v) => compareVersions(v, resource.version) < 0)
    .sort(compareVersions)
    .reverse();
  const [target, setTarget] = React.useState(older[0] ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await rollbackResource(token, resource.id, target);
      if (res.phase === "pending") {
        setError("Rollback is gated on approval — track it in the Approvals inbox.");
      } else {
        setDone(true);
        onRolledBack();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Card>
        <div className="card-body">
          <Badge variant="success">Rollback to {target} submitted</Badge>{" "}
          <span className="u-muted">
            The instance re-renders at v{target} shortly.
          </span>
        </div>
      </Card>
    );
  }

  if (older.length === 0) return null;

  return (
    <Card>
      <div className="card-header">
        <h2 className="mono-label">Rollback</h2>
        <p className="card-lede">
          Re-deploy this instance at an earlier catalog version (current: v{resource.version}).
        </p>
      </div>
      <div className="card-body">
        <div className="flex items-center gap-2">
          <select
            aria-label="Target version"
            className="h-9 rounded-md border u-base px-3 text-sm"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            {older.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={submit} disabled={submitting || !target}>
            {submitting ? "Rolling back…" : `Rollback to ${target}`}
          </Button>
        </div>
        {error && <p className="text-sm u-danger">{error}</p>}
      </div>
    </Card>
  );
}

function DeleteCard({ resource }: { resource: ResourceInstanceDetail }) {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = React.useState(false);
  const [pendingApproval, setPendingApproval] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await deleteResource(token, resource.id, tenant);
      if (res.phase === "pending") {
        setPendingApproval(true);
      } else {
        navigate(tenantLink(tenant, "deploys"));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete resource");
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingApproval) {
    return (
      <Card>
        <div className="card-body">
          Undeploy requested. Deletion is gated on approval — once approved, the instance is
          removed automatically. Track it in the{" "}
          <Link to={tenantLink(tenant, "approvals")} className="underline">
            Approvals inbox
          </Link>
          .
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="card-header">
        <h2 className="mono-label">Delete</h2>
        <p className="card-lede">
          Undeploys this instance: its desired state is removed from the tenant state repo and
          the backing application is deleted. This cannot be undone.
        </p>
      </div>
      <div className="card-body">
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-sm u-danger">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" variant="danger" disabled={submitting}>
              {submitting ? "Deleting…" : "Delete resource"}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

export function ResourceDetailPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const {
    data: resource,
    loading,
    error,
    refetch,
  } = useAsyncResource((token) => getResource(token, instanceId!), [instanceId], {
    refetchIntervalMs: 15_000,
  });
  const catalogItem = useAsyncResource(
    (token) => getCatalogItem(token, resource!.catalogItemId),
    [resource?.catalogItemId],
    { enabled: !!resource },
  );

  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <Card>
        <div className="card-body">
          {notFound ? "Resource not found." : `Failed to load resource: ${error.message}`}
        </div>
      </Card>
    );
  }

  if (loading || !resource) {
    return <p className="text-sm u-muted">Loading resource…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-header-title">{resource.name}</h1>
            <HealthBadge health={resource.health} />
            <Badge variant="neutral">{resource.status}</Badge>
          </div>
          <p className="text-sm u-muted">
            {resource.catalogItemName} v{resource.version} · cluster {resource.clusterId} · owned by{" "}
            {resource.ownerTeam}
          </p>
        </div>
        <ActionsMenu resource={resource} />
      </div>

      <UpgradeCard resource={resource} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="card-header">
            <h2 className="mono-label">Spec</h2>
          </div>
          <div className="card-body">
            <pre className="max-h-96 overflow-auto rounded-md u-raised p-3 font-mono text-xs">
              {JSON.stringify(resource.spec, null, 2)}
            </pre>
          </div>
        </Card>
        {catalogItem.data && (
          <EditSpecCard resource={resource} item={catalogItem.data} onUpdated={refetch} />
        )}
      </div>

      {catalogItem.data && (
        <RollbackCard resource={resource} item={catalogItem.data} onRolledBack={refetch} />
      )}

      <DeleteCard resource={resource} />
    </div>
  );
}
