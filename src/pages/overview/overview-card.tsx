import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "@/api/client";
import type { AsyncState } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OverviewCardProps<T> {
  title: string;
  testId: string;
  href?: string;
  state: AsyncState<T>;
  isEmpty: (data: T) => boolean;
  empty: ReactNode;
  children: (data: T) => ReactNode;
}

// Shared shell for overview cards: skeleton on first load, inline error with
// retry, a purpose-built empty state, otherwise the card content. A card that
// already has data keeps showing it through transient refresh errors.
// A 403 (the caller may not read this resource in this tenant) hides the card
// entirely rather than showing an error — permission gating is response-driven
// until the server ships a per-tenant permission projection.
export function isForbidden(error: Error | null): boolean {
  return error instanceof ApiError && error.status === 403;
}

export function OverviewCard<T>({
  title,
  testId,
  href,
  state,
  isEmpty,
  empty,
  children,
}: OverviewCardProps<T>) {
  const { data, loading, error, refetch } = state;

  if (error && !data && isForbidden(error)) {
    return null;
  }

  let body: ReactNode;
  if (error && !data) {
    body = (
      <div className="flex flex-col items-start gap-3 py-2">
        <p className="text-sm text-destructive">Failed to load: {error.message}</p>
        <Button variant="outline" size="sm" onClick={refetch}>
          Retry
        </Button>
      </div>
    );
  } else if (!data && loading) {
    body = (
      <div className="space-y-2 py-1" aria-busy="true">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    );
  } else if (data !== null && isEmpty(data)) {
    body = <div className="py-2 text-sm text-muted-foreground">{empty}</div>;
  } else if (data !== null) {
    body = children(data);
  }

  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {href && (
          <Link to={href} className="text-sm text-primary hover:underline">
            View all
          </Link>
        )}
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
