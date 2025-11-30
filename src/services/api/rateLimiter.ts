import { supabase } from '../../lib/supabase';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  identifier: string;
  identifierType: 'user_id' | 'ip_address' | 'api_key';
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

class RateLimiter {
  private static instance: RateLimiter;
  private cache: Map<string, { count: number; resetAt: number }> = new Map();

  private defaultLimits = {
    perUser: { windowMs: 60000, maxRequests: 100 },
    perIP: { windowMs: 60000, maxRequests: 50 },
    perAPIKey: { windowMs: 60000, maxRequests: 1000 },
  };

  private constructor() {
    this.startCleanupInterval();
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  async checkLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    const key = this.generateKey(config);
    const now = Date.now();

    let cached = this.cache.get(key);

    if (!cached || now > cached.resetAt) {
      cached = {
        count: 0,
        resetAt: now + config.windowMs,
      };
      this.cache.set(key, cached);
    }

    if (cached.count >= config.maxRequests) {
      const retryAfter = Math.ceil((cached.resetAt - now) / 1000);

      await this.logRateLimitExceeded(config);

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(cached.resetAt),
        retryAfter,
      };
    }

    cached.count++;

    await this.recordRequest(config);

    return {
      allowed: true,
      remaining: config.maxRequests - cached.count,
      resetAt: new Date(cached.resetAt),
    };
  }

  async checkUserLimit(userId: string, endpoint?: string): Promise<RateLimitResult> {
    const config: RateLimitConfig = {
      ...this.defaultLimits.perUser,
      identifier: userId,
      identifierType: 'user_id',
    };

    return this.checkLimit(config);
  }

  async checkIPLimit(ipAddress: string, endpoint?: string): Promise<RateLimitResult> {
    const config: RateLimitConfig = {
      ...this.defaultLimits.perIP,
      identifier: ipAddress,
      identifierType: 'ip_address',
    };

    return this.checkLimit(config);
  }

  async checkAPIKeyLimit(apiKey: string): Promise<RateLimitResult> {
    const config: RateLimitConfig = {
      ...this.defaultLimits.perAPIKey,
      identifier: apiKey,
      identifierType: 'api_key',
    };

    return this.checkLimit(config);
  }

  private generateKey(config: RateLimitConfig): string {
    return `${config.identifierType}:${config.identifier}`;
  }

  private async recordRequest(config: RateLimitConfig): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from('rate_limits')
        .select('*')
        .eq('identifier', config.identifier)
        .eq('identifier_type', config.identifierType)
        .gte('window_start', new Date(Date.now() - config.windowMs).toISOString())
        .single();

      if (existing) {
        await supabase
          .from('rate_limits')
          .update({
            request_count: existing.request_count + 1,
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('rate_limits').insert({
          identifier: config.identifier,
          identifier_type: config.identifierType,
          endpoint: '',
          request_count: 1,
          window_start: new Date().toISOString(),
          reset_at: new Date(Date.now() + config.windowMs).toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to record rate limit:', error);
    }
  }

  private async logRateLimitExceeded(config: RateLimitConfig): Promise<void> {
    try {
      await supabase.from('suspicious_activity').insert({
        activity_type: 'rate_limit_exceeded',
        severity: 'medium',
        identifier: config.identifier,
        identifier_type: config.identifierType,
        details: {
          maxRequests: config.maxRequests,
          windowMs: config.windowMs,
        },
      });
    } catch (error) {
      console.error('Failed to log rate limit exceeded:', error);
    }
  }

  async getUsageStats(
    identifier: string,
    identifierType: 'user_id' | 'ip_address' | 'api_key'
  ): Promise<any> {
    const { data } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('identifier', identifier)
      .eq('identifier_type', identifierType)
      .order('window_start', { ascending: false })
      .limit(1)
      .single();

    return data;
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();

      for (const [key, value] of this.cache.entries()) {
        if (now > value.resetAt) {
          this.cache.delete(key);
        }
      }
    }, 60000);
  }

  async resetLimit(
    identifier: string,
    identifierType: 'user_id' | 'ip_address' | 'api_key'
  ): Promise<void> {
    const key = `${identifierType}:${identifier}`;
    this.cache.delete(key);

    await supabase
      .from('rate_limits')
      .delete()
      .eq('identifier', identifier)
      .eq('identifier_type', identifierType);
  }
}

export const rateLimiter = RateLimiter.getInstance();
