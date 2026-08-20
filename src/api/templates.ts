import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// Scaffolding/templates (§7.3 #5): repo + pipeline + catalog entry + tenant
// RBAC in one flow. The server owns the scaffold run; the console walks the
// wizard and polls the run.

export interface TemplateSummary {
  id: string;
  name: string;
  displayName: string;
  description: string;
  tags: string[];
  version: string;
}

export interface TemplateDetail extends TemplateSummary {
  schema: Record<string, unknown>;
  uiSchema?: Record<string, unknown>;
}

export type ScaffoldPhase =
  | "pending"
  | "rendering"
  | "creating-repo"
  | "creating-pipeline"
  | "registering-catalog"
  | "binding-rbac"
  | "completed"
  | "failed";

export interface ScaffoldOutputs {
  repoUrl: string | null;
  pipelineUrl: string | null;
  catalogItemId: string | null;
}

export interface ScaffoldRun {
  id: string;
  templateId: string;
  templateName: string;
  name: string;
  tenant: string;
  phase: ScaffoldPhase;
  message: string | null;
  outputs: ScaffoldOutputs;
  createdAt: string;
}

export interface CreateScaffoldRequest {
  templateId: string;
  name: string;
  parameters: Record<string, unknown>;
}

export async function listTemplates(
  token: string | undefined,
  tenant: string,
): Promise<TemplateSummary[]> {
  const res = await apiFetch<{ templates: TemplateSummary[] }>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/templates`,
    { token },
  );
  return res.templates;
}

export async function getTemplate(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<TemplateDetail> {
  const res = await apiFetch<{ template: TemplateDetail }>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/templates/${encodeURIComponent(id)}`,
    { token },
  );
  return res.template;
}

export async function createScaffold(
  token: string | undefined,
  tenant: string,
  body: CreateScaffoldRequest,
): Promise<ScaffoldRun> {
  const res = await apiFetch<{ scaffold: ScaffoldRun }>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/scaffolds`,
    { token, method: "POST", body },
  );
  return res.scaffold;
}

export async function getScaffold(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<ScaffoldRun> {
  const res = await apiFetch<{ scaffold: ScaffoldRun }>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/scaffolds/${encodeURIComponent(id)}`,
    { token },
  );
  return res.scaffold;
}
