import type { CloudAccountStatus } from "@/api/cloud-accounts";
import { Badge } from "7k-design-system/react";

const STATUS_CONFIG: Record<
  CloudAccountStatus,
  { label: string; variant: "success" | "warning" | "danger" | "neutral" }
> = {
  connected: { label: "Connected", variant: "success" },
  validating: { label: "Validating", variant: "warning" },
  pending_trust: { label: "Pending trust", variant: "neutral" },
  failed: { label: "Failed", variant: "danger" },
};

export function CloudAccountStatusBadge({ status }: { status: CloudAccountStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} data-testid={`status-${status}`}>
      {config.label}
    </Badge>
  );
}
