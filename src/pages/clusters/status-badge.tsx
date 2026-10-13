import { Badge } from "7k-design-system/react";

import type { ClusterStatus } from "@/api/types";
import { statusToBadge } from "@/lib/status-badges";

const STATUS_LABEL: Record<ClusterStatus, string> = {
  connected: "Connected",
  pending: "Pending",
  pending_approval: "Pending approval",
  degraded: "Degraded",
  cordoned: "Cordoned",
  revoked: "Revoked",
  decommissioned: "Decommissioned",
  disconnected: "Disconnected",
};

export function ClusterStatusBadge({ status }: { status: ClusterStatus }) {
  return (
    <Badge variant={statusToBadge(status)} data-testid={`status-${status}`}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
