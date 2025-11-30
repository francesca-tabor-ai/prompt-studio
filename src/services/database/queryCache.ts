import { supabase } from '../../lib/supabase';

export interface CacheConfig {
  ttl: number;
  key: string;
}

class QueryCache {
  private static instance: QueryCache;
  private memoryCache: Map<string, { data: any; expiresAt: number }> = new Map();

  private constructor() {
    this.startCleanup();
  }

  static getInstance(): QueryCache {
    if (!QueryCache.instance) {
      QueryCache.instance = new QueryCache();
    }
    return QueryCache.instance;
  }

  async get<T>(key: string): Promise<T | null> {
    const memoryCached = this.memoryCache.get(key);
    if (memoryCached && Date.now() < memoryCached.expiresAt) {
      return memoryCached.data as T;
    }

    const { data, error } = await supabase
      .from('query_cache')
      .select('query_result, expires_at')
      .eq('cache_key', key)
      .single();

    if (error || !data) {
      return null;
    }

    if (new Date(data.expires_at) < new Date()) {
      await this.delete(key);
      return null;
    }

    await supabase
      .from('query_cache')
      .update({
        hit_count: supabase.rpc('increment', { x: 1 }),
        last_accessed_at: new Date().toISOString(),
      })
      .eq('cache_key', key);

    this.memoryCache.set(key, {
      data: data.query_result,
      expiresAt: new Date(data.expires_at).getTime(),
    });

    return data.query_result as T;
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await supabase
      .from('query_cache')
      .upsert({
        cache_key: key,
        query_result: value,
        expires_at: expiresAt.toISOString(),
      });

    this.memoryCache.set(key, {
      data: value,
      expiresAt: expiresAt.getTime(),
    });
  }

  async delete(key: string): Promise<void> {
    await supabase.from('query_cache').delete().eq('cache_key', key);

    this.memoryCache.delete(key);
  }

  async clear(pattern?: string): Promise<void> {
    if (pattern) {
      await supabase
        .from('query_cache')
        .delete()
        .like('cache_key', pattern);

      for (const key of this.memoryCache.keys()) {
        if (key.includes(pattern.replace('%', ''))) {
          this.memoryCache.delete(key);
        }
      }
    } else {
      await supabase.from('query_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      this.memoryCache.clear();
    }
  }

  generateKey(queryName: string, params: any): string {
    return `${queryName}:${JSON.stringify(params)}`;
  }

  async getCacheStats(): Promise<any> {
    const { data: dbCache } = await supabase
      .from('query_cache')
      .select('hit_count, created_at, expires_at');

    const totalEntries = dbCache?.length || 0;
    const totalHits = dbCache?.reduce((sum, entry) => sum + entry.hit_count, 0) || 0;
    const avgHits = totalEntries > 0 ? totalHits / totalEntries : 0;

    return {
      memoryEntries: this.memoryCache.size,
      dbEntries: totalEntries,
      totalHits,
      avgHitsPerEntry: avgHits.toFixed(2),
    };
  }

  private startCleanup(): void {
    setInterval(async () => {
      const now = Date.now();

      for (const [key, value] of this.memoryCache.entries()) {
        if (now > value.expiresAt) {
          this.memoryCache.delete(key);
        }
      }

      await supabase.rpc('cleanup_expired_cache');
    }, 60000);
  }
}

export const queryCache = QueryCache.getInstance();
