export interface Cluster {
  id: string;
  name: string;
  tenantId: string;
  state: 'Pending' | 'Active' | 'Degraded' | 'Cordoned' | 'Decommissioned';
  kubernetesVersion?: string;
  labels?: Record<string, string>;
}

export interface CatalogItem {
  id: string;
  name: string;
  source: 'discovered' | 'curated' | 'platform';
  version: string;
  description?: string;
  schema?: Record<string, unknown>;
  uiHints?: Record<string, unknown>;
}

export interface ResourceInstance {
  id: string;
  catalogItemId: string;
  clusterId: string;
  cloudAccountId?: string;
  name: string;
  namespace?: string;
  health?: string;
  status?: Record<string, unknown>;
  ownerTeam?: string;
}

export interface ApprovalRequest {
  id: string;
  action: string;
  requester: string;
  state: 'pending' | 'approved' | 'rejected';
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => Promise<string | undefined> | string | undefined;
  fetchImpl?: typeof fetch;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getToken: ApiClientOptions['getToken'];
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getToken = options.getToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getToken();
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      throw new ApiError(res.status, `${method} ${path} failed: ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  listClusters(): Promise<Cluster[]> {
    return this.request('GET', '/api/v1/clusters');
  }

  getCluster(id: string): Promise<Cluster> {
    return this.request('GET', `/api/v1/clusters/${encodeURIComponent(id)}`);
  }

  listCatalogItems(clusterId?: string): Promise<CatalogItem[]> {
    const q = clusterId ? `?clusterId=${encodeURIComponent(clusterId)}` : '';
    return this.request('GET', `/api/v1/catalog/items${q}`);
  }

  getCatalogItem(id: string): Promise<CatalogItem> {
    return this.request('GET', `/api/v1/catalog/items/${encodeURIComponent(id)}`);
  }

  listResourceInstances(clusterId?: string): Promise<ResourceInstance[]> {
    const q = clusterId ? `?clusterId=${encodeURIComponent(clusterId)}` : '';
    return this.request('GET', `/api/v1/resources${q}`);
  }

  getResourceInstance(id: string): Promise<ResourceInstance> {
    return this.request('GET', `/api/v1/resources/${encodeURIComponent(id)}`);
  }

  listApprovals(): Promise<ApprovalRequest[]> {
    return this.request('GET', '/api/v1/approvals');
  }

  approveApproval(id: string): Promise<ApprovalRequest> {
    return this.request('POST', `/api/v1/approvals/${encodeURIComponent(id)}/approve`);
  }
}
