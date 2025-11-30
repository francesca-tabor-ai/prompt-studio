import { supabase } from '../../lib/supabase';
import { cacheManager } from './CacheManager';

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  avgResponseTime: number;
  memoryUsage: number;
  keyCount: number;
  evictionCount: number;
}

export interface CacheAlert {
  type: 'low_hit_rate' | 'high_memory' | 'slow_response' | 'high_eviction';
  severity: 'warning' | 'critical';
  message: string;
  metric: number;
  threshold: number;
}

class CacheMonitor {
  private static instance: CacheMonitor;
  private alerts: CacheAlert[] = [];

  private thresholds = {
    lowHitRate: 50,
    highMemory: 80,
    slowResponse: 100,
    highEviction: 100,
  };

  private constructor() {
    this.startMonitoring();
  }

  static getInstance(): CacheMonitor {
    if (!CacheMonitor.instance) {
      CacheMonitor.instance = new CacheMonitor();
    }
    return CacheMonitor.instance;
  }

  async getMetrics(): Promise<CacheMetrics> {
    const stats = await cacheManager.getStats();

    const totalRequests = stats.memory.hits + stats.memory.misses;
    const hitRate = totalRequests > 0 ? stats.memory.hitRate : 0;
    const missRate = 100 - hitRate;

    return {
      hitRate,
      missRate,
      totalRequests,
      avgResponseTime: 0,
      memoryUsage: 0,
      keyCount: stats.memory.keys,
      evictionCount: 0,
    };
  }

  async getHitRate(period: 'hour' | 'day' | 'week' = 'hour'): Promise<number> {
    const intervals = {
      hour: '1 hour',
      day: '1 day',
      week: '7 days',
    };

    const { data } = await supabase
      .from('cache_statistics')
      .select('hit_count, miss_count')
      .gte('timestamp', `now() - interval '${intervals[period]}'`);

    if (!data || data.length === 0) {
      return 0;
    }

    const totalHits = data.reduce((sum, row) => sum + (row.hit_count || 0), 0);
    const totalMisses = data.reduce((sum, row) => sum + (row.miss_count || 0), 0);
    const total = totalHits + totalMisses;

    return total > 0 ? (totalHits / total) * 100 : 0;
  }

  async getTopKeys(limit: number = 10): Promise<any[]> {
    const { data } = await supabase
      .from('cache_entries')
      .select('cache_key, hit_count, last_accessed_at')
      .order('hit_count', { ascending: false })
      .limit(limit);

    return data || [];
  }

  async getInvalidationHistory(limit: number = 50): Promise<any[]> {
    const { data } = await supabase
      .from('cache_invalidation_log')
      .select('*')
      .order('invalidated_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  async analyzePerformance(): Promise<any> {
    const metrics = await this.getMetrics();
    const hitRateHour = await this.getHitRate('hour');
    const hitRateDay = await this.getHitRate('day');
    const topKeys = await this.getTopKeys(10);

    const analysis = {
      overall: {
        status: this.getHealthStatus(hitRateHour),
        hitRate: hitRateHour.toFixed(2),
        totalRequests: metrics.totalRequests,
        keyCount: metrics.keyCount,
      },
      trends: {
        hourly: hitRateHour.toFixed(2),
        daily: hitRateDay.toFixed(2),
        trend: hitRateHour > hitRateDay ? 'improving' : 'declining',
      },
      topPerformers: topKeys.slice(0, 5),
      alerts: this.alerts,
    };

    return analysis;
  }

  async checkHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: CacheMetrics;
  }> {
    const metrics = await this.getMetrics();
    const issues: string[] = [];

    if (metrics.hitRate < this.thresholds.lowHitRate) {
      issues.push(
        `Low cache hit rate: ${metrics.hitRate.toFixed(2)}% (threshold: ${this.thresholds.lowHitRate}%)`
      );
    }

    if (metrics.avgResponseTime > this.thresholds.slowResponse) {
      issues.push(
        `Slow cache response time: ${metrics.avgResponseTime}ms (threshold: ${this.thresholds.slowResponse}ms)`
      );
    }

    return {
      healthy: issues.length === 0,
      issues,
      metrics,
    };
  }

  async generateReport(period: 'hour' | 'day' | 'week' = 'day'): Promise<any> {
    const intervals = {
      hour: '1 hour',
      day: '1 day',
      week: '7 days',
    };

    const { data: stats } = await supabase
      .from('cache_statistics')
      .select('*')
      .gte('timestamp', `now() - interval '${intervals[period]}'`)
      .order('timestamp', { ascending: false });

    const { data: invalidations } = await supabase
      .from('cache_invalidation_log')
      .select('*')
      .gte('invalidated_at', `now() - interval '${intervals[period]}'`);

    const totalHits = stats?.reduce((sum, s) => sum + (s.hit_count || 0), 0) || 0;
    const totalMisses = stats?.reduce((sum, s) => sum + (s.miss_count || 0), 0) || 0;
    const total = totalHits + totalMisses;
    const hitRate = total > 0 ? (totalHits / total) * 100 : 0;

    const invalidationsByType: Record<string, number> = {};

    if (invalidations) {
      for (const inv of invalidations) {
        invalidationsByType[inv.invalidation_type] =
          (invalidationsByType[inv.invalidation_type] || 0) + 1;
      }
    }

    return {
      period,
      summary: {
        totalRequests: total,
        hits: totalHits,
        misses: totalMisses,
        hitRate: hitRate.toFixed(2),
        invalidations: invalidations?.length || 0,
      },
      invalidationsByType,
      topKeys: await this.getTopKeys(10),
      alerts: this.alerts,
      generatedAt: new Date().toISOString(),
    };
  }

  setThresholds(thresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  getAlerts(): CacheAlert[] {
    return this.alerts;
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  private getHealthStatus(hitRate: number): string {
    if (hitRate >= 80) return 'excellent';
    if (hitRate >= 60) return 'good';
    if (hitRate >= 40) return 'fair';
    return 'poor';
  }

  private startMonitoring(): void {
    setInterval(async () => {
      await this.performHealthCheck();
    }, 5 * 60 * 1000);
  }

  private async performHealthCheck(): Promise<void> {
    const metrics = await this.getMetrics();

    this.alerts = [];

    if (metrics.hitRate < this.thresholds.lowHitRate) {
      this.alerts.push({
        type: 'low_hit_rate',
        severity: metrics.hitRate < 30 ? 'critical' : 'warning',
        message: `Cache hit rate is ${metrics.hitRate.toFixed(2)}%`,
        metric: metrics.hitRate,
        threshold: this.thresholds.lowHitRate,
      });
    }

    if (metrics.avgResponseTime > this.thresholds.slowResponse) {
      this.alerts.push({
        type: 'slow_response',
        severity: metrics.avgResponseTime > 200 ? 'critical' : 'warning',
        message: `Cache response time is ${metrics.avgResponseTime}ms`,
        metric: metrics.avgResponseTime,
        threshold: this.thresholds.slowResponse,
      });
    }

    if (this.alerts.length > 0) {
      console.warn('Cache health alerts:', this.alerts);
    }
  }
}

export const cacheMonitor = CacheMonitor.getInstance();
