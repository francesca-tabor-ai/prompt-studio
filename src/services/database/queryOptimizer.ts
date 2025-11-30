import { supabase } from '../../lib/supabase';
import { queryCache } from './queryCache';

export interface QueryOptions {
  cache?: boolean;
  cacheTTL?: number;
  batchLoad?: boolean;
  timeout?: number;
}

export interface QueryMetrics {
  queryName: string;
  executionTime: number;
  rowsReturned: number;
  cacheHit: boolean;
}

class QueryOptimizer {
  private static instance: QueryOptimizer;
  private queryMetrics: Map<string, QueryMetrics[]> = new Map();

  private constructor() {}

  static getInstance(): QueryOptimizer {
    if (!QueryOptimizer.instance) {
      QueryOptimizer.instance = new QueryOptimizer();
    }
    return QueryOptimizer.instance;
  }

  async executeQuery<T>(
    queryName: string,
    queryFn: () => Promise<{ data: T | null; error: any }>,
    options: QueryOptions = {}
  ): Promise<T | null> {
    const startTime = Date.now();

    if (options.cache) {
      const cacheKey = queryCache.generateKey(queryName, {});
      const cached = await queryCache.get<T>(cacheKey);

      if (cached !== null) {
        this.recordMetrics(queryName, Date.now() - startTime, 0, true);
        return cached;
      }
    }

    const { data, error } = await queryFn();

    if (error) {
      throw new Error(error.message);
    }

    const executionTime = Date.now() - startTime;
    const rowCount = Array.isArray(data) ? data.length : data ? 1 : 0;

    this.recordMetrics(queryName, executionTime, rowCount, false);

    if (options.cache && data !== null) {
      const cacheKey = queryCache.generateKey(queryName, {});
      await queryCache.set(cacheKey, data, options.cacheTTL || 300);
    }

    await this.logPerformance(queryName, '', executionTime, rowCount, false);

    return data;
  }

  async batchLoad<T, K>(
    keys: K[],
    loadFn: (keys: K[]) => Promise<T[]>,
    keyExtractor: (item: T) => K
  ): Promise<Map<K, T>> {
    const results = await loadFn(keys);

    const resultMap = new Map<K, T>();

    for (const item of results) {
      const key = keyExtractor(item);
      resultMap.set(key, item);
    }

    return resultMap;
  }

  async optimizeNPlusOne<T, R>(
    items: T[],
    relationKey: keyof T,
    loadRelations: (ids: any[]) => Promise<R[]>,
    relationIdKey: keyof R
  ): Promise<Map<any, R>> {
    const ids = items.map((item) => item[relationKey]);
    const uniqueIds = Array.from(new Set(ids));

    const relations = await loadRelations(uniqueIds);

    const relationMap = new Map<any, R>();

    for (const relation of relations) {
      relationMap.set(relation[relationIdKey], relation);
    }

    return relationMap;
  }

  private recordMetrics(
    queryName: string,
    executionTime: number,
    rowsReturned: number,
    cacheHit: boolean
  ): void {
    if (!this.queryMetrics.has(queryName)) {
      this.queryMetrics.set(queryName, []);
    }

    this.queryMetrics.get(queryName)!.push({
      queryName,
      executionTime,
      rowsReturned,
      cacheHit,
    });

    if (this.queryMetrics.get(queryName)!.length > 1000) {
      this.queryMetrics.get(queryName)!.shift();
    }
  }

  private async logPerformance(
    queryName: string,
    queryText: string,
    executionTime: number,
    rowsReturned: number,
    cacheHit: boolean
  ): Promise<void> {
    try {
      await supabase.rpc('log_query_performance', {
        p_query_name: queryName,
        p_query_text: queryText,
        p_execution_time_ms: executionTime,
        p_rows_returned: rowsReturned,
        p_cache_hit: cacheHit,
      });
    } catch (error) {
      console.error('Failed to log query performance:', error);
    }
  }

  getQueryMetrics(queryName?: string): QueryMetrics[] {
    if (queryName) {
      return this.queryMetrics.get(queryName) || [];
    }

    const allMetrics: QueryMetrics[] = [];

    for (const metrics of this.queryMetrics.values()) {
      allMetrics.push(...metrics);
    }

    return allMetrics;
  }

  getAverageExecutionTime(queryName: string): number {
    const metrics = this.queryMetrics.get(queryName);

    if (!metrics || metrics.length === 0) {
      return 0;
    }

    const total = metrics.reduce((sum, m) => sum + m.executionTime, 0);

    return total / metrics.length;
  }

  getCacheHitRate(queryName: string): number {
    const metrics = this.queryMetrics.get(queryName);

    if (!metrics || metrics.length === 0) {
      return 0;
    }

    const cacheHits = metrics.filter((m) => m.cacheHit).length;

    return (cacheHits / metrics.length) * 100;
  }

  async getSlowQueries(thresholdMs: number = 1000): Promise<any[]> {
    const { data } = await supabase.rpc('get_slow_queries', {
      p_threshold_ms: thresholdMs,
      p_limit: 50,
    });

    return data || [];
  }
}

export const queryOptimizer = QueryOptimizer.getInstance();
