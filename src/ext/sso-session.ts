import { ApiError } from "@/api/client";
import {
  postExtensionSession,
  type ExtensionSessionInput,
  type ExtensionSessionViewModel,
} from "@/api/extension-session";

// Zero-prompt SSO bootstrap for `oidc-sso-session` extensions (W4). The shell
// redirects through the downstream's login endpoint (ArgoCD → cluster Dex →
// platform Keycloak), which completes promptlessly against the user's existing
// Keycloak SSO session and lands back on the console callback with the
// third-party session material in the URL fragment. The material is handed to
// the control plane immediately and is never persisted or logged client-side.

export const PENDING_SSO_KEY = "inari-ext-sso-pending";

export type ExtensionErrorKind = "session" | "downstream-denied" | "policy" | "unknown";

const SESSION_ERROR_CODES = new Set([
  "extension_session_required",
  "extension_session_expired",
]);
const DOWNSTREAM_DENIED_CODE = "extension_downstream_denied";

export class ExtensionAuthError extends Error {
  kind: ExtensionErrorKind;
  status?: number;
  remediation?: string;

  constructor(kind: ExtensionErrorKind, message: string, status?: number, remediation?: string) {
    super(message);
    this.name = "ExtensionAuthError";
    this.kind = kind;
    this.status = status;
    this.remediation = remediation;
  }
}

export function classifyExtensionError(err: unknown): ExtensionErrorKind {
  if (err instanceof ApiError) {
    if (err.code && SESSION_ERROR_CODES.has(err.code)) return "session";
    if (err.code === DOWNSTREAM_DENIED_CODE) return "downstream-denied";
    if (err.status === 401) return "session";
    if (err.isPolicyDenial) return "policy";
  }
  return "unknown";
}

function toExtensionAuthError(err: unknown): ExtensionAuthError {
  if (err instanceof ExtensionAuthError) return err;
  const kind = classifyExtensionError(err);
  if (err instanceof ApiError) {
    return new ExtensionAuthError(kind, err.message, err.status, err.remediation);
  }
  return new ExtensionAuthError(kind, err instanceof Error ? err.message : String(err));
}

// Runs an extension action; on a typed session-expired response, silently
// re-runs the bootstrap (via `reauth`) and retries the action exactly once.
// Any remaining failure is thrown as a classified ExtensionAuthError for the
// caller to render.
export async function withExtensionSessionRetry<T>(
  action: () => Promise<T>,
  options: { reauth: () => Promise<void> },
): Promise<T> {
  try {
    return await action();
  } catch (err) {
    if (classifyExtensionError(err) !== "session") throw toExtensionAuthError(err);
  }
  try {
    await options.reauth();
  } catch (err) {
    throw toExtensionAuthError(err);
  }
  try {
    return await action();
  } catch (err) {
    throw toExtensionAuthError(err);
  }
}

// In-memory-only session cache, keyed by tenant + extension. Cleared on tenant
// switch and logout; never written to web storage.
const sessions = new Set<string>();

function sessionKey(tenant: string, extensionId: string): string {
  return `${tenant}/${extensionId}`;
}

export function hasExtensionSession(tenant: string, extensionId: string): boolean {
  return sessions.has(sessionKey(tenant, extensionId));
}

function markExtensionSession(tenant: string, extensionId: string): void {
  sessions.add(sessionKey(tenant, extensionId));
}

export function clearExtensionSessions(tenant?: string): void {
  if (tenant === undefined) {
    sessions.clear();
    return;
  }
  for (const key of sessions) {
    if (key.startsWith(`${tenant}/`)) sessions.delete(key);
  }
}

export interface PendingSso {
  extensionId: string;
  tenant: string;
  nonce: string;
  returnTo: string;
  // Kept so a failed round-trip can be retried from the callback page.
  ssoLoginBaseUrl?: string;
}

export function peekPendingSso(storage: Storage = sessionStorage): PendingSso | null {
  try {
    const raw = storage.getItem(PENDING_SSO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingSso>;
    if (
      typeof parsed.extensionId !== "string" ||
      typeof parsed.tenant !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.returnTo !== "string" ||
      (parsed.ssoLoginBaseUrl !== undefined && typeof parsed.ssoLoginBaseUrl !== "string")
    ) {
      return null;
    }
    return parsed as PendingSso;
  } catch {
    return null;
  }
}

export function ssoCallbackPath(tenant: string, nonce: string): string {
  return `/${encodeURIComponent(tenant)}/ext-sso/callback?nonce=${encodeURIComponent(nonce)}`;
}

export function buildExtensionSsoLoginUrl(ssoLoginBaseUrl: string, returnUrl: string): string {
  const url = new URL("/auth/login", ssoLoginBaseUrl);
  url.searchParams.set("return_url", returnUrl);
  return url.toString();
}

export interface BeginSsoOptions {
  tenant: string;
  extensionId: string;
  ssoLoginBaseUrl: string;
  returnTo: string;
}

export interface BeginSsoDeps {
  navigate?: (url: string) => void;
  storage?: Storage;
}

// Starts the zero-prompt round-trip: stores a pending marker (nonce +
// extension + return path — never session material) and redirects to the
// downstream login endpoint with the console callback as return_url.
export function beginExtensionSsoRedirect(options: BeginSsoOptions, deps: BeginSsoDeps = {}): void {
  const storage = deps.storage ?? sessionStorage;
  const navigate = deps.navigate ?? ((url: string) => window.location.assign(url));
  const nonce = crypto.randomUUID();
  const pending: PendingSso = {
    extensionId: options.extensionId,
    tenant: options.tenant,
    nonce,
    returnTo: options.returnTo,
    ssoLoginBaseUrl: options.ssoLoginBaseUrl,
  };
  storage.setItem(PENDING_SSO_KEY, JSON.stringify(pending));
  const returnUrl = new URL(ssoCallbackPath(options.tenant, nonce), window.location.origin);
  navigate(buildExtensionSsoLoginUrl(options.ssoLoginBaseUrl, returnUrl.toString()));
}

export interface CompleteSsoDeps {
  postSession?: (
    token: string | undefined,
    tenant: string,
    extensionId: string,
    input: ExtensionSessionInput,
  ) => Promise<ExtensionSessionViewModel>;
  storage?: Storage;
}

// Runs on the console SSO callback route. Extracts the third-party session
// material from the URL fragment, scrubs it from history, and posts it to the
// server extension-session endpoint. Returns the original return path.
export async function completeExtensionSsoCallback(
  token: string | undefined,
  deps: CompleteSsoDeps = {},
): Promise<string> {
  const storage = deps.storage ?? sessionStorage;
  const postSession = deps.postSession ?? postExtensionSession;
  const pending = peekPendingSso(storage);
  if (!pending) {
    throw new ExtensionAuthError("session", "No extension sign-in is in progress");
  }

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const material = hashParams.get("session");
  const nonce = params.get("nonce");

  // Scrub material from the URL before doing anything else. The pending
  // marker stays until a successful handoff so the callback page can offer a
  // retry on failure.
  window.history.replaceState(null, "", window.location.pathname);

  if (nonce !== pending.nonce) {
    throw new ExtensionAuthError("session", "Extension sign-in could not be verified");
  }
  if (!material) {
    throw new ExtensionAuthError("session", "Extension sign-in did not return a session");
  }

  const session = await postSession(token, pending.tenant, pending.extensionId, {
    sessionMaterial: material,
    nonce: pending.nonce,
  });
  void session;
  storage.removeItem(PENDING_SSO_KEY);
  markExtensionSession(pending.tenant, pending.extensionId);
  return pending.returnTo;
}
