import { tagService, type Tag, type TagSuggestion, type TagWithMetadata } from '../services/tagService';
import { apiClient } from './client';
import type { ApiResponse, PaginatedResponse } from './types';

export interface CreateTagRequest {
  name: string;
  description?: string;
  type?: string;
  color?: string;
  visibility?: string;
  keywords?: string[];
}

export interface AssignTagRequest {
  promptId: string;
  tagId: string;
  source?: 'manual' | 'auto_suggest' | 'ai_generated';
  confidence?: number;
}

export class TagsApi {
  private static instance: TagsApi;

  private constructor() {}

  static getInstance(): TagsApi {
    if (!TagsApi.instance) {
      TagsApi.instance = new TagsApi();
    }
    return TagsApi.instance;
  }

  async getAllTags(filters?: {
    type?: string;
    visibility?: string;
    systemOnly?: boolean;
  }): Promise<ApiResponse<Tag[]>> {
    try {
      const tags = await tagService.getAllTags(filters);

      await apiClient.logRequest('GET', '/tags', filters);

      return apiClient.createSuccessResponse(tags, `Retrieved ${tags.length} tags`);
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async searchTags(query: string, limit?: number): Promise<ApiResponse<Tag[]>> {
    try {
      const tags = await tagService.searchTags(query, limit);

      await apiClient.logRequest('GET', '/tags/search', { query, limit });

      return apiClient.createSuccessResponse(tags, `Found ${tags.length} matching tags`);
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async getTagById(id: string): Promise<ApiResponse<TagWithMetadata>> {
    try {
      const tag = await tagService.getTagById(id);

      if (!tag) {
        throw new Error('Tag not found');
      }

      await apiClient.logRequest('GET', `/tags/${id}`);

      return apiClient.createSuccessResponse(tag, 'Tag retrieved successfully');
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async getTagsByPromptId(promptId: string): Promise<ApiResponse<Tag[]>> {
    try {
      const tags = await tagService.getTagsByPromptId(promptId);

      return apiClient.createSuccessResponse(tags, `Retrieved ${tags.length} tags for prompt`);
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async assignTagToPrompt(request: AssignTagRequest): Promise<ApiResponse<null>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      await tagService.assignTagToPrompt(
        request.promptId,
        request.tagId,
        request.source,
        request.confidence
      );

      await apiClient.logRequest('POST', '/tags/assign', request);

      return apiClient.createSuccessResponse(null, 'Tag assigned successfully');
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async removeTagFromPrompt(promptId: string, tagId: string): Promise<ApiResponse<null>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      await tagService.removeTagFromPrompt(promptId, tagId);

      await apiClient.logRequest('DELETE', `/tags/assign`, { promptId, tagId });

      return apiClient.createSuccessResponse(null, 'Tag removed successfully');
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async suggestTagsForPrompt(
    promptId: string,
    content: string
  ): Promise<ApiResponse<TagSuggestion[]>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const suggestions = await tagService.suggestTagsForPrompt(promptId, content);

      if (suggestions.length > 0) {
        await tagService.saveSuggestions(promptId, suggestions);
      }

      await apiClient.logRequest('POST', '/tags/suggest', { promptId });

      return apiClient.createSuccessResponse(
        suggestions,
        `Generated ${suggestions.length} tag suggestions`
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async acceptSuggestion(promptId: string, tagId: string): Promise<ApiResponse<null>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      await tagService.acceptSuggestion(promptId, tagId);

      await apiClient.logRequest('POST', '/tags/accept-suggestion', { promptId, tagId });

      return apiClient.createSuccessResponse(null, 'Tag suggestion accepted');
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async createTag(request: CreateTagRequest): Promise<ApiResponse<Tag>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const tag = await tagService.createTag(request.name, {
        description: request.description,
        type: request.type,
        color: request.color,
        visibility: request.visibility,
        keywords: request.keywords,
      });

      await apiClient.logRequest('POST', '/tags', request);

      return apiClient.createSuccessResponse(
        tag,
        'Tag created and submitted for approval'
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async getTrendingTags(limit?: number): Promise<ApiResponse<Array<Tag & { trend: string }>>> {
    try {
      const tags = await tagService.getTrendingTags(limit);

      return apiClient.createSuccessResponse(tags, `Retrieved ${tags.length} trending tags`);
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async getTagAnalytics(tagId: string, days?: number): Promise<ApiResponse<any[]>> {
    try {
      const analytics = await tagService.getTagAnalytics(tagId, days);

      return apiClient.createSuccessResponse(
        analytics,
        `Retrieved ${days || 30} days of analytics`
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async getTagHierarchy(tagId: string): Promise<ApiResponse<any>> {
    try {
      const hierarchy = await tagService.getTagHierarchy(tagId);

      if (!hierarchy) {
        throw new Error('Tag not found');
      }

      return apiClient.createSuccessResponse(hierarchy, 'Tag hierarchy retrieved');
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }
}

export const tagsApi = TagsApi.getInstance();
