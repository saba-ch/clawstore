// Response types matching the API routes

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
}

export interface Agent {
  id: string;
  scope: string;
  name: string;
  displayName: string;
  tagline: string;
  category: string;
  license: string;
  downloadCount: number;
  avgRating: number | null;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDetail extends Agent {
  description: string;
  homepage: string | null;
  repository: string | null;
  tags: string[];
  latestVersion: AgentVersionDetail | null;
  owner: {
    githubLogin: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}

export interface AgentVersion {
  id: string;
  version: string;
  channel: string;
  tarballSizeBytes: number;
  downloadCount: number;
  uploadedAt: string;
  yankedAt: string | null;
  yankedReason: string | null;
}

export interface AgentVersionDetail {
  id: string;
  version: string;
  channel: string;
  manifest: Record<string, unknown>;
  tarballSha256: string;
  tarballSizeBytes: number;
  downloadCount: number;
  uploadedByUserId?: string;
  uploadedAt: string;
  yankedAt: string | null;
  yankedByUserId?: string | null;
  yankedReason?: string | null;
}

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  reviewer: {
    githubLogin: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export interface ReviewListResponse {
  items: Review[];
  avgRating: number | null;
  reviewCount: number;
  nextCursor?: string;
}

export interface UpdateCheck {
  id: string;
  from: string;
  to: string;
  channel: string;
  yanked: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
}

export interface UserProfile {
  githubLogin: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  website: string | null;
  location: string | null;
  createdAt: string;
  agents: Array<{
    scope: string;
    name: string;
    tagline: string;
    avgRating: number | null;
    downloadCount: number;
  }>;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  scope: string | null;
  ownedAgentCount: number;
  profile: {
    bio: string | null;
    website: string | null;
    location: string | null;
    avatarUrl: string | null;
    displayName: string | null;
  } | null;
}

export interface PublishResult {
  id: string;
  version: string;
  agentId: string;
  versionId: string;
  channel: string;
  tarballSha256: string;
  tarballSizeBytes: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
