import { supabase } from '../../lib/supabase';
import { cacheManager } from './CacheManager';
import { cacheWarmer } from './CacheWarmer';
import { cacheMonitor } from './CacheMonitor';

export interface CacheAdminAPI {
  invalidateKey(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<number>;
  invalidateTag(tag: string): Promise<number>;
  clearAll(): Promise<void>;
  getStats(): Promise<any>;
  getReport(period: 'hour' | 'day' | 'week'): Promise<any>;
  warmCache(configName: string): Promise<void>;
  listWarmingConfigs(): Promise<any[]>;
}

class CacheAdmin implements CacheAdminAPI {
  private static instance: CacheAdmin;

  private constructor() {}

  static getInstance(): CacheAdmin {
    if (!CacheAdmin.instance) {
      CacheAdmin.instance = new CacheAdmin();
    }
    return CacheAdmin.instance;
  }

  async invalidateKey(key: string): Promise<void> {
    await cacheManager.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<number> {
    return cacheManager.invalidatePattern(pattern);
  }

  async invalidateTag(tag: string): Promise<number> {
    return cacheManager.invalidateByTag(tag);
  }

  async clearAll(): Promise<void> {
    await cacheManager.clear();
  }

  async getStats(): Promise<any> {
    return cacheManager.getStats();
  }

  async getReport(period: 'hour' | 'day' | 'week' = 'day'): Promise<any> {
    return cacheMonitor.generateReport(period);
  }

  async warmCache(configName: string): Promise<void> {
    await cacheWarmer.warmCache(configName);
  }

  async listWarmingConfigs(): Promise<any[]> {
    return cacheWarmer.listWarmingConfigs();
  }

  async getTopKeys(limit: number = 20): Promise<any[]> {
    return cacheMonitor.getTopKeys(limit);
  }

  async getInvalidationHistory(limit: number = 50): Promise<any[]> {
    return cacheMonitor.getInvalidationHistory(limit);
  }

  async analyzePerformance(): Promise<any> {
    return cacheMonitor.analyzePerformance();
  }

  async checkHealth(): Promise<any> {
    return cacheMonitor.checkHealth();
  }

  async getKeyInfo(key: string): Promise<any> {
    const { data } = await supabase
      .from('cache_entries')
      .select('*')
      .eq('cache_key', key)
      .single();

    if (!data) {
      return null;
    }

    const { data: tags } = await supabase
      .from('cache_tags')
      .select('tag_name')
      .eq('cache_key', key);

    return {
      key: data.cache_key,
      layer: data.cache_layer,
      version: data.version,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      hitCount: data.hit_count,
      lastAccessedAt: data.last_accessed_at,
      tags: tags?.map((t) => t.tag_name) || [],
      metadata: data.metadata,
    };
  }

  async touchKey(key: string, ttlSeconds: number): Promise<void> {
    await cacheManager.touch(key, ttlSeconds);
  }

  async setKeyVersion(key: string, version: number): Promise<void> {
    await supabase
      .from('cache_entries')
      .update({ version })
      .eq('cache_key', key);
  }

  async bulkInvalidate(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.invalidateKey(key);
    }
  }

  async getLayerStats(): Promise<any> {
    const { data } = await supabase
      .from('cache_statistics')
      .select('cache_layer, hit_count, miss_count')
      .gte('timestamp', `now() - interval '1 hour'`);

    const stats: Record<string, any> = {
      memory: { hits: 0, misses: 0 },
      distributed: { hits: 0, misses: 0 },
      database: { hits: 0, misses: 0 },
    };

    if (data) {
      for (const row of data) {
        if (stats[row.cache_layer]) {
          stats[row.cache_layer].hits += row.hit_count || 0;
          stats[row.cache_layer].misses += row.miss_count || 0;
        }
      }
    }

    for (const layer of Object.keys(stats)) {
      const total = stats[layer].hits + stats[layer].misses;
      stats[layer].hitRate =
        total > 0 ? ((stats[layer].hits / total) * 100).toFixed(2) : 0;
    }

    return stats;
  }

  async exportConfig(): Promise<any> {
    const warmingConfigs = await this.listWarmingConfigs();

    const { data: policies } = await supabase
      .from('cache_warming_config')
      .select('*');

    return {
      warmingConfigs,
      thresholds: cacheMonitor['thresholds'],
      exportedAt: new Date().toISOString(),
    };
  }

  async importConfig(config: any): Promise<void> {
    if (config.warmingConfigs) {
      for (const warmingConfig of config.warmingConfigs) {
        await cacheWarmer.createWarmingConfig({
          name: warmingConfig.config_name,
          keyPattern: warmingConfig.cache_key_pattern,
          queryFunction: warmingConfig.query_function,
          queryParams: warmingConfig.query_params,
          warmOnStartup: warmingConfig.warm_on_startup,
          warmOnSchedule: warmingConfig.warm_on_schedule,
          priority: warmingConfig.priority,
        });
      }
    }

    if (config.thresholds) {
      cacheMonitor.setThresholds(config.thresholds);
    }
  }
}

export const cacheAdmin = CacheAdmin.getInstance();
