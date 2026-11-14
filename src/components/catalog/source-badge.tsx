import { Badge } from "7k-design-system/react";

interface SourceBadgeProps {
  source?: string;
  sourceId?: string;
  trustTier?: "official" | "reviewed" | "experimental";
  unsigned?: boolean;
  sourceState?: string;
}

export function SourceBadge({ source, sourceId, trustTier, unsigned, sourceState }: SourceBadgeProps) {
  const stale = sourceState === "stale" || sourceState === "failed" || sourceState === "policy-changed";
  if (!source && !sourceId && !trustTier && !unsigned && !stale) return null;
  const sourceKindLabel = source ? source.charAt(0).toUpperCase() + source.slice(1) : undefined;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {sourceId ? <Badge variant="neutral">{sourceId}</Badge> : sourceKindLabel && <Badge variant="neutral">{sourceKindLabel}</Badge>}
      {trustTier && <Badge variant="info">{trustTier}</Badge>}
      {unsigned && <Badge variant="warning">Unsigned — development only</Badge>}
      {stale && <Badge variant="warning">Stale source</Badge>}
    </span>
  );
}
