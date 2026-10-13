import { Skeleton } from "7k-design-system/react";

// Shared loading placeholder: stacked skeleton lines with an accessible label.
export function LoadingState({
  label = "Loading…",
  rows = 3,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div role="status" aria-label={label} className="space-y-2 py-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={14} />
      ))}
    </div>
  );
}
