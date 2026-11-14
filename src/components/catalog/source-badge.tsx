import { Badge } from "7k-design-system/react";

interface SourceBadgeProps {
  source?: string;
  sourceId?: string;
  trustTier?: "official" | "reviewed" | "experimental";
  unsigned?: boolean;
}

export function SourceBadge({ source, sourceId, trustTier, unsigned }: SourceBadgeProps) {
  if (!source && !sourceId && !trustTier && !unsigned) return null;
  const sourceKindLabel = source ? source.charAt(0).toUpperCase() + source.slice(1) : undefined;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {sourceId ? <Badge variant="neutral">{sourceId}</Badge> : sourceKindLabel && <Badge variant="neutral">{sourceKindLabel}</Badge>}
      {trustTier && <Badge variant="info">{trustTier}</Badge>}
      {unsigned && <Badge variant="warning">Unsigned — development only</Badge>}
    </span>
  );
}
