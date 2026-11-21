import { ExternalLink } from "lucide-react";
import { Alert, Badge, Button } from "7k-design-system/react";
import type { components } from "@/api/__generated__/schema";

type InstanceObservability = components["schemas"]["InstanceObservability"];

export interface CompanionCardProps {
  status: InstanceObservability;
  onProvision?: () => void;
  onRecheck?: () => void;
  onRetryVerification?: () => void;
}

const stateCopy: Record<string, string> = {
  blocked_external_gate: "Intent only—no approval, Git write, instance, verification, or automatic resume. Recheck gate after renderer availability.",
  approval_pending: "Companion approval is pending and remains independent of application approval.",
  waiting_for_app: "Wait for the application instance ID or generated app commit.",
  render_pending: "Approved intent awaits the target-bound baseline pull request.",
  deploying: "The real companion is syncing. KRO/ArgoCD health does not unlock links.",
  verification_pending: "The healthy companion awaits current folder, dashboard, datasource, access, and rule verification.",
  verification_failed: "Verification failed. Previous evidence is invalid; retry when allowed.",
  expired: "Verification has expired. Run fresh verification.",
  stale: "The app, pack, target, or capability changed. Review changes and reverify.",
  unavailable: "The target or verification is unavailable.",
  revoked: "The target grant was revoked.",
  cancelled: "Provisioning was cancelled.",
};

export function CompanionCard({ status, onProvision, onRecheck, onRetryVerification }: CompanionCardProps) {
  if (!status.available) {
    return <Alert variant="neutral">{status.reason || "This exact app version has no signed observability metadata."}</Alert>;
  }
  const companion = status.companion;
  if (!companion) {
    return <div className="flex flex-col gap-3"><p>No companion is created.</p>{status.mode === "skip" && onProvision && <Button variant="secondary" onClick={onProvision}>Provision observability</Button>}</div>;
  }
  const ready = companion.state === "ready";
  const links = ready ? companion.links ?? [] : [];
  return (
    <section className="flex flex-col gap-2" aria-label="Observability companion">
      <div className="flex flex-wrap items-center gap-2"><Badge variant={ready ? "success" : companion.state === "verification_failed" ? "danger" : "warning"}>{companion.state}</Badge>{!ready && <Badge variant="neutral">LINKS 0</Badge>}</div>
      <p>{stateCopy[companion.state] || companion.reason || companion.state}</p>
      <div className="grid gap-2 md:grid-cols-2">
        <div><span className="text-xs text-[var(--text-secondary)]">Generation</span><p>{companion.generation}</p></div>
        <div><span className="text-xs text-[var(--text-secondary)]">Target</span><p>{companion.targetId} · revision {companion.targetRevision}</p></div>
        <div className="md:col-span-2"><span className="text-xs text-[var(--text-secondary)]">Application digest</span><code className="block break-all text-xs">{companion.appSourceDigest}</code></div>
        <div className="md:col-span-2"><span className="text-xs text-[var(--text-secondary)]">Pack</span><p>{companion.pack.itemId} · v{companion.pack.version}</p><code className="block break-all text-xs">{companion.pack.digest}</code></div>
      </div>
      {companion.verification && <div className="text-sm"><p>Verification run {companion.verification.run.id} · attempt {companion.verification.run.attempt}</p><p>Finished {companion.verification.run.finishedAt} · expires {companion.verification.expiresAt}</p></div>}
      {companion.state === "blocked_external_gate" && onRecheck && <Button variant="secondary" onClick={onRecheck}>Recheck gate</Button>}
      {companion.state === "verification_failed" && onRetryVerification && <Button variant="secondary" onClick={onRetryVerification}>Retry verification</Button>}
      {links.length > 0 && <ul className="flex flex-col gap-2">{links.map((link) => <li key={link.uid}><a className="flex items-center gap-2 break-all" href={link.url} target="_blank" rel="noreferrer" aria-label={`Open ${link.title} on Grafana (new tab)`}><ExternalLink size={16} aria-hidden />{link.title}</a></li>)}</ul>}
    </section>
  );
}
