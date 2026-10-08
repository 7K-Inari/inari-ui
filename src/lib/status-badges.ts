import type { BadgeVariant } from "7k-design-system/react";

const STATUS_MAP: Record<string, BadgeVariant> = {
  healthy: "success",
  connected: "success",
  approved: "success",
  online: "success",
  ready: "success",
  active: "success",
  synced: "success",
  pending: "warning",
  pending_approval: "warning",
  progressing: "warning",
  provisioning: "warning",
  attention: "warning",
  degraded: "danger",
  failed: "danger",
  rejected: "danger",
  missing: "danger",
  error: "danger",
  suspended: "neutral",
  cordoned: "neutral",
  unknown: "neutral",
  revoked: "neutral",
  decommissioned: "neutral",
  disconnected: "danger",
};

export function statusToBadge(status: string): BadgeVariant {
  return STATUS_MAP[status.toLowerCase()] ?? "neutral";
}

const HEALTH_MAP: Record<string, BadgeVariant> = {
  Healthy: "success",
  Progressing: "warning",
  Degraded: "danger",
  Missing: "danger",
  Suspended: "neutral",
  Unknown: "neutral",
};

export function healthToBadge(health: string): BadgeVariant {
  return HEALTH_MAP[health] ?? "neutral";
}

export function statusToDot(status: string): string {
  const variant = statusToBadge(status);
  switch (variant) {
    case "success":
      return "status-dot-live";
    case "warning":
      return "status-dot-away";
    case "danger":
      return "status-dot-busy";
    default:
      return "status-dot-offline";
  }
}
