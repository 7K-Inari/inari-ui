import { Download } from "lucide-react";
import * as React from "react";

import type { paths } from "@/api/__generated__/schema";
import { exportAuditEvents, listAuditEvents } from "@/api/audit";
import type { AuditEvent, AuditFilters } from "@/api/audit";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Badge, Button, Card, DataTable, Input } from "7k-design-system/react";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { LoadingState } from "@/components/loading";

type AuditListQuery = paths["/api/v1/tenants/{org}/audit"]["get"]["parameters"]["query"];

const EMPTY_FILTERS: AuditFilters = {};
const PAGE_SIZE: NonNullable<NonNullable<AuditListQuery>["limit"]> = 50;

export function AuditLogPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const [draft, setDraft] = React.useState<AuditFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = React.useState<AuditFilters>(EMPTY_FILTERS);
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(0);

  const { data: events, loading, error } = useAsyncResource(
    (t) => listAuditEvents(t, tenant, filters),
    [tenant, filters],
  );

  function apply() {
    setPage(0);
    setFilters({ ...draft });
  }

  function reset() {
    setPage(0);
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  }

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const csv = await exportAuditEvents(token, tenant, filters);
      if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return;
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `audit-${tenant}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL?.(url), 1000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const items = events ?? [];
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = items.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header-title">Audit log</h1>
          <p className="text-sm u-muted">
            Every control-plane action for this tenant.
          </p>
        </div>
        <Button variant="secondary" size="sm" disabled={exporting} onClick={() => void exportCsv()}>
          <Download aria-hidden />
          Export CSV
        </Button>
      </div>

      {exportError && <p className="text-sm u-danger">{exportError}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="form-label" htmlFor="audit-actor">Actor</label>
          <Input
            id="audit-actor"
            value={draft.actor ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, actor: v }))}
            placeholder="jane@acme.example"
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <label className="form-label" htmlFor="audit-action">Action</label>
          <Input
            id="audit-action"
            value={draft.action ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, action: v }))}
            placeholder="deploy.create"
            className="w-48 font-mono"
          />
        </div>
        <div className="space-y-1">
          <label className="form-label" htmlFor="audit-object-type">Object type</label>
          <Input
            id="audit-object-type"
            value={draft.objectType ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, objectType: v }))}
            placeholder="instance"
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <label className="form-label" htmlFor="audit-from">From</label>
          <Input
            id="audit-from"
            type="datetime-local"
            value={draft.from ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, from: v }))}
          />
        </div>
        <div className="space-y-1">
          <label className="form-label" htmlFor="audit-to">To</label>
          <Input
            id="audit-to"
            type="datetime-local"
            value={draft.to ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, to: v }))}
          />
        </div>
        <Button size="sm" onClick={apply}>
          Apply
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>
          Reset
        </Button>
      </div>

      {error && (
        <Card>
          <div className="card-body">
            Failed to load audit events: {error.message}
          </div>
        </Card>
      )}

      {!error && loading && !events && (
        <LoadingState label="Loading audit events…" />
      )}

      {!error && events && items.length === 0 && (
        <Card>
          <div className="card-body">
            No audit events match these filters.
          </div>
        </Card>
      )}

      {pageItems.length > 0 && (
        <DataTable<AuditEvent>
          columns={[
            {
              key: "at",
              label: "Time",
              mono: true,
              render: (event) => <span title={event.at}>{formatRelative(event.at)}</span>,
            },
            { key: "actor", label: "Actor", mono: true },
            {
              key: "action",
              label: "Action",
              render: (event) => <Badge variant="neutral">{event.action}</Badge>,
            },
            {
              key: "object",
              label: "Object",
              mono: true,
              render: (event) => `${event.objectType}/${event.objectName}`,
            },
            { key: "detail", label: "Detail" },
          ]}
          rows={pageItems}
          rowKey="id"
        />
      )}

      {items.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm u-muted">
          <span>
            Page {currentPage + 1} of {pageCount} ({items.length} events)
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
