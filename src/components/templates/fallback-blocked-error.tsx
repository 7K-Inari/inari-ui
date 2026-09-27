import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { tenantLink } from "@/tenant/tenant-link";

// Server 409 fallback-block (W6): a user-scope template was run without a
// connected personal git account and the tenant fallback policy blocks the
// platform App fallback. Point the user at Settings → Git connections.
export function FallbackBlockedError({
  tenant,
  detail,
}: {
  tenant: string;
  detail?: string | null;
}) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
    >
      <div className="flex items-center gap-2 font-medium text-destructive">
        <ShieldAlert className="h-4 w-4" aria-hidden />
        Personal git connection required
      </div>
      <p className="text-muted-foreground">
        This template requires a personal git connection to run, and the
        tenant fallback policy does not allow using the platform App identity.
        Connect a git account, then try again.
      </p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      <Button asChild size="sm" variant="outline">
        <Link to={tenantLink(tenant, "settings/org/git-connections")}>
          Connect a git account
        </Link>
      </Button>
    </div>
  );
}
