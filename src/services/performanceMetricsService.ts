import { supabase } from '../lib/supabase';

export interface PerformanceMetrics {
  avgAiAccuracy: number;
  avgClarityScore: number;
  avgUsefulnessScore: number;
  avgSatisfactionRating: number;
  sandboxSuccessRate: number;
  avgTimeToApprovalHours: number;
  utilizationRate: number;
  totalCostUsd: number;
  revisionFrequency: number;
}

export interface AccuracyMetric {
  promptId: string;
  promptTitle: string;
  department: string;
  accuracyScore: number;
  clarityScore: number;
  usefulnessScore: number;
  sampleSize: number;
}

export interface SatisfactionTrend {
  date: string;
  avgRating: number;
  totalRatings: number;
  wouldRecommendPercent: number;
}

export interface SandboxMetrics {
  totalTests: number;
  testsPassed: number;
  testsFailed: number;
  successRate: number;
  avgExecutionTimeMs: number;
}

export interface CostBreakdown {
  totalCost: number;
  totalTokens: number;
  totalCalls: number;
  costByDepartment: Record<string, number>;
  costByModel: Record<string, number>;
}

export interface TimeComparison {
  current: PerformanceMetrics;
  previous: PerformanceMetrics;
  percentChange: Record<string, number>;
}

export class PerformanceMetricsService {
  private static instance: PerformanceMetricsService;

  private constructor() {}

  static getInstance(): PerformanceMetricsService {
    if (!PerformanceMetricsService.instance) {
      PerformanceMetricsService.instance = new PerformanceMetricsService();
    }
    return PerformanceMetricsService.instance;
  }

  async recordAccuracyScore(
    promptId: string,
    accuracyScore: number,
    clarityScore: number,
    relevanceScore: number,
    usefulnessScore: number,
    context?: string
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('ai_accuracy_metrics').insert({
        prompt_id: promptId,
        user_id: user?.id,
        accuracy_score: accuracyScore,
        clarity_score: clarityScore,
        relevance_score: relevanceScore,
        usefulness_score: usefulnessScore,
        context,
        test_type: 'manual',
      });
    } catch (error) {
      console.error('Error recording accuracy score:', error);
    }
  }

  async recordSatisfactionRating(
    promptId: string,
    rating: number,
    feedbackText?: string,
    feedbackCategory?: string,
    wouldRecommend?: boolean
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('satisfaction_ratings').insert({
        user_id: user?.id,
        user_email: user?.email,
        prompt_id: promptId,
        rating,
        feedback_text: feedbackText,
        feedback_category: feedbackCategory,
        would_recommend: wouldRecommend,
      });
    } catch (error) {
      console.error('Error recording satisfaction rating:', error);
    }
  }

  async recordSandboxTest(
    promptId: string,
    sessionId: string,
    testStatus: 'passed' | 'failed' | 'error',
    executionTimeMs: number,
    passedChecks: number,
    failedChecks: number,
    tokensUsed?: number
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('sandbox_test_results').insert({
        prompt_id: promptId,
        session_id: sessionId,
        user_id: user?.id,
        test_type: 'integration',
        test_status: testStatus,
        execution_time_ms: executionTimeMs,
        passed_checks: passedChecks,
        failed_checks: failedChecks,
        total_checks: passedChecks + failedChecks,
        tokens_used: tokensUsed,
      });
    } catch (error) {
      console.error('Error recording sandbox test:', error);
    }
  }

  async recordApprovalTime(
    submissionId: string,
    submittedAt: Date,
    approvedAt: Date,
    reviewerCount: number,
    revisionRounds: number
  ): Promise<void> {
    try {
      const timeToApprovalHours =
        (approvedAt.getTime() - submittedAt.getTime()) / (1000 * 60 * 60);

      await supabase.from('approval_time_metrics').insert({
        submission_id: submissionId,
        submitted_at: submittedAt.toISOString(),
        approved_at: approvedAt.toISOString(),
        time_to_approval_hours: timeToApprovalHours,
        total_reviewers: reviewerCount,
        revision_rounds: revisionRounds,
      });
    } catch (error) {
      console.error('Error recording approval time:', error);
    }
  }

  async recordCost(
    apiProvider: string,
    modelName: string,
    totalTokens: number,
    inputTokens: number,
    outputTokens: number,
    costUsd: number,
    promptId?: string
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('cost_metrics').insert({
        metric_date: new Date().toISOString().split('T')[0],
        prompt_id: promptId,
        user_id: user?.id,
        api_provider: apiProvider,
        model_name: modelName,
        total_calls: 1,
        successful_calls: 1,
        total_tokens: totalTokens,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_cost_usd: costUsd,
      });
    } catch (error) {
      console.error('Error recording cost:', error);
    }
  }

  async flagPromptForQuality(
    promptId: string,
    flagReason: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    try {
      await supabase.from('quality_metrics').insert({
        prompt_id: promptId,
        flagged_at: new Date().toISOString(),
        flag_reason: flagReason,
        flag_severity: severity,
      });
    } catch (error) {
      console.error('Error flagging prompt:', error);
    }
  }

  async getPerformanceMetrics(startDate: Date, endDate: Date): Promise<PerformanceMetrics> {
    try {
      const [accuracy, satisfaction, sandbox, approval, cost, quality] = await Promise.all([
        this.getAverageAccuracy(startDate, endDate),
        this.getAverageSatisfaction(startDate, endDate),
        this.getSandboxMetrics(startDate, endDate),
        this.getAverageApprovalTime(startDate, endDate),
        this.getTotalCost(startDate, endDate),
        this.getQualityMetrics(startDate, endDate),
      ]);

      return {
        avgAiAccuracy: accuracy.avgAccuracy,
        avgClarityScore: accuracy.avgClarity,
        avgUsefulnessScore: accuracy.avgUsefulness,
        avgSatisfactionRating: satisfaction.avgRating,
        sandboxSuccessRate: sandbox.successRate,
        avgTimeToApprovalHours: approval.avgTimeHours,
        utilizationRate: await this.getUtilizationRate(startDate, endDate),
        totalCostUsd: cost.totalCost,
        revisionFrequency: quality.revisionFrequency,
      };
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      return this.getEmptyMetrics();
    }
  }

  async getAccuracyByPrompt(limit: number = 10): Promise<AccuracyMetric[]> {
    try {
      const { data } = await supabase
        .from('ai_accuracy_metrics')
        .select('prompt_id, accuracy_score, clarity_score, usefulness_score, department')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!data) return [];

      const promptMap = new Map<string, any>();

      data.forEach((metric) => {
        const promptId = metric.prompt_id;
        if (!promptMap.has(promptId)) {
          promptMap.set(promptId, {
            promptId,
            department: metric.department || 'Unknown',
            accuracyScores: [],
            clarityScores: [],
            usefulnessScores: [],
          });
        }

        const prompt = promptMap.get(promptId)!;
        prompt.accuracyScores.push(metric.accuracy_score);
        if (metric.clarity_score) prompt.clarityScores.push(metric.clarity_score);
        if (metric.usefulness_score) prompt.usefulnessScores.push(metric.usefulness_score);
      });

      const results = Array.from(promptMap.values())
        .map((p) => ({
          promptId: p.promptId,
          promptTitle: 'Prompt',
          department: p.department,
          accuracyScore:
            p.accuracyScores.reduce((a: number, b: number) => a + b, 0) / p.accuracyScores.length,
          clarityScore:
            p.clarityScores.length > 0
              ? p.clarityScores.reduce((a: number, b: number) => a + b, 0) / p.clarityScores.length
              : 0,
          usefulnessScore:
            p.usefulnessScores.length > 0
              ? p.usefulnessScores.reduce((a: number, b: number) => a + b, 0) /
                p.usefulnessScores.length
              : 0,
          sampleSize: p.accuracyScores.length,
        }))
        .sort((a, b) => b.accuracyScore - a.accuracyScore)
        .slice(0, limit);

      return results;
    } catch (error) {
      console.error('Error fetching accuracy by prompt:', error);
      return [];
    }
  }

  async getSatisfactionTrend(days: number = 30): Promise<SatisfactionTrend[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data } = await supabase
        .from('satisfaction_ratings')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at');

      if (!data) return [];

      const dailyMap = new Map<string, any>();

      data.forEach((rating) => {
        const date = rating.created_at.split('T')[0];
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            ratings: [],
            recommendations: [],
          });
        }

        const day = dailyMap.get(date)!;
        day.ratings.push(rating.rating);
        if (rating.would_recommend !== null) {
          day.recommendations.push(rating.would_recommend);
        }
      });

      return Array.from(dailyMap.values())
        .map((d) => ({
          date: d.date,
          avgRating: d.ratings.reduce((a: number, b: number) => a + b, 0) / d.ratings.length,
          totalRatings: d.ratings.length,
          wouldRecommendPercent:
            d.recommendations.length > 0
              ? (d.recommendations.filter((r: boolean) => r).length / d.recommendations.length) * 100
              : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error('Error fetching satisfaction trend:', error);
      return [];
    }
  }

  async getCostBreakdown(startDate: Date, endDate: Date): Promise<CostBreakdown> {
    try {
      const { data } = await supabase
        .from('cost_metrics')
        .select('*')
        .gte('metric_date', startDate.toISOString().split('T')[0])
        .lte('metric_date', endDate.toISOString().split('T')[0]);

      if (!data) {
        return {
          totalCost: 0,
          totalTokens: 0,
          totalCalls: 0,
          costByDepartment: {},
          costByModel: {},
        };
      }

      const costByDept: Record<string, number> = {};
      const costByModel: Record<string, number> = {};
      let totalCost = 0;
      let totalTokens = 0;
      let totalCalls = 0;

      data.forEach((metric) => {
        totalCost += metric.total_cost_usd || 0;
        totalTokens += metric.total_tokens || 0;
        totalCalls += metric.total_calls || 0;

        if (metric.department) {
          costByDept[metric.department] = (costByDept[metric.department] || 0) + metric.total_cost_usd;
        }

        if (metric.model_name) {
          costByModel[metric.model_name] = (costByModel[metric.model_name] || 0) + metric.total_cost_usd;
        }
      });

      return {
        totalCost,
        totalTokens,
        totalCalls,
        costByDepartment: costByDept,
        costByModel: costByModel,
      };
    } catch (error) {
      console.error('Error fetching cost breakdown:', error);
      return {
        totalCost: 0,
        totalTokens: 0,
        totalCalls: 0,
        costByDepartment: {},
        costByModel: {},
      };
    }
  }

  async compareTimePeriods(
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date
  ): Promise<TimeComparison> {
    const [current, previous] = await Promise.all([
      this.getPerformanceMetrics(currentStart, currentEnd),
      this.getPerformanceMetrics(previousStart, previousEnd),
    ]);

    const percentChange: Record<string, number> = {};

    Object.keys(current).forEach((key) => {
      const currentVal = (current as any)[key];
      const previousVal = (previous as any)[key];

      if (previousVal !== 0) {
        percentChange[key] = ((currentVal - previousVal) / previousVal) * 100;
      } else {
        percentChange[key] = currentVal > 0 ? 100 : 0;
      }
    });

    return { current, previous, percentChange };
  }

  private async getAverageAccuracy(
    startDate: Date,
    endDate: Date
  ): Promise<{ avgAccuracy: number; avgClarity: number; avgUsefulness: number }> {
    const { data } = await supabase
      .from('ai_accuracy_metrics')
      .select('accuracy_score, clarity_score, usefulness_score')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (!data || data.length === 0) {
      return { avgAccuracy: 0, avgClarity: 0, avgUsefulness: 0 };
    }

    const avgAccuracy =
      data.reduce((sum, m) => sum + m.accuracy_score, 0) / data.length;
    const clarityScores = data.filter((m) => m.clarity_score);
    const usefulnessScores = data.filter((m) => m.usefulness_score);

    return {
      avgAccuracy,
      avgClarity:
        clarityScores.length > 0
          ? clarityScores.reduce((sum, m) => sum + m.clarity_score, 0) / clarityScores.length
          : 0,
      avgUsefulness:
        usefulnessScores.length > 0
          ? usefulnessScores.reduce((sum, m) => sum + m.usefulness_score, 0) / usefulnessScores.length
          : 0,
    };
  }

  private async getAverageSatisfaction(
    startDate: Date,
    endDate: Date
  ): Promise<{ avgRating: number }> {
    const { data } = await supabase
      .from('satisfaction_ratings')
      .select('rating')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (!data || data.length === 0) return { avgRating: 0 };

    return {
      avgRating: data.reduce((sum, r) => sum + r.rating, 0) / data.length,
    };
  }

  private async getSandboxMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{ successRate: number; avgTimeMs: number }> {
    const { data } = await supabase
      .from('sandbox_test_results')
      .select('test_status, execution_time_ms')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (!data || data.length === 0) return { successRate: 0, avgTimeMs: 0 };

    const passed = data.filter((t) => t.test_status === 'passed').length;
    const successRate = (passed / data.length) * 100;

    const times = data.filter((t) => t.execution_time_ms);
    const avgTimeMs =
      times.length > 0
        ? times.reduce((sum, t) => sum + t.execution_time_ms, 0) / times.length
        : 0;

    return { successRate, avgTimeMs };
  }

  private async getAverageApprovalTime(
    startDate: Date,
    endDate: Date
  ): Promise<{ avgTimeHours: number }> {
    const { data } = await supabase
      .from('approval_time_metrics')
      .select('time_to_approval_hours')
      .gte('submitted_at', startDate.toISOString())
      .lte('submitted_at', endDate.toISOString())
      .not('time_to_approval_hours', 'is', null);

    if (!data || data.length === 0) return { avgTimeHours: 0 };

    return {
      avgTimeHours:
        data.reduce((sum, a) => sum + a.time_to_approval_hours, 0) / data.length,
    };
  }

  private async getTotalCost(
    startDate: Date,
    endDate: Date
  ): Promise<{ totalCost: number }> {
    const { data } = await supabase
      .from('cost_metrics')
      .select('total_cost_usd')
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .lte('metric_date', endDate.toISOString().split('T')[0]);

    if (!data) return { totalCost: 0 };

    return {
      totalCost: data.reduce((sum, c) => sum + (c.total_cost_usd || 0), 0),
    };
  }

  private async getUtilizationRate(startDate: Date, endDate: Date): Promise<number> {
    const { data: allPrompts } = await supabase
      .from('prompt_submissions')
      .select('id')
      .eq('status', 'published');

    const { data: usedPrompts } = await supabase
      .from('analytics_events')
      .select('prompt_id')
      .eq('event_name', 'prompt_use')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('prompt_id', 'is', null);

    if (!allPrompts || allPrompts.length === 0) return 0;

    const uniqueUsed = new Set(usedPrompts?.map((e) => e.prompt_id) || []).size;
    return (uniqueUsed / allPrompts.length) * 100;
  }

  private async getQualityMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{ revisionFrequency: number }> {
    const { data } = await supabase
      .from('quality_metrics')
      .select('revision_count')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (!data || data.length === 0) return { revisionFrequency: 0 };

    return {
      revisionFrequency:
        data.reduce((sum, q) => sum + (q.revision_count || 0), 0) / data.length,
    };
  }

  private getEmptyMetrics(): PerformanceMetrics {
    return {
      avgAiAccuracy: 0,
      avgClarityScore: 0,
      avgUsefulnessScore: 0,
      avgSatisfactionRating: 0,
      sandboxSuccessRate: 0,
      avgTimeToApprovalHours: 0,
      utilizationRate: 0,
      totalCostUsd: 0,
      revisionFrequency: 0,
    };
  }
}

export const performanceMetricsService = PerformanceMetricsService.getInstance();
