import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// Extension per-user SSO sessions (W4): the console bootstraps a third-party
// (e.g. ArgoCD) session via a zero-prompt OIDC round-trip and hands the
// resulting material to the control plane, which stores it server-side. The
// material is never persisted client-side.
//
// TODO(W1-contract): the pinned OpenAPI snapshot does not yet include the
// extension-session paths. The wire shapes below mirror the W1 contract; after
// `npm run sync:api -- <w1-server-version>` replace them with
// components["schemas"][...] imports from @/api/__generated__/schema.

interface WireExtensionSession {
  extensionId: string;
  state: string;
  expiresAt?: string | null;
}

interface WireExtensionSessionInput {
  sessionMaterial: string;
  nonce: string;
}

interface WireExtensionSessionOutputBody {
  session: WireExtensionSession;
}

export interface ExtensionSessionViewModel {
  extensionId: string;
  state: string;
  expiresAt: string | null;
}

export interface ExtensionSessionInput {
  sessionMaterial: string;
  nonce: string;
}

function toSessionViewModel(w: WireExtensionSession): ExtensionSessionViewModel {
  return {
    extensionId: w.extensionId,
    state: w.state,
    expiresAt: w.expiresAt ?? null,
  };
}

export async function getExtensionSessionState(
  token: string | undefined,
  tenant: string,
  extensionId: string,
): Promise<ExtensionSessionViewModel> {
  const res = await apiFetch<WireExtensionSessionOutputBody>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/extensions/${encodeURIComponent(extensionId)}/session`,
    { token },
  );
  return toSessionViewModel(res.session);
}

// Hands freshly-bootstrapped third-party session material to the server. The
// material must be used for this call only — never stored or logged.
export async function postExtensionSession(
  token: string | undefined,
  tenant: string,
  extensionId: string,
  input: ExtensionSessionInput,
): Promise<ExtensionSessionViewModel> {
  const body: WireExtensionSessionInput = {
    sessionMaterial: input.sessionMaterial,
    nonce: input.nonce,
  };
  const res = await apiFetch<WireExtensionSessionOutputBody>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/extensions/${encodeURIComponent(extensionId)}/session`,
    { token, method: "POST", body },
  );
  return toSessionViewModel(res.session);
}
