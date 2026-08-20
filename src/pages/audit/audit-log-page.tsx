import { Download } from "lucide-react";
import * as React from "react";

import { exportAuditEvents, listAuditEvents } from "@/api/audit";
import type { AuditFilters } from "@/api/audit";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";

const EMPTY_FILTERS: AuditFilters = {};

export function AuditLogPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const [draft, setDraft] = React.useState<AuditFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = React.useState<AuditFilters>(EMPTY_FILTERS);
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  const { data: events, loading, error } = useAsyncResource(
    (t) => listAuditEvents(t, tenant, filters),
    [tenant, filters],
  );

  function apply() {
    setFilters({ ...draft });
  }

  function reset() {
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
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const items = events ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            Every control-plane action for this tenant.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={exporting} onClick={() => void exportCsv()}>
          <Download aria-hidden />
          Export CSV
        </Button>
      </div>

      {exportError && <p className="text-sm text-destructive">{exportError}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="audit-actor">Actor</Label>
          <Input
            id="audit-actor"
            value={draft.actor ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, actor: e.target.value }))}
            placeholder="jane@acme.example"
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-action">Action</Label>
          <Input
            id="audit-action"
            value={draft.action ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
            placeholder="deploy.create"
            className="w-48 font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-object-type">Object type</Label>
          <Input
            id="audit-object-type"
            value={draft.objectType ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, objectType: e.target.value }))}
            placeholder="instance"
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-from">From</Label>
          <Input
            id="audit-from"
            type="datetime-local"
            value={draft.from ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-to">To</Label>
          <Input
            id="audit-to"
            type="datetime-local"
            value={draft.to ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
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
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load audit events: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !events && (
        <p className="text-sm text-muted-foreground">Loading audit events…</p>
      )}

      {!error && events && items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No audit events match these filters.
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Actor</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Object</th>
                <th className="px-4 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {items.map((event) => (
                <tr key={event.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 text-muted-foreground">
                    <span title={event.at}>{formatRelative(event.at)}</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{event.actor}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className="font-mono">
                      {event.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {event.objectType}/{event.objectName}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{event.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
