import { supabase } from '../../lib/supabase';

export type CacheLayer = 'memory' | 'distributed' | 'database';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  layer: CacheLayer;
  version: number;
  expiresAt: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface CacheOptions {
  ttl?: number;
  layer?: CacheLayer;
  tags?: string[];
  version?: number;
  metadata?: Record<string, any>;
}

class CacheManager {
  private static instance: CacheManager;
  private memoryCache: Map<string, { value: any; expiresAt: number; version: number }> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
  };

  private constructor() {
    this.startCleanup();
    this.startStatsReporting();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  async get<T>(key: string, version?: number): Promise<T | null> {
    const memoryCached = this.memoryCache.get(key);

    if (memoryCached && Date.now() < memoryCached.expiresAt) {
      if (!version || memoryCached.version === version) {
        this.stats.hits++;
        await this.recordAccess(key, true);
        return memoryCached.value as T;
      }
    }

    let query = supabase
      .from('cache_entries')
      .select('*')
      .eq('cache_key', key)
      .single();

    if (version) {
      query = query.eq('version', version);
    }

    const { data, error } = await query;

    if (error || !data) {
      this.stats.misses++;
      await this.recordAccess(key, false);
      return null;
    }

    if (new Date(data.expires_at) < new Date()) {
      await this.delete(key);
      this.stats.misses++;
      return null;
    }

    this.memoryCache.set(key, {
      value: data.cache_value,
      expiresAt: new Date(data.expires_at).getTime(),
      version: data.version,
    });

    this.stats.hits++;
    await this.recordAccess(key, true);

    return data.cache_value as T;
  }

  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const ttl = options.ttl || 300;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const layer = options.layer || 'memory';
    const version = options.version || 1;

    this.memoryCache.set(key, {
      value,
      expiresAt: expiresAt.getTime(),
      version,
    });

    if (layer !== 'memory') {
      await supabase.from('cache_entries').upsert({
        cache_key: key,
        cache_value: value,
        cache_layer: layer,
        version,
        expires_at: expiresAt.toISOString(),
        tags: options.tags || [],
        metadata: options.metadata || {},
      });

      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          await supabase.from('cache_tags').upsert({
            tag_name: tag,
            cache_key: key,
          });
        }
      }
    }

    this.stats.sets++;
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);

    await supabase.from('cache_entries').delete().eq('cache_key', key);

    await supabase.from('cache_tags').delete().eq('cache_key', key);

    await this.logInvalidation(key, 'manual', 'Manual deletion');
  }

  async invalidatePattern(pattern: string): Promise<number> {
    const keys = Array.from(this.memoryCache.keys()).filter((key) =>
      this.matchPattern(key, pattern)
    );

    for (const key of keys) {
      this.memoryCache.delete(key);
    }

    const { data } = await supabase.rpc('invalidate_cache_by_pattern', {
      p_pattern: pattern,
      p_reason: 'Pattern-based invalidation',
    });

    return data || 0;
  }

  async invalidateByTag(tag: string): Promise<number> {
    for (const [key, entry] of this.memoryCache.entries()) {
      this.memoryCache.delete(key);
    }

    const { data } = await supabase.rpc('invalidate_cache_by_tag', {
      p_tag: tag,
      p_reason: 'Tag-based invalidation',
    });

    return data || 0;
  }

  async invalidateByVersion(key: string, version: number): Promise<void> {
    await supabase
      .from('cache_entries')
      .delete()
      .eq('cache_key', key)
      .lt('version', version);

    await this.logInvalidation(key, 'version', `Version upgrade to ${version}`);
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();

    await supabase
      .from('cache_entries')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    await this.logInvalidation('*', 'manual', 'Cache cleared');
  }

  async getStats(): Promise<any> {
    const { data } = await supabase.rpc('get_cache_statistics', {
      p_layer: 'overall',
    });

    return {
      memory: {
        keys: this.memoryCache.size,
        hits: this.stats.hits,
        misses: this.stats.misses,
        sets: this.stats.sets,
        hitRate: this.calculateHitRate(),
      },
      database: data?.[0] || {
        total_keys: 0,
        hit_count: 0,
        miss_count: 0,
        hit_rate: 0,
      },
    };
  }

  async getKeysByTag(tag: string): Promise<string[]> {
    const { data } = await supabase
      .from('cache_tags')
      .select('cache_key')
      .eq('tag_name', tag);

    return data?.map((row) => row.cache_key) || [];
  }

  async touch(key: string, ttlSeconds?: number): Promise<void> {
    const cached = this.memoryCache.get(key);

    if (cached) {
      const newExpiry = ttlSeconds
        ? Date.now() + ttlSeconds * 1000
        : cached.expiresAt + 300000;

      cached.expiresAt = newExpiry;
    }

    if (ttlSeconds) {
      await supabase
        .from('cache_entries')
        .update({
          expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        })
        .eq('cache_key', key);
    }
  }

  private calculateHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  private matchPattern(key: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }

  private async recordAccess(key: string, hit: boolean): Promise<void> {
    try {
      await supabase.rpc('record_cache_access', {
        p_cache_key: key,
        p_hit: hit,
      });
    } catch (error) {
      console.error('Failed to record cache access:', error);
    }
  }

  private async logInvalidation(
    key: string,
    type: string,
    reason: string
  ): Promise<void> {
    try {
      await supabase.from('cache_invalidation_log').insert({
        cache_key: key === '*' ? null : key,
        key_pattern: key === '*' ? '*' : null,
        invalidation_type: type,
        invalidation_reason: reason,
      });
    } catch (error) {
      console.error('Failed to log invalidation:', error);
    }
  }

  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now();

      for (const [key, entry] of this.memoryCache.entries()) {
        if (now > entry.expiresAt) {
          this.memoryCache.delete(key);
        }
      }

      supabase.rpc('cleanup_expired_cache');
    }, 60000);
  }

  private startStatsReporting(): void {
    setInterval(async () => {
      await this.reportStats();
    }, 5 * 60 * 1000);
  }

  private async reportStats(): Promise<void> {
    const hitRate = this.calculateHitRate();

    try {
      await supabase.from('cache_statistics').insert({
        cache_layer: 'memory',
        total_keys: this.memoryCache.size,
        hit_count: this.stats.hits,
        miss_count: this.stats.misses,
        hit_rate: hitRate,
        memory_usage_bytes: 0,
      });
    } catch (error) {
      console.error('Failed to report stats:', error);
    }
  }
}

export const cacheManager = CacheManager.getInstance();
