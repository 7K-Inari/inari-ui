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
      className="space-y-2 rounded-md border u-danger-border/40 u-danger-bg/10 p-3 text-sm"
    >
      <div className="flex items-center gap-2 font-medium u-danger">
        <ShieldAlert className="h-4 w-4" aria-hidden />
        Blocked by platform policy
      </div>
      <p className="u-danger">{reason}</p>
      {remediation && (
        <p className="u-muted">
          <span className="font-medium u-fg">Remediation: </span>
          {remediation}
        </p>
      )}
    </div>
  );
}
