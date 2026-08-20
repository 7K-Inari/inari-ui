import type { CloudAccountStatus } from "@/api/cloud-accounts";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<
  CloudAccountStatus,
  { label: string; variant: "success" | "warning" | "destructive" | "muted" }
> = {
  connected: { label: "Connected", variant: "success" },
  validating: { label: "Validating", variant: "warning" },
  pending_trust: { label: "Pending trust", variant: "muted" },
  failed: { label: "Failed", variant: "destructive" },
};

export function CloudAccountStatusBadge({ status }: { status: CloudAccountStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} data-testid={`status-${status}`}>
      {config.label}
    </Badge>
  );
}
