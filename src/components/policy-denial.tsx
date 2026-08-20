import { ShieldAlert } from "lucide-react";

// Request-time OPA denial (§5.11): show the policy reason plus remediation
// guidance so the requester can fix the spec or request an exception.
export function PolicyDenialNotice({
  reason,
  remediation,
}: {
  reason: string;
  remediation?: string;
}) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
    >
      <div className="flex items-center gap-2 font-medium text-destructive">
        <ShieldAlert className="h-4 w-4" aria-hidden />
        Blocked by platform policy
      </div>
      <p className="text-destructive">{reason}</p>
      {remediation && (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Remediation: </span>
          {remediation}
        </p>
      )}
    </div>
  );
}
