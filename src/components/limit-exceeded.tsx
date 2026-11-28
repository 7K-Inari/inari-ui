import { ExternalLink, TriangleAlert } from "lucide-react";

import { ApiError } from "@/api/client";

export const DEFAULT_UPGRADE_URL = "https://7kgroup.org";

function safeUpgradeURL(candidate: string | undefined): string {
  if (candidate) {
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" && url.hostname === "7kgroup.org") return candidate;
    } catch {
      // Use the fixed commercial surface for malformed server values.
    }
  }
  return DEFAULT_UPGRADE_URL;
}

export function LimitExceededNotice({ error }: { error: ApiError }) {
  const details = error.limitExceeded;
  if (!details) return null;
  const quota = details.limitKind === "quota";
  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border u-warning-border/40 u-warning-bg/10 p-3 text-sm"
    >
      <div className="flex items-center gap-2 font-medium u-warning">
        <TriangleAlert className="h-4 w-4" aria-hidden />
        {quota ? "Plan limit reached" : "Feature unavailable on your plan"}
      </div>
      <p className="u-warning">{error.message}</p>
      {quota ? (
        <p className="u-muted">
          <span className="font-medium u-fg">Current usage: </span>
          {details.currentUsage ?? 0} of {details.maxAllowed ?? 0} in use for {details.limit}.
        </p>
      ) : (
        <p className="u-muted">
          The {details.limit} capability is not available on your current plan.
        </p>
      )}
      <div>
        <a
          className="btn btn-secondary btn-sm inline-flex items-center gap-1"
          href={safeUpgradeURL(details.upgradeUrl)}
          target="_blank"
          rel="noreferrer"
        >
          View upgrade options on 7kgroup.org
          <span className="sr-only"> (opens in a new tab)</span>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </div>
  );
}

export function ActionErrorNotice({ error, fallback }: { error: unknown; fallback: string }) {
  if (error instanceof ApiError && error.isLimitExceeded) {
    return <LimitExceededNotice error={error} />;
  }
  const message = error instanceof ApiError ? error.message : fallback;
  return (
    <p role="alert" className="text-sm u-danger">
      {message}
    </p>
  );
}
