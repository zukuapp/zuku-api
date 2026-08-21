// @zuku/sdk — TypeScript SDK for the zuku Platform API
// This is a skeleton; actual API client implementation to follow.

// --- Configuration ---

export interface ZukuClientConfig {
  /** API base URL, defaults to https://api.zuzunza.com/v1 */
  baseUrl?: string;
  /** Auth token (Bearer) */
  token?: string;
}

// --- Common Types ---

export interface PaginatedResponse<T> {
  status: 'ok';
  data: T[];
  meta: {
    cursor?: string;
    has_more: boolean;
  };
}

export interface ErrorResponse {
  status: 'error';
  code: string;
  message: string;
  details?: string[];
}

// --- Content Types ---

export type MediaType = 'hype' | 'swipe' | 'jump';

export interface Content {
  id: string;
  type: MediaType;
  title: string;
  description?: string;
  author_id: string;
  created_at: string;
  updated_at: string;
}

// --- User Types ---

export interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
}

// --- Client ---

export class ZukuClient {
  private baseUrl: string;
  private token?: string;

  constructor(config: ZukuClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? 'https://api.zuzunza.com/v1';
    this.token = config.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const err = await response.json() as ErrorResponse;
      throw new Error(`[${err.code}] ${err.message}`);
    }
    return response.json() as Promise<T>;
  }

  // --- Content API ---

  async getContentList(cursor?: string): Promise<PaginatedResponse<Content>> {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return this.request<PaginatedResponse<Content>>(`/content${qs}`);
  }

  async getContent(id: string): Promise<{ status: 'ok'; data: Content }> {
    return this.request(`/content/${encodeURIComponent(id)}`);
  }

  // --- User API ---

  async getCurrentUser(): Promise<{ status: 'ok'; data: User }> {
    return this.request('/users/me');
  }

  async getUser(id: string): Promise<{ status: 'ok'; data: User }> {
    return this.request(`/users/${encodeURIComponent(id)}`);
  }
}

// --- Default Export ---

export default ZukuClient;
