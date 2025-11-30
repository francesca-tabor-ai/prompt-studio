import { supabase } from '../lib/supabase';

export interface AnalyticsEvent {
  eventType: string;
  eventName: string;
  userId?: string;
  promptId?: string;
  departmentId?: string;
  sessionId?: string;
  durationSeconds?: number;
  properties?: Record<string, any>;
}

export interface UsageMetrics {
  totalEvents: number;
  uniqueUsers: number;
  promptViews: number;
  promptUses: number;
  sandboxSessions: number;
  reviewsCompleted: number;
}

export interface DepartmentUsage {
  department: string;
  totalEvents: number;
  uniqueUsers: number;
  promptUses: number;
  avgEngagement: number;
}

export interface TrendingPrompt {
  promptId: string;
  promptTitle: string;
  viewCount: number;
  useCount: number;
  growthRate: number;
  trendingScore: number;
}

export class UsageAnalyticsService {
  private static instance: UsageAnalyticsService;
  private sessionId: string;

  private constructor() {
    this.sessionId = this.generateSessionId();
  }

  static getInstance(): UsageAnalyticsService {
    if (!UsageAnalyticsService.instance) {
      UsageAnalyticsService.instance = new UsageAnalyticsService();
    }
    return UsageAnalyticsService.instance;
  }

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const eventData = {
        event_type: event.eventType,
        event_name: event.eventName,
        user_id: event.userId || user?.id,
        prompt_id: event.promptId,
        department_id: event.departmentId,
        session_id: event.sessionId || this.sessionId,
        page_url: window.location.href,
        referrer_url: document.referrer,
        user_agent: navigator.userAgent,
        device_type: this.getDeviceType(),
        browser: this.getBrowser(),
        duration_seconds: event.durationSeconds,
        properties: event.properties || {},
      };

      await supabase.from('analytics_events').insert(eventData);
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }

  async trackPromptView(promptId: string, promptTitle: string): Promise<void> {
    await this.trackEvent({
      eventType: 'prompt',
      eventName: 'prompt_view',
      promptId,
      properties: { promptTitle },
    });
  }

  async trackPromptUsage(promptId: string, promptTitle: string, context?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      eventType: 'prompt',
      eventName: 'prompt_use',
      promptId,
      properties: { promptTitle, ...context },
    });
  }

  async trackSandboxTest(promptId: string, durationSeconds: number): Promise<void> {
    await this.trackEvent({
      eventType: 'sandbox',
      eventName: 'sandbox_test',
      promptId,
      durationSeconds,
    });
  }

  async trackReviewSubmit(submissionId: string, reviewTime: number): Promise<void> {
    await this.trackEvent({
      eventType: 'review',
      eventName: 'review_submit',
      promptId: submissionId,
      durationSeconds: reviewTime,
    });
  }

  async trackFeatureUsage(featureName: string, action: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      eventType: 'feature',
      eventName: `feature_${action}`,
      properties: { featureName, ...metadata },
    });
  }

  async getUsageMetrics(startDate: Date, endDate: Date): Promise<UsageMetrics> {
    try {
      const { data } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (!data) return this.getEmptyMetrics();

      const uniqueUsers = new Set(data.map((e) => e.user_id).filter(Boolean)).size;

      return {
        totalEvents: data.length,
        uniqueUsers,
        promptViews: data.filter((e) => e.event_name === 'prompt_view').length,
        promptUses: data.filter((e) => e.event_name === 'prompt_use').length,
        sandboxSessions: data.filter((e) => e.event_type === 'sandbox').length,
        reviewsCompleted: data.filter((e) => e.event_name === 'review_submit').length,
      };
    } catch (error) {
      console.error('Error fetching usage metrics:', error);
      return this.getEmptyMetrics();
    }
  }

  async getDepartmentMetrics(startDate: Date, endDate: Date): Promise<DepartmentUsage[]> {
    try {
      const { data } = await supabase
        .from('analytics_events')
        .select('department_id, user_id, event_name')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .not('department_id', 'is', null);

      if (!data) return [];

      const deptMap = new Map<string, any>();

      data.forEach((event) => {
        const dept = event.department_id;
        if (!deptMap.has(dept)) {
          deptMap.set(dept, {
            department: dept,
            totalEvents: 0,
            uniqueUsers: new Set(),
            promptUses: 0,
          });
        }

        const metrics = deptMap.get(dept)!;
        metrics.totalEvents++;
        if (event.user_id) metrics.uniqueUsers.add(event.user_id);
        if (event.event_name === 'prompt_use') metrics.promptUses++;
      });

      return Array.from(deptMap.values()).map((m) => ({
        department: m.department,
        totalEvents: m.totalEvents,
        uniqueUsers: m.uniqueUsers.size,
        promptUses: m.promptUses,
        avgEngagement: m.totalEvents / (m.uniqueUsers.size || 1),
      }));
    } catch (error) {
      console.error('Error fetching department metrics:', error);
      return [];
    }
  }

  async getMostUsedPrompts(limit: number = 10, days: number = 30): Promise<TrendingPrompt[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data } = await supabase
        .from('analytics_events')
        .select('prompt_id, event_name, properties, created_at')
        .gte('created_at', startDate.toISOString())
        .in('event_name', ['prompt_view', 'prompt_use'])
        .not('prompt_id', 'is', null);

      if (!data) return [];

      const promptMap = new Map<string, any>();

      data.forEach((event) => {
        const promptId = event.prompt_id!;
        if (!promptMap.has(promptId)) {
          promptMap.set(promptId, {
            promptId,
            promptTitle: event.properties?.promptTitle || 'Unknown',
            viewCount: 0,
            useCount: 0,
            firstSeen: event.created_at,
            lastSeen: event.created_at,
          });
        }

        const prompt = promptMap.get(promptId)!;
        if (event.event_name === 'prompt_view') prompt.viewCount++;
        if (event.event_name === 'prompt_use') prompt.useCount++;
        prompt.lastSeen = event.created_at;
      });

      const prompts = Array.from(promptMap.values())
        .map((p) => {
          const daysActive = Math.max(
            1,
            (new Date(p.lastSeen).getTime() - new Date(p.firstSeen).getTime()) / (1000 * 60 * 60 * 24)
          );
          const growthRate = p.useCount / daysActive;
          const trendingScore = p.useCount * 10 + p.viewCount + growthRate * 20;

          return {
            promptId: p.promptId,
            promptTitle: p.promptTitle,
            viewCount: p.viewCount,
            useCount: p.useCount,
            growthRate: Math.round(growthRate * 100) / 100,
            trendingScore: Math.round(trendingScore),
          };
        })
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, limit);

      return prompts;
    } catch (error) {
      console.error('Error fetching most used prompts:', error);
      return [];
    }
  }

  async getAdoptionTimeSeries(featureName: string, days: number = 30): Promise<{date: string; users: number}[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data } = await supabase
        .from('analytics_events')
        .select('created_at, user_id')
        .eq('event_type', 'feature')
        .contains('properties', { featureName })
        .gte('created_at', startDate.toISOString())
        .order('created_at');

      if (!data) return [];

      const dailyUsers = new Map<string, Set<string>>();

      data.forEach((event) => {
        const date = event.created_at.split('T')[0];
        if (!dailyUsers.has(date)) {
          dailyUsers.set(date, new Set());
        }
        if (event.user_id) {
          dailyUsers.get(date)!.add(event.user_id);
        }
      });

      return Array.from(dailyUsers.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, users]) => ({
          date,
          users: users.size,
        }));
    } catch (error) {
      console.error('Error fetching adoption time series:', error);
      return [];
    }
  }

  async getCohortAnalysis(cohortStartDate: Date, cohortEndDate: Date): Promise<{
    totalUsers: number;
    activeToday: number;
    retentionRate: number;
    avgEventsPerUser: number;
  }> {
    try {
      const { data: cohortUsers } = await supabase
        .from('analytics_events')
        .select('user_id')
        .gte('created_at', cohortStartDate.toISOString())
        .lte('created_at', cohortEndDate.toISOString())
        .not('user_id', 'is', null);

      if (!cohortUsers) return { totalUsers: 0, activeToday: 0, retentionRate: 0, avgEventsPerUser: 0 };

      const uniqueCohortUsers = new Set(cohortUsers.map((e) => e.user_id));
      const totalUsers = uniqueCohortUsers.size;

      const today = new Date();
      const { data: todayEvents } = await supabase
        .from('analytics_events')
        .select('user_id')
        .gte('created_at', new Date(today.setHours(0, 0, 0, 0)).toISOString())
        .in('user_id', Array.from(uniqueCohortUsers));

      const activeToday = new Set(todayEvents?.map((e) => e.user_id) || []).size;

      const { data: allEvents } = await supabase
        .from('analytics_events')
        .select('user_id')
        .gte('created_at', cohortStartDate.toISOString())
        .in('user_id', Array.from(uniqueCohortUsers));

      const avgEventsPerUser = (allEvents?.length || 0) / totalUsers;

      return {
        totalUsers,
        activeToday,
        retentionRate: (activeToday / totalUsers) * 100,
        avgEventsPerUser: Math.round(avgEventsPerUser * 10) / 10,
      };
    } catch (error) {
      console.error('Error calculating cohort analysis:', error);
      return { totalUsers: 0, activeToday: 0, retentionRate: 0, avgEventsPerUser: 0 };
    }
  }

  async getFeatureUsageBreakdown(days: number = 30): Promise<Record<string, number>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data } = await supabase
        .from('analytics_events')
        .select('properties')
        .eq('event_type', 'feature')
        .gte('created_at', startDate.toISOString());

      if (!data) return {};

      const featureCounts: Record<string, number> = {};

      data.forEach((event) => {
        const featureName = event.properties?.featureName;
        if (featureName) {
          featureCounts[featureName] = (featureCounts[featureName] || 0) + 1;
        }
      });

      return featureCounts;
    } catch (error) {
      console.error('Error fetching feature usage:', error);
      return {};
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDeviceType(): string {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iP(hone|od)|IEMobile/.test(ua)) return 'mobile';
    return 'desktop';
  }

  private getBrowser(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Other';
  }

  private getEmptyMetrics(): UsageMetrics {
    return {
      totalEvents: 0,
      uniqueUsers: 0,
      promptViews: 0,
      promptUses: 0,
      sandboxSessions: 0,
      reviewsCompleted: 0,
    };
  }
}

export const usageAnalyticsService = UsageAnalyticsService.getInstance();
