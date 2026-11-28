import { config } from "@/config";

export const API_BASE_URL: string = config.apiBaseUrl;

export type LimitExceededDetails = {
  limitKind: "quota" | "feature";
  limit: string;
  currentUsage?: number;
  maxAllowed?: number;
  requested?: number;
  upgradeUrl?: string;
};

export class ApiError extends Error {
  status: number;
  remediation?: string;
  // Server-typed error code (huma ErrorModel extension), e.g.
  // "extension_session_required" / "extension_downstream_denied" (W4 SSO).
  code?: string;
  limitExceeded?: LimitExceededDetails;

  constructor(
    status: number,
    message: string,
    remediation?: string,
    code?: string,
    limitExceeded?: LimitExceededDetails,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.remediation = remediation;
    this.code = code;
    this.limitExceeded = limitExceeded;
  }

  get isLimitExceeded(): boolean {
    return this.limitExceeded !== undefined;
  }

  // Request-time OPA denials are surfaced as 422/403 with a policy detail and
  // optional remediation guidance (§5.11).
  get isPolicyDenial(): boolean {
    return (this.status === 422 || this.status === 403) && this.remediation !== undefined;
  }
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function parseLimitExceeded(
  status: number,
  data: {
    code?: string;
    limitKind?: unknown;
    limit?: unknown;
    currentUsage?: unknown;
    maxAllowed?: unknown;
    requested?: unknown;
    upgradeUrl?: unknown;
  },
): LimitExceededDetails | undefined {
  if (data.code !== "plan_limit_exceeded" || typeof data.limit !== "string" || data.limit.trim() === "") {
    return undefined;
  }
  const upgradeUrl = typeof data.upgradeUrl === "string" ? data.upgradeUrl : undefined;
  if (data.limitKind === "feature" && status === 403) {
    return { limitKind: "feature", limit: data.limit, upgradeUrl };
  }
  if (data.limitKind !== "quota" || status !== 429) return undefined;
  const currentUsage = nonNegativeNumber(data.currentUsage);
  const maxAllowed = nonNegativeNumber(data.maxAllowed);
  if (currentUsage === undefined || maxAllowed === undefined) return undefined;
  const requested = data.requested === undefined ? undefined : nonNegativeNumber(data.requested);
  if (data.requested !== undefined && requested === undefined) return undefined;
  return { limitKind: "quota", limit: data.limit, currentUsage, maxAllowed, requested, upgradeUrl };
}

// Builds an ApiError from a failed huma response (ErrorModel:
// { title, status, detail, errors?: [{message}] }). Shared by apiFetch and
// non-JSON download helpers.
export async function apiErrorFromResponse(res: Response): Promise<ApiError> {
  let message = `Request failed with status ${res.status}`;
  let remediation: string | undefined;
  let code: string | undefined;
  let limitExceeded: LimitExceededDetails | undefined;
  try {
    const data = (await res.json()) as {
      message?: string;
      detail?: string;
      remediation?: string;
      code?: string;
      limitKind?: unknown;
      limit?: unknown;
      currentUsage?: unknown;
      maxAllowed?: unknown;
      requested?: unknown;
      upgradeUrl?: unknown;
      errors?: { message?: string }[];
    };
    if (data.detail) message = data.detail;
    else if (data.message) message = data.message;
    if (data.errors?.length && data.errors[0].message) {
      message = `${message} (${data.errors[0].message})`;
    }
    if (typeof data.remediation === "string") remediation = data.remediation;
    if (typeof data.code === "string") code = data.code;
    limitExceeded = parseLimitExceeded(res.status, data);
  } catch {
    // keep default message
  }
  return new ApiError(res.status, message, remediation, code, limitExceeded);
}

interface ApiFetchOptions {
  token?: string;
  method?: string;
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Network error: control plane unreachable");
  }

  if (!res.ok) throw await apiErrorFromResponse(res);

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await res.text()) as unknown as T;
  }
  return (await res.json()) as T;
}
