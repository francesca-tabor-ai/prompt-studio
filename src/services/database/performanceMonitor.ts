import { supabase } from '../../lib/supabase';
import { queryOptimizer } from './queryOptimizer';
import { queryCache } from './queryCache';
import { connectionPool } from './connectionPool';

export interface PerformanceMetrics {
  queries: {
    total: number;
    slow: number;
    cached: number;
    avgExecutionTime: number;
  };
  cache: {
    hitRate: number;
    entries: number;
    totalHits: number;
  };
  connections: {
    total: number;
    active: number;
    idle: number;
  };
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;

  private constructor() {
    this.startMonitoring();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const [slowQueries, cacheStats, poolStats] = await Promise.all([
      queryOptimizer.getSlowQueries(1000),
      queryCache.getCacheStats(),
      Promise.resolve(connectionPool.getStats()),
    ]);

    const allMetrics = queryOptimizer.getQueryMetrics();

    const totalQueries = allMetrics.length;
    const cachedQueries = allMetrics.filter((m) => m.cacheHit).length;
    const avgTime =
      allMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries || 0;

    return {
      queries: {
        total: totalQueries,
        slow: slowQueries.length,
        cached: cachedQueries,
        avgExecutionTime: avgTime,
      },
      cache: {
        hitRate: (cachedQueries / totalQueries) * 100 || 0,
        entries: cacheStats.dbEntries,
        totalHits: cacheStats.totalHits,
      },
      connections: {
        total: poolStats.total,
        active: poolStats.active,
        idle: poolStats.idle,
      },
    };
  }

  async getSlowQueries(limit: number = 20): Promise<any[]> {
    return queryOptimizer.getSlowQueries(1000);
  }

  async getQueryStats(queryName: string): Promise<any> {
    const metrics = queryOptimizer.getQueryMetrics(queryName);

    if (metrics.length === 0) {
      return null;
    }

    const totalTime = metrics.reduce((sum, m) => sum + m.executionTime, 0);
    const totalRows = metrics.reduce((sum, m) => sum + m.rowsReturned, 0);
    const cacheHits = metrics.filter((m) => m.cacheHit).length;

    return {
      queryName,
      executions: metrics.length,
      avgExecutionTime: totalTime / metrics.length,
      minExecutionTime: Math.min(...metrics.map((m) => m.executionTime)),
      maxExecutionTime: Math.max(...metrics.map((m) => m.executionTime)),
      avgRowsReturned: totalRows / metrics.length,
      cacheHitRate: (cacheHits / metrics.length) * 100,
    };
  }

  async analyzeTablePerformance(): Promise<any[]> {
    const tables = [
      'prompts',
      'prompt_versions',
      'activity_logs',
      'notifications',
      'secrets',
      'api_keys',
    ];

    const results: any[] = [];

    for (const table of tables) {
      try {
        const startTime = Date.now();

        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        const queryTime = Date.now() - startTime;

        results.push({
          table,
          rowCount: count || 0,
          countQueryTime: queryTime,
        });
      } catch (error) {
        console.error(`Error analyzing table ${table}:`, error);
      }
    }

    return results;
  }

  async detectNPlusOneQueries(): Promise<any[]> {
    const metrics = queryOptimizer.getQueryMetrics();

    const queryGroups = new Map<string, number>();

    for (const metric of metrics) {
      const baseQuery = metric.queryName.split(':')[0];
      queryGroups.set(baseQuery, (queryGroups.get(baseQuery) || 0) + 1);
    }

    const nPlusOne: any[] = [];

    for (const [queryName, count] of queryGroups.entries()) {
      if (count > 10) {
        nPlusOne.push({
          queryName,
          executionCount: count,
          avgTime: queryOptimizer.getAverageExecutionTime(queryName),
          recommendation: 'Consider batch loading or JOIN',
        });
      }
    }

    return nPlusOne;
  }

  async getRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];

    const slowQueries = await this.getSlowQueries(10);

    if (slowQueries.length > 5) {
      recommendations.push(
        `${slowQueries.length} slow queries detected. Consider adding indexes or optimizing query logic.`
      );
    }

    const metrics = await this.getPerformanceMetrics();

    if (metrics.cache.hitRate < 50) {
      recommendations.push(
        `Cache hit rate is ${metrics.cache.hitRate.toFixed(2)}%. Consider caching more frequently accessed queries.`
      );
    }

    if (metrics.connections.active / metrics.connections.total > 0.8) {
      recommendations.push(
        'Connection pool utilization is high. Consider increasing max connections.'
      );
    }

    const nPlusOne = await this.detectNPlusOneQueries();

    if (nPlusOne.length > 0) {
      recommendations.push(
        `${nPlusOne.length} potential N+1 query patterns detected. Implement batch loading.`
      );
    }

    return recommendations;
  }

  async generatePerformanceReport(): Promise<any> {
    const [metrics, slowQueries, tableStats, nPlusOne, recommendations] =
      await Promise.all([
        this.getPerformanceMetrics(),
        this.getSlowQueries(10),
        this.analyzeTablePerformance(),
        this.detectNPlusOneQueries(),
        this.getRecommendations(),
      ]);

    return {
      summary: {
        totalQueries: metrics.queries.total,
        slowQueries: metrics.queries.slow,
        avgExecutionTime: metrics.queries.avgExecutionTime.toFixed(2),
        cacheHitRate: metrics.cache.hitRate.toFixed(2),
      },
      slowQueries: slowQueries.slice(0, 10),
      tablePerformance: tableStats,
      nPlusOneIssues: nPlusOne,
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }

  private startMonitoring(): void {
    setInterval(async () => {
      await this.collectMetrics();
    }, 5 * 60 * 1000);
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getPerformanceMetrics();

      console.log('Performance Metrics:', {
        queries: metrics.queries.total,
        slow: metrics.queries.slow,
        cacheHitRate: `${metrics.cache.hitRate.toFixed(2)}%`,
        activeConnections: metrics.connections.active,
      });
    } catch (error) {
      console.error('Failed to collect metrics:', error);
    }
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();
