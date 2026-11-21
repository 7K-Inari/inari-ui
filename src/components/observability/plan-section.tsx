import { Alert, Badge, Radio, Select } from "7k-design-system/react";
import type { components } from "@/api/__generated__/schema";

type Preflight = components["schemas"]["Preflight"];
type ObservabilityInput = components["schemas"]["ObservabilityInput"];
type Target = components["schemas"]["Target"];

type Selection = { folder?: string; datasource?: string; evaluation?: string };
type GrafanaConfig = {
  evaluation?: string;
  folderPrefixes?: string[];
  datasources?: { name: string; type: string }[];
};

export interface ObservabilityPlanSectionProps {
  preflight: Preflight;
  value: ObservabilityInput;
  onChange: (value: ObservabilityInput) => void;
  loading?: boolean;
  error?: string;
}

function asSelection(value: unknown): Selection {
  return typeof value === "object" && value !== null ? value as Selection : {};
}

function targetConfig(target: Target | undefined): GrafanaConfig {
  return typeof target?.config === "object" && target.config !== null ? target.config as GrafanaConfig : {};
}

function defaultSelection(target: Target | undefined, current: Selection, orgSlug: string, appFolder: string): Selection {
  const config = targetConfig(target);
  return {
    folder: current.folder || `${orgSlug}/${appFolder}`,
    datasource: current.datasource || config.datasources?.[0]?.name || "",
    evaluation: config.evaluation || current.evaluation || "",
  };
}

export function ObservabilityPlanSection({ preflight, value, onChange, loading, error }: ObservabilityPlanSectionProps) {
  const plan = preflight.plan;
  const capability = plan.capability;
  if (loading) {
    return <div className="space-y-3" aria-busy="true"><p>Checking exact app metadata…</p><div className="h-20 animate-none rounded bg-[var(--bg-raised)]" /></div>;
  }
  if (error) {
    return <Alert variant="danger"><span>Observability preflight unavailable</span><span>{error}</span></Alert>;
  }
  if (!capability) {
    return <Alert variant="neutral">This exact app version has no signed observability metadata.</Alert>;
  }

  const effective = value.mode === "provision"
    ? {
        ...value,
        pack: value.pack ?? plan.observability.pack ?? preflight.compatiblePacks?.[0],
        target: value.target ?? plan.observability.target,
      }
    : value;
  const selectedTarget = preflight.monitoringTargets?.find((target) => target.id === effective.target?.id);
  const selection = asSelection(effective.target?.selection);
  const config = targetConfig(selectedTarget);
  const folderOptions = Array.from(new Set([...(config.folderPrefixes ?? []), selection.folder ?? ""])).filter(Boolean);

  const chooseMode = (mode: string) => {
    if (mode === "provision") {
      onChange({
        mode,
        pack: effective.pack ?? plan.observability.pack ?? preflight.compatiblePacks?.[0],
        target: effective.target ?? plan.observability.target,
      });
    } else {
      onChange({ mode: "skip" });
    }
  };
  const chooseTarget = (id: string) => {
    const target = preflight.monitoringTargets?.find((candidate) => candidate.id === id);
    const nextSelection = defaultSelection(target, {}, plan.orgSlug, capability.folder);
    onChange({ ...effective, mode: "provision", target: { id, revision: target?.revision ?? 0, selection: nextSelection } });
  };
  const updateSelection = (patch: Selection) => {
    if (!effective.target) return;
    onChange({ ...effective, mode: "provision", target: { ...effective.target, selection: { ...selection, ...patch } } });
  };

  return (
    <section className="flex flex-col gap-3" aria-label="Observability deployment options">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex min-h-[90px] flex-col gap-2 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
          <Radio name="observability-mode" value="provision" checked={value.mode === "provision"} onChange={() => chooseMode("provision")} label="Provision" disabled={!preflight.monitoringTargets?.length || !preflight.compatiblePacks?.length} />
          <span className="text-sm text-[var(--text-secondary)]">Create a linked companion into an entitled Grafana target.</span>
        </label>
        <label className="flex min-h-[90px] flex-col gap-2 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
          <Radio name="observability-mode" value="skip" checked={value.mode === "skip"} onChange={() => chooseMode("skip")} label="Skip for now" />
          <span className="text-sm text-[var(--text-secondary)]">Provision later from the resource instance. No companion is created.</span>
        </label>
      </div>

      <div>
        <h3 className="font-medium">Included in this exact version</h3>
        <ul className="mt-2 space-y-2">
          {capability.dashboards?.map((dashboard) => <li key={dashboard.uid} className="flex flex-wrap justify-between gap-2"><span>{dashboard.title}</span><code className="break-all">{dashboard.uid}</code></li>)}
          {capability.rules?.map((rule) => <li key={`${rule.file}-${rule.evaluation}`} className="flex flex-wrap justify-between gap-2"><code className="break-all">{rule.file}</code><Badge variant="neutral">{rule.evaluation}</Badge></li>)}
        </ul>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded bg-[var(--bg-raised)] p-3"><span className="text-xs text-[var(--text-secondary)]">Application pin</span><p>{plan.app.itemId} · v{plan.app.version}</p><code className="block break-all text-xs">{plan.app.digest}</code><span className="text-xs">{capability.minimumAppVersion}</span></div>
        {effective.pack && <div className="rounded bg-[var(--bg-raised)] p-3"><span className="text-xs text-[var(--text-secondary)]">Observability pack</span><p>{effective.pack.itemId} · v{effective.pack.version}</p><code className="block break-all text-xs">{effective.pack.digest}</code><span className="block text-xs">{capability.observabilityPack.versionRange}</span><code className="block break-all text-xs">{effective.pack.renderContract}</code></div>}
      </div>

      {value.mode === "skip" && <Alert variant="neutral">No companion is created. Provision later from the resource instance.</Alert>}
      {value.mode === "provision" && !preflight.monitoringTargets?.length && <Alert variant="warning">No eligible monitoring target. Deploy without observability or request a platform grant.</Alert>}
      {value.mode === "provision" && !preflight.compatiblePacks?.length && <Alert variant="warning">No compatible observability pack matches the required version range and render contract.</Alert>}

      {value.mode === "provision" && (preflight.compatiblePacks?.length ?? 0) > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className="mb-1 block text-sm" htmlFor="observability-pack">Compatible pack</label><Select id="observability-pack" value={effective.pack?.version ?? ""} onChange={(event) => onChange({ ...effective, mode: "provision", pack: preflight.compatiblePacks?.find((pack) => pack.version === event.target.value) })}>{preflight.compatiblePacks?.map((pack) => <option key={pack.itemId + pack.version} value={pack.version}>{pack.itemId} · {pack.version}</option>)}</Select></div>
          <div><label className="mb-1 block text-sm" htmlFor="observability-target">Monitoring target</label><Select id="observability-target" value={effective.target?.id ?? ""} onChange={(event) => chooseTarget(event.target.value)}><option value="">Select a monitoring target…</option>{preflight.monitoringTargets?.map((target) => <option key={target.id} value={target.id}>{target.name} · revision {target.revision}</option>)}</Select></div>
          {effective.target && <>
            <div><label className="mb-1 block text-sm" htmlFor="observability-folder">Folder</label><Select id="observability-folder" value={selection.folder ?? ""} onChange={(event) => updateSelection({ folder: event.target.value })}>{folderOptions.map((folder) => <option key={folder} value={folder}>{folder}</option>)}</Select></div>
            <div><label className="mb-1 block text-sm" htmlFor="observability-datasource">Datasource</label><Select id="observability-datasource" value={selection.datasource ?? ""} onChange={(event) => updateSelection({ datasource: event.target.value })}>{config.datasources?.map((datasource) => <option key={datasource.name} value={datasource.name}>{datasource.name} · {datasource.type}</option>)}</Select></div>
            <div><label className="mb-1 block text-sm" htmlFor="observability-evaluation">Evaluation</label><Select id="observability-evaluation" value={selection.evaluation ?? config.evaluation ?? ""} disabled><option>{selection.evaluation ?? config.evaluation}</option></Select></div>
          </>}
        </div>
      )}
      {value.mode === "provision" && !plan.gate.companionRendering && <Alert variant="info">blocked_external_gate: intent only; no approval, Git write, instance, verification, or automatic resume. Recheck gate after platform renderer availability is confirmed.</Alert>}
      {value.mode === "provision" && <p className="text-sm text-[var(--text-secondary)]">Companion approval is independent of application approval. No Grafana links appear before verified readiness.</p>}
    </section>
  );
}
