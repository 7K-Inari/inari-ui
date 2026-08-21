import { config } from "@/config";

export const API_BASE_URL: string = config.apiBaseUrl;

export class ApiError extends Error {
  status: number;
  remediation?: string;

  constructor(status: number, message: string, remediation?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.remediation = remediation;
  }

  // Request-time OPA denials are surfaced as 422/403 with a policy detail and
  // optional remediation guidance (§5.11).
  get isPolicyDenial(): boolean {
    return (this.status === 422 || this.status === 403) && this.remediation !== undefined;
  }
}

interface ApiFetchOptions {
  token?: string;
  method?: string;
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
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

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    let remediation: string | undefined;
    try {
      // Huma ErrorModel: { title, status, detail, errors?: [{message}] }
      const data = (await res.json()) as {
        message?: string;
        detail?: string;
        remediation?: string;
        errors?: { message?: string }[];
      };
      if (data.detail) message = data.detail;
      else if (data.message) message = data.message;
      if (data.errors?.length && data.errors[0].message) {
        message = `${message} (${data.errors[0].message})`;
      }
      if (typeof data.remediation === "string") remediation = data.remediation;
    } catch {
      // keep default message
    }
    throw new ApiError(res.status, message, remediation);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await res.text()) as unknown as T;
  }
  return (await res.json()) as T;
}
