import type {
  Agent,
  AgentDetail,
  AgentVersion,
  AgentVersionDetail,
  Review,
  ReviewListResponse,
  UpdateCheck,
  Category,
  UserProfile,
  CurrentUser,
  PublishResult,
  PaginatedResponse,
  ApiError,
} from "./types.js";

export interface ClientConfig {
  baseUrl: string;
  token?: string;
  fetch?: typeof globalThis.fetch;
}

export interface ClawstoreClient {
  // Agents
  searchAgents(params?: {
    q?: string;
    category?: string;
    tag?: string;
    scope?: string;
    sort?: "recent" | "name" | "downloads" | "rating";
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedResponse<Agent>>;

  getAgent(scope: string, name: string): Promise<AgentDetail>;

  // Versions
  listVersions(
    scope: string,
    name: string,
    params?: { limit?: number; cursor?: string }
  ): Promise<PaginatedResponse<AgentVersion>>;

  getVersion(
    scope: string,
    name: string,
    version: string
  ): Promise<AgentVersionDetail>;

  getTarballUrl(scope: string, name: string, version: string): string;

  // Publish & yank
  publish(form: FormData): Promise<PublishResult>;

  yank(
    scope: string,
    name: string,
    version: string,
    reason?: string
  ): Promise<{ ok: boolean }>;

  unyank(
    scope: string,
    name: string,
    version: string
  ): Promise<{ ok: boolean }>;

  // Reviews
  listReviews(
    scope: string,
    name: string,
    params?: { limit?: number; cursor?: string }
  ): Promise<ReviewListResponse>;

  createReview(
    scope: string,
    name: string,
    data: { rating: number; title?: string; body?: string }
  ): Promise<{ id: string }>;

  updateReview(
    scope: string,
    name: string,
    reviewId: string,
    data: { rating?: number; title?: string; body?: string }
  ): Promise<{ ok: boolean }>;

  deleteReview(
    scope: string,
    name: string,
    reviewId: string
  ): Promise<{ ok: boolean }>;

  // Updates
  checkUpdates(
    installs: Array<{ id: string; version: string }>
  ): Promise<{ updates: UpdateCheck[] }>;

  // Meta
  getCategories(): Promise<Category[]>;
  getHealth(): Promise<{ ok: boolean; version: string }>;

  // Reports
  createReport(data: {
    agentId: string;
    versionId?: string;
    reason: string;
    details: string;
  }): Promise<{ id: string }>;

  // Users
  getMe(): Promise<CurrentUser>;
  getUser(username: string): Promise<UserProfile>;
  updateProfile(
    username: string,
    data: {
      bio?: string;
      website?: string;
      location?: string;
      displayName?: string;
    }
  ): Promise<{ ok: boolean }>;
}

export class ClawstoreApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ClawstoreApiError";
  }
}

export function createClient(config: ClientConfig): ClawstoreClient {
  const base = config.baseUrl.replace(/\/$/, "");
  const f = config.fetch ?? globalThis.fetch;

  async function request<T>(
    path: string,
    init?: RequestInit
  ): Promise<T> {
    const headers = new Headers(init?.headers);
    if (config.token) {
      headers.set("Authorization", `Bearer ${config.token}`);
    }

    const res = await f(`${base}${path}`, { ...init, headers });

    if (!res.ok) {
      let body: ApiError | undefined;
      try {
        body = await res.json();
      } catch {
        // Not JSON
      }
      throw new ClawstoreApiError(
        res.status,
        body?.error?.code ?? "unknown",
        body?.error?.message ?? `HTTP ${res.status}`,
        body?.error?.details
      );
    }

    return res.json();
  }

  function qs(params: Record<string, unknown>): string {
    const entries = Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null
    );
    if (entries.length === 0) return "";
    return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
  }

  return {
    // Agents
    searchAgents(params) {
      return request(`/agents${qs(params ?? {})}`);
    },

    getAgent(scope, name) {
      return request(`/agents/${scope}/${name}`);
    },

    // Versions
    listVersions(scope, name, params) {
      return request(`/agents/${scope}/${name}/versions${qs(params ?? {})}`);
    },

    getVersion(scope, name, version) {
      return request(`/agents/${scope}/${name}/versions/${version}`);
    },

    getTarballUrl(scope, name, version) {
      return `${base}/agents/${scope}/${name}/versions/${version}/tarball`;
    },

    // Publish & yank
    publish(form) {
      return request("/agents/publish", {
        method: "POST",
        body: form,
      });
    },

    yank(scope, name, version, reason) {
      return request(`/agents/${scope}/${name}/versions/${version}/yank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
    },

    unyank(scope, name, version) {
      return request(`/agents/${scope}/${name}/versions/${version}/unyank`, {
        method: "POST",
      });
    },

    // Reviews
    listReviews(scope, name, params) {
      return request(`/agents/${scope}/${name}/reviews${qs(params ?? {})}`);
    },

    createReview(scope, name, data) {
      return request(`/agents/${scope}/${name}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },

    updateReview(scope, name, reviewId, data) {
      return request(`/agents/${scope}/${name}/reviews/${reviewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },

    deleteReview(scope, name, reviewId) {
      return request(`/agents/${scope}/${name}/reviews/${reviewId}`, {
        method: "DELETE",
      });
    },

    // Updates
    checkUpdates(installs) {
      return request("/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installs }),
      });
    },

    // Meta
    getCategories() {
      return request("/categories");
    },

    getHealth() {
      return request("/health");
    },

    // Reports
    createReport(data) {
      return request("/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },

    // Users
    getMe() {
      return request("/me");
    },

    getUser(username) {
      return request(`/users/${username}`);
    },

    updateProfile(username, data) {
      return request(`/users/${username}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
  };
}
