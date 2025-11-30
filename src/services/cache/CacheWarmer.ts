import { supabase } from '../../lib/supabase';
import { cacheManager } from './CacheManager';

export interface WarmingConfig {
  name: string;
  keyPattern: string;
  queryFunction: string;
  queryParams?: Record<string, any>;
  warmOnStartup?: boolean;
  warmOnSchedule?: boolean;
  scheduleIntervalMinutes?: number;
  priority?: number;
}

class CacheWarmer {
  private static instance: CacheWarmer;
  private warmingInProgress: Set<string> = new Set();

  private constructor() {
    this.startScheduledWarming();
  }

  static getInstance(): CacheWarmer {
    if (!CacheWarmer.instance) {
      CacheWarmer.instance = new CacheWarmer();
    }
    return CacheWarmer.instance;
  }

  async warmCache(configName: string): Promise<void> {
    if (this.warmingInProgress.has(configName)) {
      console.log(`Warming already in progress for ${configName}`);
      return;
    }

    this.warmingInProgress.add(configName);

    try {
      const { data: config } = await supabase
        .from('cache_warming_config')
        .select('*')
        .eq('config_name', configName)
        .eq('enabled', true)
        .single();

      if (!config) {
        throw new Error(`Warming config not found: ${configName}`);
      }

      await this.executeWarming(config);

      await supabase
        .from('cache_warming_config')
        .update({
          last_warmed_at: new Date().toISOString(),
        })
        .eq('config_name', configName);
    } finally {
      this.warmingInProgress.delete(configName);
    }
  }

  async warmAll(): Promise<void> {
    const { data: configs } = await supabase
      .from('cache_warming_config')
      .select('*')
      .eq('enabled', true)
      .eq('warm_on_startup', true)
      .order('priority', { ascending: false });

    if (!configs || configs.length === 0) {
      return;
    }

    for (const config of configs) {
      await this.warmCache(config.config_name);
    }
  }

  async createWarmingConfig(config: WarmingConfig): Promise<void> {
    const scheduleInterval = config.scheduleIntervalMinutes
      ? `${config.scheduleIntervalMinutes} minutes`
      : '1 hour';

    await supabase.from('cache_warming_config').insert({
      config_name: config.name,
      cache_key_pattern: config.keyPattern,
      query_function: config.queryFunction,
      query_params: config.queryParams || {},
      warm_on_startup: config.warmOnStartup ?? true,
      warm_on_schedule: config.warmOnSchedule ?? false,
      schedule_interval: scheduleInterval,
      priority: config.priority || 0,
    });
  }

  async updateWarmingConfig(
    name: string,
    updates: Partial<WarmingConfig>
  ): Promise<void> {
    const updateData: any = {};

    if (updates.keyPattern) updateData.cache_key_pattern = updates.keyPattern;
    if (updates.queryFunction)
      updateData.query_function = updates.queryFunction;
    if (updates.queryParams) updateData.query_params = updates.queryParams;
    if (updates.warmOnStartup !== undefined)
      updateData.warm_on_startup = updates.warmOnStartup;
    if (updates.warmOnSchedule !== undefined)
      updateData.warm_on_schedule = updates.warmOnSchedule;
    if (updates.priority !== undefined) updateData.priority = updates.priority;

    if (updates.scheduleIntervalMinutes) {
      updateData.schedule_interval = `${updates.scheduleIntervalMinutes} minutes`;
    }

    await supabase
      .from('cache_warming_config')
      .update(updateData)
      .eq('config_name', name);
  }

  async deleteWarmingConfig(name: string): Promise<void> {
    await supabase
      .from('cache_warming_config')
      .delete()
      .eq('config_name', name);
  }

  async listWarmingConfigs(): Promise<any[]> {
    const { data } = await supabase
      .from('cache_warming_config')
      .select('*')
      .order('priority', { ascending: false });

    return data || [];
  }

  private async executeWarming(config: any): Promise<void> {
    try {
      const data = await this.executeQuery(
        config.query_function,
        config.query_params
      );

      if (data) {
        await cacheManager.set(config.cache_key_pattern, data, {
          ttl: 3600,
          layer: 'distributed',
          tags: ['warmed'],
        });

        console.log(`Successfully warmed cache: ${config.config_name}`);
      }
    } catch (error) {
      console.error(`Failed to warm cache ${config.config_name}:`, error);
    }
  }

  private async executeQuery(
    functionName: string,
    params: Record<string, any>
  ): Promise<any> {
    switch (functionName) {
      case 'get_popular_prompts':
        return this.getPopularPrompts(params);
      case 'get_recent_prompts':
        return this.getRecentPrompts(params);
      case 'get_user_statistics':
        return this.getUserStatistics(params);
      default:
        throw new Error(`Unknown query function: ${functionName}`);
    }
  }

  private async getPopularPrompts(params: any): Promise<any> {
    const limit = params.limit || 50;

    const { data } = await supabase
      .from('prompts')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(limit);

    return data;
  }

  private async getRecentPrompts(params: any): Promise<any> {
    const limit = params.limit || 50;

    const { data } = await supabase
      .from('prompts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    return data;
  }

  private async getUserStatistics(params: any): Promise<any> {
    const { data } = await supabase.from('users').select('id').limit(1000);

    return data;
  }

  private startScheduledWarming(): void {
    setInterval(async () => {
      await this.runScheduledWarming();
    }, 5 * 60 * 1000);
  }

  private async runScheduledWarming(): Promise<void> {
    const { data: jobs } = await supabase.rpc('get_cache_warming_jobs');

    if (!jobs || jobs.length === 0) {
      return;
    }

    for (const job of jobs) {
      await this.warmCache(job.config_name);
    }
  }
}

export const cacheWarmer = CacheWarmer.getInstance();
