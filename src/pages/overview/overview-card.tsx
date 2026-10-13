import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, Skeleton } from "7k-design-system/react";

import { ApiError } from "@/api/client";
import type { AsyncState } from "@/api/hooks";

interface OverviewCardProps<T> {
  title: string;
  testId: string;
  href?: string;
  state: AsyncState<T>;
  isEmpty: (data: T) => boolean;
  empty: ReactNode;
  accentTop?: boolean;
  className?: string;
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
  accentTop = false,
  className,
  children,
}: OverviewCardProps<T>) {
  const { data, loading, error, refetch } = state;

  if (error && !data && isForbidden(error)) {
    return null;
  }

  let body: ReactNode;
  if (error && !data) {
    body = (
      <Alert variant="danger">
        <span>Failed to load: {error.message}</span>
        <Button variant="secondary" size="sm" onClick={refetch}>
          Retry
        </Button>
      </Alert>
    );
  } else if (!data && loading) {
    body = (
      <div className="overview-card-skeleton" aria-busy="true">
        <Skeleton width="66%" height={14} />
        <Skeleton width="50%" height={14} />
        <Skeleton width="75%" height={14} />
      </div>
    );
  } else if (data !== null && isEmpty(data)) {
    body = <div className="empty">{empty}</div>;
  } else if (data !== null) {
    body = children(data);
  }

  return (
    <Card
      data-testid={testId}
      className={`${accentTop ? "accent-secondary-border-top " : ""}${className ?? ""}`}
    >
      <div className="card-header overview-card-header">
        <span className="mono-label">{title}</span>
        {href && (
          <Link to={href} className="overview-card-link">
            View all
          </Link>
        )}
      </div>
      <div className="card-body">{body}</div>
    </Card>
  );
}
