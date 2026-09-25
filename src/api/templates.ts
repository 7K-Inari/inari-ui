import type { components } from "@/api/__generated__/schema";
import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// Scaffolding/templates (§7.3 #5): repo + pipeline + catalog entry + tenant
// RBAC in one flow. Wire types come from the generated OpenAPI schema
// (canonical /templates + /scaffold-runs endpoints); the *ViewModel types
// below adapt the canonical RunView (per-step states, untyped outputs map)
// to what the wizard consumes.

type RunView = components["schemas"]["RunView"];
type ServerTemplateSummary = components["schemas"]["TemplateSummary"];
type ServerTemplateDetail = components["schemas"]["TemplateDetail"];
type CreateRunInputBody = components["schemas"]["CreateRunInputBody"];
type ListTemplatesOutputBody = components["schemas"]["ListTemplatesOutputBody"];
type GetTemplateOutputBody = components["schemas"]["GetTemplateOutputBody"];
type CreateRunOutputBody = components["schemas"]["CreateRunOutputBody"];
type GetRunOutputBody = components["schemas"]["GetRunOutputBody"];
type RetryRunOutputBody = components["schemas"]["RetryRunOutputBody"];

export interface TemplateSummaryViewModel {
  id: string;
  name: string;
  displayName: string;
  description: string;
  tags: string[];
  version: string;
}

export interface TemplateDetailViewModel extends TemplateSummaryViewModel {
  schema: Record<string, unknown>;
  uiSchema?: Record<string, unknown>;
}

export interface ScaffoldStepViewModel {
  name: string;
  state: string;
  attempts: number;
  error: string | null;
}

export interface ScaffoldOutputs {
  repoUrl: string | null;
  pipelineUrl: string | null;
  catalogItemId: string | null;
}

export interface ScaffoldRunViewModel {
  id: string;
  templateName: string;
  version: string;
  displayName: string;
  phase: string;
  steps: ScaffoldStepViewModel[];
  outputs: ScaffoldOutputs;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  terminal: boolean;
  failed: boolean;
}

export interface CreateScaffoldRunInput {
  displayName?: string;
  values: Record<string, unknown>;
  version?: string;
}

function mapTemplateSummary(t: ServerTemplateSummary): TemplateSummaryViewModel {
  return {
    id: t.id,
    name: t.name,
    displayName: t.displayName,
    description: t.description,
    tags: t.tags ?? [],
    version: t.version,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function mapRunView(run: RunView): ScaffoldRunViewModel {
  const outputs = asRecord(run.outputs);
  const failed = run.phase === "failed" || Boolean(run.error);
  const terminal =
    failed || run.phase === "completed" || run.phase === "cancelled";
  return {
    id: run.id,
    templateName: run.templateName,
    version: run.version,
    displayName: run.displayName,
    phase: run.phase,
    steps: (run.steps ?? []).map((s) => ({
      name: s.name,
      state: s.state,
      attempts: s.attempts,
      error: s.error ?? null,
    })),
    outputs: {
      repoUrl: stringOrNull(outputs.repoUrl),
      pipelineUrl: stringOrNull(outputs.pipelineUrl),
      catalogItemId: stringOrNull(outputs.catalogItemId),
    },
    error: run.error ?? null,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    terminal,
    failed,
  };
}

export async function listTemplates(
  token: string | undefined,
  tenant: string,
): Promise<TemplateSummaryViewModel[]> {
  const res = await apiFetch<ListTemplatesOutputBody>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/templates`,
    { token },
  );
  return (res.templates ?? []).map(mapTemplateSummary);
}

export async function getTemplate(
  token: string | undefined,
  tenant: string,
  name: string,
): Promise<TemplateDetailViewModel> {
  const res = await apiFetch<GetTemplateOutputBody>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/templates/${encodeURIComponent(name)}`,
    { token },
  );
  const t: ServerTemplateDetail = res.template;
  return {
    ...mapTemplateSummary(t),
    schema: asRecord(t.schema),
    ...(t.uiSchema !== undefined ? { uiSchema: asRecord(t.uiSchema) } : {}),
  };
}

export async function createScaffoldRun(
  token: string | undefined,
  tenant: string,
  templateName: string,
  input: CreateScaffoldRunInput,
): Promise<ScaffoldRunViewModel> {
  const body: CreateRunInputBody = {
    values: input.values,
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.version !== undefined ? { version: input.version } : {}),
  };
  const res = await apiFetch<CreateRunOutputBody>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/templates/${encodeURIComponent(templateName)}/runs`,
    { token, method: "POST", body },
  );
  return mapRunView(res.run);
}

export async function getScaffoldRun(
  token: string | undefined,
  tenant: string,
  runId: string,
): Promise<ScaffoldRunViewModel> {
  const res = await apiFetch<GetRunOutputBody>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/scaffold-runs/${encodeURIComponent(runId)}`,
    { token },
  );
  return mapRunView(res.run);
}

export async function cancelScaffoldRun(
  token: string | undefined,
  tenant: string,
  runId: string,
): Promise<void> {
  await apiFetch<unknown>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/scaffold-runs/${encodeURIComponent(runId)}/cancel`,
    { token, method: "POST" },
  );
}

export async function retryScaffoldRun(
  token: string | undefined,
  tenant: string,
  runId: string,
): Promise<ScaffoldRunViewModel> {
  const res = await apiFetch<RetryRunOutputBody>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/scaffold-runs/${encodeURIComponent(runId)}/retry`,
    { token, method: "POST" },
  );
  return mapRunView(res.run);
}
