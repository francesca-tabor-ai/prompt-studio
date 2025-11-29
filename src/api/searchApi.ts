import { supabase } from '../lib/supabase';
import { apiClient } from './client';
import { searchService, type SearchFilters, type SearchOptions, type SearchResult, type SearchFacets } from '../services/searchService';
import type { ApiResponse, PaginatedResponse } from './types';

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  description: string;
  search_config: {
    filters: SearchFilters;
    options: SearchOptions;
  };
  is_default: boolean;
  is_shared: boolean;
  usage_count: number;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSavedSearchRequest {
  name: string;
  description?: string;
  filters: SearchFilters;
  options?: SearchOptions;
  is_default?: boolean;
  is_shared?: boolean;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  facets: SearchFacets;
  page: number;
  limit: number;
  totalPages: number;
}

export class SearchApi {
  private static instance: SearchApi;

  private constructor() {}

  static getInstance(): SearchApi {
    if (!SearchApi.instance) {
      SearchApi.instance = new SearchApi();
    }
    return SearchApi.instance;
  }

  async search(
    filters: SearchFilters = {},
    options: SearchOptions = {}
  ): Promise<ApiResponse<SearchResponse>> {
    try {
      const user = await apiClient.getCurrentUser();

      const page = options.page || 1;
      const limit = options.limit || 20;

      const startTime = Date.now();
      const result = await searchService.search(filters, options);
      const duration = Date.now() - startTime;

      await apiClient.logRequest('POST', '/search', { filters, options });

      return apiClient.createSuccessResponse(
        {
          results: result.results,
          total: result.total,
          facets: result.facets,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
        `Found ${result.total} prompts in ${duration}ms`
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async getFacets(filters: SearchFilters = {}): Promise<ApiResponse<SearchFacets>> {
    try {
      const facets = await searchService.computeFacets(filters);

      return apiClient.createSuccessResponse(facets, 'Facets computed successfully');
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async createSavedSearch(request: CreateSavedSearchRequest): Promise<ApiResponse<SavedSearch>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      if (request.is_default) {
        await supabase
          .from('saved_searches')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const { data, error } = await supabase
        .from('saved_searches')
        .insert({
          user_id: user.id,
          name: request.name,
          description: request.description || '',
          search_config: {
            filters: request.filters,
            options: request.options || {},
          },
          is_default: request.is_default || false,
          is_shared: request.is_shared || false,
        })
        .select()
        .single();

      if (error) throw error;

      await apiClient.logRequest('POST', '/saved-searches', request);

      return apiClient.createSuccessResponse(
        data as SavedSearch,
        'Saved search created successfully'
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async listSavedSearches(): Promise<PaginatedResponse<SavedSearch>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error, count } = await supabase
        .from('saved_searches')
        .select('*', { count: 'exact' })
        .or(`user_id.eq.${user.id},is_shared.eq.true`)
        .order('is_default', { ascending: false })
        .order('usage_count', { ascending: false });

      if (error) throw error;

      return {
        data: (data || []) as SavedSearch[],
        pagination: {
          page: 1,
          limit: count || 0,
          total: count || 0,
          totalPages: 1,
        },
        success: true,
      };
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async getSavedSearch(id: string): Promise<ApiResponse<SavedSearch>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('id', id)
        .or(`user_id.eq.${user.id},is_shared.eq.true`)
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error('Saved search not found');
      }

      return apiClient.createSuccessResponse(
        data as SavedSearch,
        'Saved search retrieved successfully'
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async updateSavedSearch(
    id: string,
    updates: Partial<CreateSavedSearchRequest>
  ): Promise<ApiResponse<SavedSearch>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: existing } = await supabase
        .from('saved_searches')
        .select('user_id')
        .eq('id', id)
        .single();

      if (!existing || existing.user_id !== user.id) {
        throw new Error('Unauthorized: Cannot update this saved search');
      }

      if (updates.is_default) {
        await supabase
          .from('saved_searches')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('id', id);
      }

      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.is_default !== undefined) updateData.is_default = updates.is_default;
      if (updates.is_shared !== undefined) updateData.is_shared = updates.is_shared;
      if (updates.filters !== undefined || updates.options !== undefined) {
        const { data: current } = await supabase
          .from('saved_searches')
          .select('search_config')
          .eq('id', id)
          .single();

        updateData.search_config = {
          filters: updates.filters || (current?.search_config as any)?.filters || {},
          options: updates.options || (current?.search_config as any)?.options || {},
        };
      }

      const { data, error } = await supabase
        .from('saved_searches')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await apiClient.logRequest('PUT', `/saved-searches/${id}`, updates);

      return apiClient.createSuccessResponse(
        data as SavedSearch,
        'Saved search updated successfully'
      );
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async deleteSavedSearch(id: string): Promise<ApiResponse<null>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: existing } = await supabase
        .from('saved_searches')
        .select('user_id')
        .eq('id', id)
        .single();

      if (!existing || existing.user_id !== user.id) {
        throw new Error('Unauthorized: Cannot delete this saved search');
      }

      const { error } = await supabase
        .from('saved_searches')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await apiClient.logRequest('DELETE', `/saved-searches/${id}`);

      return apiClient.createSuccessResponse(null, 'Saved search deleted successfully');
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async useSavedSearch(id: string): Promise<ApiResponse<SearchResponse>> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: savedSearch, error: fetchError } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('id', id)
        .or(`user_id.eq.${user.id},is_shared.eq.true`)
        .single();

      if (fetchError) throw fetchError;
      if (!savedSearch) {
        throw new Error('Saved search not found');
      }

      await supabase
        .from('saved_searches')
        .update({
          usage_count: (savedSearch.usage_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', id);

      const config = savedSearch.search_config as { filters: SearchFilters; options: SearchOptions };
      const result = await this.search(config.filters, config.options);

      return result;
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async getPopularSearches(limit: number = 10): Promise<ApiResponse<Array<{ query: string; count: number }>>> {
    try {
      const popular = await searchService.getPopularSearches(limit);

      return apiClient.createSuccessResponse(popular, 'Popular searches retrieved');
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }

  async clearSearchCache(): Promise<ApiResponse<null>> {
    try {
      await searchService.clearCache();

      return apiClient.createSuccessResponse(null, 'Search cache cleared');
    } catch (error) {
      const apiError = apiClient.handleError(error);
      throw apiError;
    }
  }
}

export const searchApi = SearchApi.getInstance();
