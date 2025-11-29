import { supabase } from '../lib/supabase';

export interface SearchFilters {
  roles?: string[];
  departments?: string[];
  workflows?: string[];
  tasks?: string[];
  types?: string[];
  statuses?: string[];
  query?: string;
  author_id?: string;
  visibility?: string;
}

export interface SearchOptions {
  sortBy?: 'relevance' | 'date' | 'popularity' | 'rating';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  content: string;
  role: string;
  department: string;
  workflow: string;
  prompt_type: string;
  status: string;
  usage_count: number;
  rating_average: number;
  created_at: string;
  relevance_score?: number;
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface SearchFacets {
  roles: FacetCount[];
  departments: FacetCount[];
  workflows: FacetCount[];
  types: FacetCount[];
  statuses: FacetCount[];
}

export class SearchService {
  private static instance: SearchService;
  private cacheTimeout = 5 * 60 * 1000;

  private constructor() {}

  static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  async search(
    filters: SearchFilters,
    options: SearchOptions = {}
  ): Promise<{
    results: SearchResult[];
    total: number;
    facets: SearchFacets;
  }> {
    const cacheKey = this.generateCacheKey(filters, options);

    const cachedResult = await this.getCachedResult(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const {
      sortBy = 'relevance',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = options;

    const offset = (page - 1) * limit;

    let query = supabase
      .from('prompts')
      .select('*', { count: 'exact' })
      .eq('is_archived', false);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      query = query.or(`visibility.eq.public,author_id.eq.${user.id}`);
    } else {
      query = query.eq('visibility', 'public');
    }

    if (filters.query) {
      query = query.textSearch('fts', filters.query, {
        type: 'websearch',
        config: 'english',
      });
    }

    if (filters.roles && filters.roles.length > 0) {
      query = query.in('role', filters.roles);
    }

    if (filters.departments && filters.departments.length > 0) {
      query = query.in('department', filters.departments);
    }

    if (filters.workflows && filters.workflows.length > 0) {
      query = query.in('workflow', filters.workflows);
    }

    if (filters.types && filters.types.length > 0) {
      query = query.in('prompt_type', filters.types);
    }

    if (filters.statuses && filters.statuses.length > 0) {
      query = query.in('status', filters.statuses);
    }

    if (filters.author_id) {
      query = query.eq('author_id', filters.author_id);
    }

    if (filters.visibility) {
      query = query.eq('visibility', filters.visibility);
    }

    switch (sortBy) {
      case 'date':
        query = query.order('created_at', { ascending: sortOrder === 'asc' });
        break;
      case 'popularity':
        query = query.order('usage_count', { ascending: sortOrder === 'asc' });
        break;
      case 'rating':
        query = query.order('rating_average', { ascending: sortOrder === 'asc' });
        break;
      case 'relevance':
      default:
        if (filters.query) {
          query = query.order('created_at', { ascending: false });
        } else {
          query = query.order('created_at', { ascending: false });
        }
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const facets = await this.computeFacets(filters);

    const result = {
      results: (data || []) as SearchResult[],
      total: count || 0,
      facets,
    };

    await this.cacheResult(cacheKey, result);

    await this.logSearch(filters, count || 0, user?.id);

    return result;
  }

  async computeFacets(activeFilters: SearchFilters = {}): Promise<SearchFacets> {
    await this.ensureFacetsComputed();

    const { data: facetData } = await supabase
      .from('filter_facets')
      .select('*')
      .order('prompt_count', { ascending: false });

    const facets: SearchFacets = {
      roles: [],
      departments: [],
      workflows: [],
      types: [],
      statuses: [],
    };

    if (facetData) {
      for (const facet of facetData) {
        const item = { value: facet.facet_value, count: facet.prompt_count };

        switch (facet.facet_type) {
          case 'role':
            facets.roles.push(item);
            break;
          case 'department':
            facets.departments.push(item);
            break;
          case 'workflow':
            facets.workflows.push(item);
            break;
          case 'type':
            facets.types.push(item);
            break;
          case 'status':
            facets.statuses.push(item);
            break;
        }
      }
    }

    return facets;
  }

  private async ensureFacetsComputed(): Promise<void> {
    const { data: facets } = await supabase
      .from('filter_facets')
      .select('last_computed_at')
      .order('last_computed_at', { ascending: false })
      .limit(1);

    const shouldRecompute = !facets || facets.length === 0 ||
      (facets[0] && new Date(facets[0].last_computed_at).getTime() < Date.now() - 30 * 60 * 1000);

    if (shouldRecompute) {
      await supabase.rpc('compute_filter_facets');
    }
  }

  private generateCacheKey(filters: SearchFilters, options: SearchOptions): string {
    const filterStr = JSON.stringify(filters);
    const optionsStr = JSON.stringify(options);
    return `search:${btoa(filterStr + optionsStr)}`;
  }

  private async getCachedResult(cacheKey: string): Promise<any | null> {
    await supabase.rpc('clean_expired_cache');

    const { data, error } = await supabase
      .from('search_cache')
      .select('result_data, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    if (error || !data) return null;

    if (new Date(data.expires_at) < new Date()) {
      return null;
    }

    await supabase
      .from('search_cache')
      .update({
        hit_count: supabase.sql`hit_count + 1`,
        last_accessed_at: new Date().toISOString(),
      })
      .eq('cache_key', cacheKey);

    return data.result_data;
  }

  private async cacheResult(cacheKey: string, result: any): Promise<void> {
    const expiresAt = new Date(Date.now() + this.cacheTimeout).toISOString();

    await supabase
      .from('search_cache')
      .upsert({
        cache_key: cacheKey,
        search_params: {},
        result_data: result,
        result_count: result.total,
        expires_at: expiresAt,
        last_accessed_at: new Date().toISOString(),
      });
  }

  private async logSearch(
    filters: SearchFilters,
    resultsCount: number,
    userId?: string
  ): Promise<void> {
    await supabase.from('search_analytics').insert({
      user_id: userId,
      search_query: filters.query,
      filters_applied: filters,
      results_count: resultsCount,
    });
  }

  async clearCache(): Promise<void> {
    await supabase.from('search_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  async getPopularSearches(limit: number = 10): Promise<Array<{ query: string; count: number }>> {
    const { data } = await supabase
      .from('search_analytics')
      .select('search_query')
      .not('search_query', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (!data) return [];

    const queryCounts = new Map<string, number>();
    for (const item of data) {
      if (item.search_query) {
        queryCounts.set(item.search_query, (queryCounts.get(item.search_query) || 0) + 1);
      }
    }

    return Array.from(queryCounts.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

export const searchService = SearchService.getInstance();
