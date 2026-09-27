import { Link } from "react-router-dom";
import { ShieldAlert, UserCircle2 } from "lucide-react";

import type { GitConnectionViewModel } from "@/api/git-connections";
import type { ScaffoldRunViewModel } from "@/api/templates";
import type { TemplateScope } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { tenantLink } from "@/tenant/tenant-link";

const PROVIDER_LABEL: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  forgejo: "Forgejo",
};

function providerLabel(provider: string): string {
  return PROVIDER_LABEL[provider] ?? provider;
}

// Pre-run identity preview (W6): makes the commit identity visible before a
// scaffold starts — personal git login for user-scope templates, platform
// App/bot otherwise; warns (with a deep link to Settings → Git connections)
// when a user-scope template has no connected account.
export function RunIdentityNotice({
  scope,
  connections,
  tenant,
}: {
  scope: TemplateScope;
  // undefined = still loading; empty array = no connected account.
  connections: GitConnectionViewModel[] | undefined;
  tenant: string;
}) {
  if (scope === "platform") {
    return (
      <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
        This template commits as the{" "}
        <span className="font-medium text-foreground">platform App</span> (bot
        identity).
      </p>
    );
  }

  if (connections === undefined) return null;

  const connection = connections[0];
  if (connection) {
    return (
      <p className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
        <UserCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          This run will commit as{" "}
          <span className="font-medium text-foreground">
            {connection.login}
          </span>{" "}
          ({providerLabel(connection.provider)}).
        </span>
      </p>
    );
  }

  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
    >
      <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
        <ShieldAlert className="h-4 w-4" aria-hidden />
        No personal git connection
      </div>
      <p className="text-muted-foreground">
        This template commits with your personal git identity. If the tenant
        fallback policy allows it, the run will use the{" "}
        <span className="font-medium text-foreground">platform App</span>{" "}
        identity instead and the run is audited; otherwise the run will be
        blocked.
      </p>
      <Link
        to={tenantLink(tenant, "settings/org/git-connections")}
        className="inline-flex font-medium text-primary hover:underline"
      >
        Connect a git account
      </Link>
    </div>
  );
}

// Post-run identity surface (W6): shows the identity a scaffold run committed
// with, plus an explicit audited-fallback notice when the platform App
// identity was used as fallback for a user-scope template.
export function RunIdentityBadge({ run }: { run: ScaffoldRunViewModel }) {
  const identity = run.commitIdentity;
  if (!identity) return null;

  const label =
    identity.kind === "user"
      ? `${identity.login ?? "personal git"}${identity.provider ? ` (${providerLabel(identity.provider)})` : ""}`
      : "Platform App";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Commits as</span>
        <Badge variant={identity.kind === "user" ? "secondary" : "warning"}>
          {label}
        </Badge>
        {run.usedFallback && <Badge variant="warning">fallback</Badge>}
      </div>
      {run.usedFallback && (
        <p className="max-w-md text-xs text-muted-foreground">
          The platform App identity was used for this run (personal git
          fallback). The run is audited.
        </p>
      )}
    </div>
  );
}
