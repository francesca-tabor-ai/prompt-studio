export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  role?: string;
  department?: string;
  workflow?: string;
  type?: string;
  status?: string;
  visibility?: string;
  author_id?: string;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  success: boolean;
}

export interface Prompt {
  id: string;
  title: string;
  description: string;
  content: string;
  role: string;
  department: string;
  workflow: string;
  prompt_type: string;
  status: string;
  visibility: string;
  author_id: string;
  department_id?: string;
  team_id?: string;
  is_template: boolean;
  is_archived: boolean;
  usage_count: number;
  rating_average: number;
  rating_count: number;
  accuracy_score: number;
  relevance_score: number;
  tags: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface PromptVersion {
  id: string;
  prompt_id: string;
  version_number: number;
  title: string;
  prompt_text: string;
  change_summary?: string;
  change_type: 'major' | 'minor' | 'patch' | 'rollback';
  author_id: string;
  scenario_id?: string;
  scenario_name?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CreatePromptRequest {
  title: string;
  description?: string;
  content: string;
  role?: string;
  department?: string;
  workflow?: string;
  prompt_type?: string;
  status?: string;
  visibility?: string;
  department_id?: string;
  team_id?: string;
  is_template?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdatePromptRequest {
  title?: string;
  description?: string;
  content?: string;
  role?: string;
  department?: string;
  workflow?: string;
  prompt_type?: string;
  status?: string;
  visibility?: string;
  department_id?: string;
  team_id?: string;
  is_template?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface RevertPromptRequest {
  version_id: string;
  reason?: string;
}

export interface PromptWithVersions extends Prompt {
  versions: PromptVersion[];
}
