import { Badge } from "@/components/ui/badge";
import type { ClusterStatus } from "@/api/types";

const STATUS_CONFIG: Record<
  ClusterStatus,
  { label: string; variant: "success" | "warning" | "destructive" | "muted" }
> = {
  connected: { label: "Connected", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  degraded: { label: "Degraded", variant: "warning" },
  disconnected: { label: "Disconnected", variant: "destructive" },
};

export function ClusterStatusBadge({ status }: { status: ClusterStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} data-testid={`status-${status}`}>
      {config.label}
    </Badge>
  );
}
