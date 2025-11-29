import { supabase } from '../lib/supabase';
import { apiClient } from './client';
import { DeltaCompression, VersionComparisonService } from '../services/versionControl';
import type { ApiResponse, PaginatedResponse, PaginationParams } from './types';

export interface PromptBranch {
  id: string;
  prompt_id: string;
  branch_name: string;
  description: string;
  base_version_id: string;
  created_by: string;
  is_merged: boolean;
  merged_at?: string;
  merged_by?: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface VersionMetadata {
  id: string;
  version_id: string;
  tags: string[];
  change_category: string;
  breaking_change: boolean;
  tested: boolean;
  test_results?: Record<string, unknown>;
  reviewer_id?: string;
  reviewed_at?: string;
  review_status?: string;
  review_notes?: string;
  performance_impact?: string;
  lines_added: number;
  lines_removed: number;
  lines_modified: number;
  metadata: Record<string, unknown>;
}

export interface VersionComparison {
  versionA: {
    id: string;
    title: string;
    created_at: string;
    lineCount: number;
    characterCount: number;
  };
  versionB: {
    id: string;
    title: string;
    created_at: string;
    lineCount: number;
    characterCount: number;
  };
  changes: {
    additions: number;
    deletions: number;
    modifications: number;
    unchanged: number;
    total: number;
  };
  similarity: number;
  diff: {
    additions: Array<{ lineNumber: number; content: string; type: string }>;
    deletions: Array<{ lineNumber: number; content: string; type: string }>;
    modifications: Array<{ lineNumber: number; content: string; type: string }>;
  };
  html: {
    unified: string;
    sideBySide: string;
  };
}

export interface CreateBranchRequest {
  prompt_id: string;
  branch_name: string;
  description?: string;
  base_version_id: string;
}

export interface CreateVersionRequest {
  prompt_id: string;
  title: string;
  prompt_text: string;
  change_summary?: string;
  change_type?: 'major' | 'minor' | 'patch' | 'rollback';
  branch_id?: string;
  metadata?: {
    tags?: string[];
    change_category?: string;
    breaking_change?: boolean;
    performance_impact?: string;
  };
}

export class VersionControlApi {
  private static instance: VersionControlApi;

  private constructor() {}

  static getInstance(): VersionControlApi {
    if (!VersionControlApi.instance) {
      VersionControlApi.instance = new VersionControlApi();
    }
    return VersionControlApi.instance;
  }

  async createVersion(request: CreateVersionRequest): Promise<ApiResponse<any>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.rpc('create_prompt_version_with_delta', {
        p_prompt_id: request.prompt_id,
        p_title: request.title,
        p_prompt_text: request.prompt_text,
        p_change_summary: request.change_summary || 'No summary provided',
        p_change_type: request.change_type || 'minor',
        p_author_id: user.id,
        p_branch_id: request.branch_id || null,
      });

      if (error) throw error;

      if (request.metadata && data) {
        await supabase
          .from('version_metadata')
          .update({
            tags: request.metadata.tags || [],
            change_category: request.metadata.change_category,
            breaking_change: request.metadata.breaking_change || false,
            performance_impact: request.metadata.performance_impact,
          })
          .eq('version_id', data);
      }

      await apiClient.logRequest('POST', '/versions', request);

      return apiClient.createSuccessResponse(
        { version_id: data },
        'Version created successfully'
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async compareVersions(
    versionAId: string,
    versionBId: string
  ): Promise<ApiResponse<VersionComparison>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: cachedComparison } = await supabase
        .from('version_comparisons')
        .select('*')
        .eq('version_a_id', versionAId)
        .eq('version_b_id', versionBId)
        .maybeSingle();

      if (cachedComparison) {
        return apiClient.createSuccessResponse(
          cachedComparison.diff_json as VersionComparison,
          'Comparison retrieved from cache'
        );
      }

      const { data: versionA, error: errorA } = await supabase
        .from('prompt_versions')
        .select('id, title, prompt_text, created_at')
        .eq('id', versionAId)
        .single();

      if (errorA) throw errorA;

      const { data: versionB, error: errorB } = await supabase
        .from('prompt_versions')
        .select('id, title, prompt_text, created_at')
        .eq('id', versionBId)
        .single();

      if (errorB) throw errorB;

      const comparison = VersionComparisonService.compare(
        { id: versionA.id, title: versionA.title, content: versionA.prompt_text, created_at: versionA.created_at },
        { id: versionB.id, title: versionB.title, content: versionB.prompt_text, created_at: versionB.created_at }
      );

      await supabase.from('version_comparisons').insert({
        prompt_id: (versionA as any).prompt_id,
        version_a_id: versionAId,
        version_b_id: versionBId,
        diff_html: comparison.html.unified,
        diff_json: comparison,
        similarity_score: comparison.similarity,
        changes_summary: comparison.changes,
        computed_by: user.id,
      });

      await apiClient.logRequest('GET', `/versions/compare`, {
        versionAId,
        versionBId,
      });

      return apiClient.createSuccessResponse(comparison, 'Versions compared successfully');
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async createBranch(request: CreateBranchRequest): Promise<ApiResponse<PromptBranch>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: prompt } = await supabase
        .from('prompts')
        .select('author_id')
        .eq('id', request.prompt_id)
        .single();

      if (!prompt || prompt.author_id !== user.id) {
        throw new Error('Unauthorized: Can only create branches for own prompts');
      }

      const { data, error } = await supabase.rpc('create_prompt_branch', {
        p_prompt_id: request.prompt_id,
        p_branch_name: request.branch_name,
        p_description: request.description || '',
        p_base_version_id: request.base_version_id,
        p_created_by: user.id,
      });

      if (error) throw error;

      const { data: branch, error: branchError } = await supabase
        .from('prompt_branches')
        .select('*')
        .eq('id', data)
        .single();

      if (branchError) throw branchError;

      await apiClient.logRequest('POST', '/branches', request);

      return apiClient.createSuccessResponse(
        branch as PromptBranch,
        'Branch created successfully'
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async listBranches(
    promptId: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<PromptBranch>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { page, limit, offset } = apiClient.validatePaginationParams(
        pagination?.page,
        pagination?.limit
      );

      const { data, error, count } = await supabase
        .from('prompt_branches')
        .select('*', { count: 'exact' })
        .eq('prompt_id', promptId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        data: (data || []) as PromptBranch[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
        success: true,
      };
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async mergeBranch(branchId: string): Promise<ApiResponse<null>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: branch } = await supabase
        .from('prompt_branches')
        .select('prompt_id, created_by')
        .eq('id', branchId)
        .single();

      if (!branch) {
        throw new Error('Branch not found');
      }

      const { data: prompt } = await supabase
        .from('prompts')
        .select('author_id')
        .eq('id', branch.prompt_id)
        .single();

      if (!prompt || prompt.author_id !== user.id) {
        throw new Error('Unauthorized: Can only merge branches for own prompts');
      }

      const { error } = await supabase.rpc('merge_prompt_branch', {
        p_branch_id: branchId,
        p_merged_by: user.id,
      });

      if (error) throw error;

      await apiClient.logRequest('POST', `/branches/${branchId}/merge`);

      return apiClient.createSuccessResponse(null, 'Branch merged successfully');
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async deleteBranch(branchId: string): Promise<ApiResponse<null>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: branch } = await supabase
        .from('prompt_branches')
        .select('prompt_id, created_by')
        .eq('id', branchId)
        .single();

      if (!branch) {
        throw new Error('Branch not found');
      }

      const { data: prompt } = await supabase
        .from('prompts')
        .select('author_id')
        .eq('id', branch.prompt_id)
        .single();

      if (!prompt || prompt.author_id !== user.id) {
        throw new Error('Unauthorized: Can only delete branches for own prompts');
      }

      const { error } = await supabase
        .from('prompt_branches')
        .update({ is_active: false })
        .eq('id', branchId);

      if (error) throw error;

      await apiClient.logRequest('DELETE', `/branches/${branchId}`);

      return apiClient.createSuccessResponse(null, 'Branch deleted successfully');
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async getVersionMetadata(versionId: string): Promise<ApiResponse<VersionMetadata>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('version_metadata')
        .select('*')
        .eq('version_id', versionId)
        .single();

      if (error) throw error;

      return apiClient.createSuccessResponse(
        data as VersionMetadata,
        'Metadata retrieved successfully'
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async updateVersionMetadata(
    versionId: string,
    metadata: Partial<VersionMetadata>
  ): Promise<ApiResponse<VersionMetadata>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('version_metadata')
        .update(metadata)
        .eq('version_id', versionId)
        .select()
        .single();

      if (error) throw error;

      await apiClient.logRequest('PUT', `/versions/${versionId}/metadata`, metadata);

      return apiClient.createSuccessResponse(
        data as VersionMetadata,
        'Metadata updated successfully'
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async getVersionAuditLog(
    versionId: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<any>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { page, limit, offset } = apiClient.validatePaginationParams(
        pagination?.page,
        pagination?.limit
      );

      const { data, error, count } = await supabase
        .from('version_audit_log')
        .select('*', { count: 'exact' })
        .eq('version_id', versionId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
        success: true,
      };
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async getVersionsByBranch(
    branchId: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<any>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { page, limit, offset } = apiClient.validatePaginationParams(
        pagination?.page,
        pagination?.limit
      );

      const { data, error, count } = await supabase
        .from('prompt_versions')
        .select('*', { count: 'exact' })
        .eq('branch_id', branchId)
        .order('version_number', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
        success: true,
      };
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }
}

export const versionControlApi = VersionControlApi.getInstance();
