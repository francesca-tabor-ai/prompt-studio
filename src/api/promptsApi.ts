import { supabase } from '../lib/supabase';
import { apiClient } from './client';
import type {
  Prompt,
  PromptVersion,
  CreatePromptRequest,
  UpdatePromptRequest,
  RevertPromptRequest,
  PaginatedResponse,
  ApiResponse,
  PaginationParams,
  SortParams,
  FilterParams,
  PromptWithVersions,
} from './types';

export class PromptsApi {
  private static instance: PromptsApi;

  private constructor() {}

  static getInstance(): PromptsApi {
    if (!PromptsApi.instance) {
      PromptsApi.instance = new PromptsApi();
    }
    return PromptsApi.instance;
  }

  async createPrompt(
    request: CreatePromptRequest
  ): Promise<ApiResponse<Prompt>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const hasPermission = await apiClient.checkAuthorization(
        user.id,
        'prompt',
        'create'
      );

      if (!hasPermission) {
        throw new Error('Unauthorized: User does not have permission to create prompts');
      }

      const promptData = {
        title: request.title,
        description: request.description || '',
        content: request.content,
        role: request.role || '',
        department: request.department || '',
        workflow: request.workflow || '',
        prompt_type: request.prompt_type || 'Template',
        status: request.status || 'Active',
        visibility: request.visibility || 'private',
        author_id: user.id,
        department_id: request.department_id || null,
        team_id: request.team_id || null,
        is_template: request.is_template || false,
        is_archived: false,
        tags: request.tags || [],
        metadata: request.metadata || {},
        created_by: user.id,
        usage_count: 0,
        accuracy_score: 0,
        relevance_score: 0,
        rating_average: 0,
        rating_count: 0,
      };

      const { data, error } = await supabase
        .from('prompts')
        .insert(promptData)
        .select()
        .single();

      if (error) throw error;

      const { error: versionError } = await supabase
        .from('prompt_versions')
        .insert({
          prompt_id: data.id,
          version_number: 1,
          title: request.title,
          prompt_text: request.content,
          change_summary: 'Initial version',
          change_type: 'major',
          author_id: user.id,
        });

      if (versionError) {
        console.error('Error creating initial version:', versionError);
      }

      await apiClient.logRequest('POST', '/prompts', request);

      await supabase.from('analytics_events').insert({
        event_type: 'prompt_create',
        event_name: 'Prompt Created',
        user_id: user.id,
        prompt_id: data.id,
        properties: {
          title: request.title,
          type: request.prompt_type,
        },
      });

      return apiClient.createSuccessResponse(
        data as Prompt,
        'Prompt created successfully'
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async listPrompts(
    pagination?: PaginationParams,
    sort?: SortParams,
    filters?: FilterParams
  ): Promise<PaginatedResponse<Prompt>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { page, limit, offset } = apiClient.validatePaginationParams(
        pagination?.page,
        pagination?.limit
      );

      let query = supabase
        .from('prompts')
        .select('*', { count: 'exact' })
        .eq('is_archived', false);

      if (filters?.role) {
        query = query.eq('role', filters.role);
      }

      if (filters?.department) {
        query = query.eq('department', filters.department);
      }

      if (filters?.workflow) {
        query = query.eq('workflow', filters.workflow);
      }

      if (filters?.type) {
        query = query.eq('prompt_type', filters.type);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.visibility) {
        query = query.eq('visibility', filters.visibility);
      }

      if (filters?.author_id) {
        query = query.eq('author_id', filters.author_id);
      }

      if (filters?.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,content.ilike.%${filters.search}%`
        );
      }

      query = query.or(
        `visibility.eq.public,author_id.eq.${user.id},visibility.eq.private`
      );

      const sortBy = sort?.sortBy || 'created_at';
      const sortOrder = sort?.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      await apiClient.logRequest('GET', '/prompts', { pagination, sort, filters });

      return {
        data: (data || []) as Prompt[],
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

  async getPromptById(id: string): Promise<ApiResponse<PromptWithVersions>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: prompt, error: promptError } = await supabase
        .from('prompts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (promptError) throw promptError;
      if (!prompt) {
        throw new Error('Prompt not found');
      }

      if (
        prompt.visibility === 'private' &&
        prompt.author_id !== user.id &&
        prompt.created_by !== user.id
      ) {
        throw new Error('Unauthorized: Cannot access private prompt');
      }

      const { data: versions, error: versionsError } = await supabase
        .from('prompt_versions')
        .select('*')
        .eq('prompt_id', id)
        .order('version_number', { ascending: false });

      if (versionsError) throw versionsError;

      await supabase.from('analytics_events').insert({
        event_type: 'prompt_view',
        event_name: 'Prompt Viewed',
        user_id: user.id,
        prompt_id: id,
      });

      await apiClient.logRequest('GET', `/prompts/${id}`);

      const promptWithVersions: PromptWithVersions = {
        ...(prompt as Prompt),
        versions: (versions || []) as PromptVersion[],
      };

      return apiClient.createSuccessResponse(
        promptWithVersions,
        'Prompt retrieved successfully'
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async updatePrompt(
    id: string,
    request: UpdatePromptRequest
  ): Promise<ApiResponse<Prompt>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: existingPrompt, error: fetchError } = await supabase
        .from('prompts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!existingPrompt) {
        throw new Error('Prompt not found');
      }

      if (
        existingPrompt.author_id !== user.id &&
        existingPrompt.created_by !== user.id
      ) {
        const hasPermission = await apiClient.checkAuthorization(
          user.id,
          'prompt',
          'update'
        );
        if (!hasPermission) {
          throw new Error('Unauthorized: Cannot update this prompt');
        }
      }

      const updateData: Partial<Prompt> = {};

      if (request.title !== undefined) updateData.title = request.title;
      if (request.description !== undefined) updateData.description = request.description;
      if (request.content !== undefined) updateData.content = request.content;
      if (request.role !== undefined) updateData.role = request.role;
      if (request.department !== undefined) updateData.department = request.department;
      if (request.workflow !== undefined) updateData.workflow = request.workflow;
      if (request.prompt_type !== undefined) updateData.prompt_type = request.prompt_type;
      if (request.status !== undefined) updateData.status = request.status;
      if (request.visibility !== undefined) updateData.visibility = request.visibility;
      if (request.department_id !== undefined) updateData.department_id = request.department_id;
      if (request.team_id !== undefined) updateData.team_id = request.team_id;
      if (request.is_template !== undefined) updateData.is_template = request.is_template;
      if (request.tags !== undefined) updateData.tags = request.tags;
      if (request.metadata !== undefined) updateData.metadata = request.metadata;

      const { data, error } = await supabase
        .from('prompts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (request.content && request.content !== existingPrompt.content) {
        const { data: versions } = await supabase
          .from('prompt_versions')
          .select('version_number')
          .eq('prompt_id', id)
          .order('version_number', { ascending: false })
          .limit(1);

        const nextVersion = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

        await supabase.from('prompt_versions').insert({
          prompt_id: id,
          version_number: nextVersion,
          title: request.title || existingPrompt.title,
          prompt_text: request.content,
          change_summary: 'Updated prompt content',
          change_type: 'minor',
          author_id: user.id,
        });
      }

      await apiClient.logRequest('PUT', `/prompts/${id}`, request);

      await supabase.from('analytics_events').insert({
        event_type: 'prompt_edit',
        event_name: 'Prompt Updated',
        user_id: user.id,
        prompt_id: id,
        properties: {
          changes: Object.keys(updateData),
        },
      });

      return apiClient.createSuccessResponse(
        data as Prompt,
        'Prompt updated successfully'
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async deletePrompt(id: string): Promise<ApiResponse<null>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: existingPrompt, error: fetchError } = await supabase
        .from('prompts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!existingPrompt) {
        throw new Error('Prompt not found');
      }

      if (
        existingPrompt.author_id !== user.id &&
        existingPrompt.created_by !== user.id
      ) {
        const hasPermission = await apiClient.checkAuthorization(
          user.id,
          'prompt',
          'delete'
        );
        if (!hasPermission) {
          throw new Error('Unauthorized: Cannot delete this prompt');
        }
      }

      const { error } = await supabase
        .from('prompts')
        .update({
          is_archived: true,
          status: 'archived',
          archived_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      await apiClient.logRequest('DELETE', `/prompts/${id}`);

      await supabase.from('analytics_events').insert({
        event_type: 'prompt_delete',
        event_name: 'Prompt Archived',
        user_id: user.id,
        prompt_id: id,
      });

      return apiClient.createSuccessResponse(
        null,
        'Prompt archived successfully'
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async getPromptVersions(
    id: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<PromptVersion>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: prompt, error: promptError } = await supabase
        .from('prompts')
        .select('visibility, author_id, created_by')
        .eq('id', id)
        .maybeSingle();

      if (promptError) throw promptError;
      if (!prompt) {
        throw new Error('Prompt not found');
      }

      if (
        prompt.visibility === 'private' &&
        prompt.author_id !== user.id &&
        prompt.created_by !== user.id
      ) {
        throw new Error('Unauthorized: Cannot access prompt versions');
      }

      const { page, limit, offset } = apiClient.validatePaginationParams(
        pagination?.page,
        pagination?.limit
      );

      const { data, error, count } = await supabase
        .from('prompt_versions')
        .select('*', { count: 'exact' })
        .eq('prompt_id', id)
        .order('version_number', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      await apiClient.logRequest('GET', `/prompts/${id}/versions`, { pagination });

      return {
        data: (data || []) as PromptVersion[],
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

  async revertPrompt(
    id: string,
    request: RevertPromptRequest
  ): Promise<ApiResponse<Prompt>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: existingPrompt, error: promptError } = await supabase
        .from('prompts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (promptError) throw promptError;
      if (!existingPrompt) {
        throw new Error('Prompt not found');
      }

      if (
        existingPrompt.author_id !== user.id &&
        existingPrompt.created_by !== user.id
      ) {
        const hasPermission = await apiClient.checkAuthorization(
          user.id,
          'prompt',
          'update'
        );
        if (!hasPermission) {
          throw new Error('Unauthorized: Cannot revert this prompt');
        }
      }

      const { data: version, error: versionError } = await supabase
        .from('prompt_versions')
        .select('*')
        .eq('id', request.version_id)
        .eq('prompt_id', id)
        .maybeSingle();

      if (versionError) throw versionError;
      if (!version) {
        throw new Error('Version not found');
      }

      const { data, error: updateError } = await supabase
        .from('prompts')
        .update({
          title: version.title,
          content: version.prompt_text,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      const { data: versions } = await supabase
        .from('prompt_versions')
        .select('version_number')
        .eq('prompt_id', id)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersion = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

      await supabase.from('prompt_versions').insert({
        prompt_id: id,
        version_number: nextVersion,
        title: version.title,
        prompt_text: version.prompt_text,
        change_summary: `Reverted to version ${version.version_number}${request.reason ? `: ${request.reason}` : ''}`,
        change_type: 'rollback',
        author_id: user.id,
      });

      await apiClient.logRequest('POST', `/prompts/${id}/revert`, request);

      await supabase.from('analytics_events').insert({
        event_type: 'other',
        event_name: 'Prompt Reverted',
        user_id: user.id,
        prompt_id: id,
        properties: {
          version_id: request.version_id,
          version_number: version.version_number,
          reason: request.reason,
        },
      });

      return apiClient.createSuccessResponse(
        data as Prompt,
        `Prompt reverted to version ${version.version_number}`
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }
}

export const promptsApi = PromptsApi.getInstance();
