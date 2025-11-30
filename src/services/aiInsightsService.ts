import { supabase } from '../lib/supabase';

export interface AIInsight {
  id: string;
  insightType: string;
  insightCategory: string;
  title: string;
  description: string;
  severity: string;
  priority: number;
  dataPoints: any;
  recommendedAction: string;
  actionSteps: string[];
  impactScore: number;
  confidenceScore: number;
  status: string;
}

export interface PromptHealthScore {
  promptId: string;
  overallScore: number;
  qualityScore: number;
  performanceScore: number;
  adoptionScore: number;
  satisfactionScore: number;
  redFlags: string[];
  strengths: string[];
  needsAttention: boolean;
}

export interface LibraryGap {
  gapType: string;
  dimensionType: string;
  dimensionValue: string;
  gapDescription: string;
  currentCoverage: number;
  expectedCoverage: number;
  gapSize: number;
  suggestedPrompts: any;
  priorityScore: number;
}

export interface DuplicateCandidate {
  promptAId: string;
  promptBId: string;
  similarityScore: number;
  similarityFactors: any;
  recommendation: string;
}

export interface OptimizationOpportunity {
  promptId: string;
  opportunityType: string;
  title: string;
  description: string;
  currentMetrics: any;
  potentialImprovement: any;
  specificRecommendations: string[];
  effortLevel: string;
  impactLevel: string;
  priorityScore: number;
}

export class AIInsightsService {
  private static instance: AIInsightsService;

  private constructor() {}

  static getInstance(): AIInsightsService {
    if (!AIInsightsService.instance) {
      AIInsightsService.instance = new AIInsightsService();
    }
    return AIInsightsService.instance;
  }

  async analyzeAndGenerateInsights(): Promise<void> {
    await Promise.all([
      this.detectAnomalies(),
      this.identifyPatterns(),
      this.flagUnderperformingPrompts(),
      this.analyzeLibraryGaps(),
      this.detectDuplicates(),
      this.findOptimizationOpportunities(),
      this.analyzeAdoptionTrends(),
    ]);
  }

  async detectAnomalies(): Promise<void> {
    try {
      const { data: anomalies } = await supabase.rpc('detect_prompt_anomalies', {
        p_lookback_days: 7,
      });

      if (!anomalies) return;

      for (const anomaly of anomalies) {
        await this.createInsight({
          insightType: 'anomaly',
          insightCategory: 'performance',
          title: `Anomaly Detected: ${anomaly.anomaly_type}`,
          description: anomaly.description,
          severity: anomaly.severity,
          priority: anomaly.severity === 'critical' ? 10 : anomaly.severity === 'high' ? 8 : 5,
          dataPoints: { promptId: anomaly.prompt_id, type: anomaly.anomaly_type },
          affectedPrompts: [anomaly.prompt_id],
          recommendedAction: 'Review and refine this prompt immediately',
          actionSteps: [
            'Review user feedback and ratings',
            'Analyze test failure patterns',
            'Update prompt content or instructions',
            'Re-test in sandbox environment',
          ],
          impactScore: 85,
          confidenceScore: 90,
        });
      }
    } catch (error) {
      console.error('Error detecting anomalies:', error);
    }
  }

  async identifyPatterns(): Promise<void> {
    try {
      const { data: events } = await supabase
        .from('analytics_events')
        .select('event_type, event_name, user_id, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(10000);

      if (!events) return;

      const hourlyUsage = new Map<number, number>();
      events.forEach((event) => {
        const hour = new Date(event.created_at).getHours();
        hourlyUsage.set(hour, (hourlyUsage.get(hour) || 0) + 1);
      });

      const peakHours = Array.from(hourlyUsage.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([hour]) => hour);

      if (peakHours.length > 0) {
        await this.createInsight({
          insightType: 'pattern',
          insightCategory: 'usage',
          title: 'Peak Usage Hours Identified',
          description: `Most usage occurs at ${peakHours.join(', ')}:00. Consider scheduling maintenance outside these hours.`,
          severity: 'info',
          priority: 3,
          dataPoints: { peakHours, usageDistribution: Object.fromEntries(hourlyUsage) },
          recommendedAction: 'Schedule system maintenance during off-peak hours',
          actionSteps: ['Avoid updates during peak hours', 'Communicate downtime in advance'],
          impactScore: 60,
          confidenceScore: 95,
        });
      }

      const userEngagement = new Map<string, number>();
      events.forEach((event) => {
        if (event.user_id) {
          userEngagement.set(event.user_id, (userEngagement.get(event.user_id) || 0) + 1);
        }
      });

      const powerUsers = Array.from(userEngagement.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      if (powerUsers.length > 0) {
        await this.createInsight({
          insightType: 'pattern',
          insightCategory: 'engagement',
          title: 'Power Users Identified',
          description: `${powerUsers.length} users account for significant system usage. Consider creating a power user program.`,
          severity: 'info',
          priority: 4,
          dataPoints: { powerUsers: powerUsers.map(([id, count]) => ({ userId: id, eventCount: count })) },
          recommendedAction: 'Engage with power users for feedback and beta testing',
          actionSteps: [
            'Reach out to top 10 users',
            'Request feedback on features',
            'Invite to beta program',
          ],
          impactScore: 70,
          confidenceScore: 100,
        });
      }
    } catch (error) {
      console.error('Error identifying patterns:', error);
    }
  }

  async flagUnderperformingPrompts(): Promise<void> {
    try {
      const { data: prompts } = await supabase
        .from('prompt_submissions')
        .select('id, title')
        .eq('status', 'published');

      if (!prompts) return;

      for (const prompt of prompts) {
        const health = await this.calculatePromptHealth(prompt.id);

        if (health.overallScore < 60) {
          await this.createInsight({
            insightType: 'performance_alert',
            insightCategory: 'quality',
            title: `Low Performance: ${prompt.title}`,
            description: `Prompt health score is ${health.overallScore}/100. ${health.redFlags.join('. ')}`,
            severity: health.overallScore < 40 ? 'high' : 'medium',
            priority: 7,
            dataPoints: { healthScore: health, promptId: prompt.id },
            affectedPrompts: [prompt.id],
            recommendedAction: 'Refine prompt content and test thoroughly',
            actionSteps: [
              'Review low ratings and feedback',
              'Improve clarity and instructions',
              'Add test cases',
              'Monitor performance after changes',
            ],
            impactScore: 80,
            confidenceScore: 85,
          });
        }
      }
    } catch (error) {
      console.error('Error flagging underperforming prompts:', error);
    }
  }

  async analyzeLibraryGaps(): Promise<void> {
    try {
      await supabase.rpc('identify_library_gaps');

      const { data: gaps } = await supabase
        .from('library_gaps')
        .select('*')
        .eq('status', 'identified')
        .order('priority_score', { ascending: false })
        .limit(10);

      if (!gaps) return;

      for (const gap of gaps) {
        await this.createInsight({
          insightType: 'gap_analysis',
          insightCategory: 'coverage',
          title: `Library Gap: ${gap.dimension_value}`,
          description: gap.gap_description,
          severity: gap.priority_score > 50 ? 'high' : 'medium',
          priority: Math.min(10, Math.floor(gap.priority_score / 10)),
          dataPoints: {
            dimensionType: gap.dimension_type,
            dimensionValue: gap.dimension_value,
            currentCoverage: gap.current_coverage,
            expectedCoverage: gap.expected_coverage,
            gapSize: gap.gap_size,
          },
          recommendedAction: `Create ${gap.gap_size} new prompts for ${gap.dimension_value}`,
          actionSteps: [
            'Review existing prompts in this category',
            'Identify missing use cases',
            'Create new prompt templates',
            'Test and publish',
          ],
          impactScore: gap.priority_score,
          confidenceScore: 80,
        });
      }
    } catch (error) {
      console.error('Error analyzing library gaps:', error);
    }
  }

  async detectDuplicates(): Promise<void> {
    try {
      const { data: prompts } = await supabase
        .from('prompt_submissions')
        .select('id, title, content')
        .eq('status', 'published')
        .limit(100);

      if (!prompts || prompts.length < 2) return;

      for (let i = 0; i < prompts.length; i++) {
        for (let j = i + 1; j < prompts.length; j++) {
          const similarity = this.calculateSimilarity(
            prompts[i].title,
            prompts[j].title,
            prompts[i].content || '',
            prompts[j].content || ''
          );

          if (similarity > 70) {
            const exists = await supabase
              .from('duplicate_candidates')
              .select('id')
              .eq('prompt_a_id', prompts[i].id)
              .eq('prompt_b_id', prompts[j].id)
              .maybeSingle();

            if (!exists.data) {
              await supabase.from('duplicate_candidates').insert({
                prompt_a_id: prompts[i].id,
                prompt_b_id: prompts[j].id,
                similarity_score: similarity,
                similarity_factors: {
                  titleMatch: prompts[i].title === prompts[j].title,
                  contentLength: {
                    a: prompts[i].content?.length || 0,
                    b: prompts[j].content?.length || 0,
                  },
                },
                recommendation:
                  similarity > 90
                    ? 'Merge these prompts'
                    : 'Review for consolidation opportunity',
              });

              await this.createInsight({
                insightType: 'duplicate',
                insightCategory: 'efficiency',
                title: 'Potential Duplicate Prompts',
                description: `"${prompts[i].title}" and "${prompts[j].title}" are ${similarity.toFixed(0)}% similar`,
                severity: similarity > 90 ? 'medium' : 'low',
                priority: similarity > 90 ? 6 : 3,
                dataPoints: { promptA: prompts[i], promptB: prompts[j], similarity },
                affectedPrompts: [prompts[i].id, prompts[j].id],
                recommendedAction: 'Review and consider merging or differentiating these prompts',
                actionSteps: [
                  'Compare both prompts side by side',
                  'Determine if they serve different purposes',
                  'Merge if truly duplicate',
                  'Clarify differences if separate',
                ],
                impactScore: 50,
                confidenceScore: similarity,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error detecting duplicates:', error);
    }
  }

  async findOptimizationOpportunities(): Promise<void> {
    try {
      const { data: prompts } = await supabase
        .from('prompt_submissions')
        .select('id, title')
        .eq('status', 'published');

      if (!prompts) return;

      for (const prompt of prompts) {
        const opportunities = await this.analyzeOptimizationPotential(prompt.id);

        for (const opp of opportunities) {
          await supabase.from('optimization_opportunities').insert({
            prompt_id: prompt.id,
            opportunity_type: opp.type,
            title: opp.title,
            description: opp.description,
            current_metrics: opp.currentMetrics,
            potential_improvement: opp.potentialImprovement,
            specific_recommendations: opp.recommendations,
            effort_level: opp.effort,
            impact_level: opp.impact,
            priority_score: opp.priorityScore,
          });

          await this.createInsight({
            insightType: 'optimization',
            insightCategory: 'efficiency',
            title: `Optimization: ${prompt.title}`,
            description: opp.description,
            severity: 'info',
            priority: opp.priorityScore / 10,
            dataPoints: {
              promptId: prompt.id,
              currentMetrics: opp.currentMetrics,
              potentialImprovement: opp.potentialImprovement,
            },
            affectedPrompts: [prompt.id],
            recommendedAction: opp.title,
            actionSteps: opp.recommendations,
            impactScore: opp.priorityScore,
            confidenceScore: 75,
          });
        }
      }
    } catch (error) {
      console.error('Error finding optimization opportunities:', error);
    }
  }

  async analyzeAdoptionTrends(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      const { data: recentEvents } = await supabase
        .from('analytics_events')
        .select('user_id')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const { data: previousEvents } = await supabase
        .from('analytics_events')
        .select('user_id')
        .gte('created_at', sixtyDaysAgo.toISOString())
        .lt('created_at', thirtyDaysAgo.toISOString());

      if (!recentEvents || !previousEvents) return;

      const recentUsers = new Set(recentEvents.map((e) => e.user_id).filter(Boolean));
      const previousUsers = new Set(previousEvents.map((e) => e.user_id).filter(Boolean));

      const growth = ((recentUsers.size - previousUsers.size) / (previousUsers.size || 1)) * 100;

      const trend = growth > 10 ? 'increasing' : growth < -10 ? 'decreasing' : 'stable';

      await this.createInsight({
        insightType: 'adoption',
        insightCategory: 'engagement',
        title: `User Adoption is ${trend}`,
        description: `Active users ${growth > 0 ? 'increased' : 'decreased'} by ${Math.abs(growth).toFixed(1)}% compared to previous period`,
        severity: growth < -20 ? 'high' : growth > 20 ? 'info' : 'low',
        priority: growth < -20 ? 8 : growth > 20 ? 5 : 2,
        dataPoints: {
          recentUsers: recentUsers.size,
          previousUsers: previousUsers.size,
          growthRate: growth,
          trend,
        },
        recommendedAction:
          growth < 0
            ? 'Investigate drop in adoption and engage with users'
            : 'Maintain momentum and continue onboarding',
        actionSteps:
          growth < 0
            ? [
                'Survey inactive users',
                'Identify friction points',
                'Improve onboarding',
                'Re-engage dormant users',
              ]
            : ['Continue current strategies', 'Document successful practices', 'Scale outreach'],
        impactScore: Math.abs(growth),
        confidenceScore: 95,
      });
    } catch (error) {
      console.error('Error analyzing adoption trends:', error);
    }
  }

  async getInsights(filters?: {
    category?: string;
    severity?: string;
    status?: string;
  }): Promise<AIInsight[]> {
    try {
      let query = supabase
        .from('ai_insights')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (filters?.category) {
        query = query.eq('insight_category', filters.category);
      }

      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      } else {
        query = query.eq('status', 'active');
      }

      const { data } = await query;

      if (!data) return [];

      return data.map((i) => ({
        id: i.id,
        insightType: i.insight_type,
        insightCategory: i.insight_category,
        title: i.title,
        description: i.description,
        severity: i.severity,
        priority: i.priority,
        dataPoints: i.data_points,
        recommendedAction: i.recommended_action,
        actionSteps: i.action_steps || [],
        impactScore: i.impact_score,
        confidenceScore: i.confidence_score,
        status: i.status,
      }));
    } catch (error) {
      console.error('Error fetching insights:', error);
      return [];
    }
  }

  private async createInsight(insight: Partial<AIInsight> & { affectedPrompts?: string[] }): Promise<void> {
    const existing = await supabase
      .from('ai_insights')
      .select('id')
      .eq('title', insight.title)
      .eq('status', 'active')
      .maybeSingle();

    if (existing.data) return;

    await supabase.from('ai_insights').insert({
      insight_type: insight.insightType,
      insight_category: insight.insightCategory,
      title: insight.title,
      description: insight.description,
      severity: insight.severity,
      priority: insight.priority,
      data_points: insight.dataPoints,
      affected_prompts: insight.affectedPrompts,
      recommended_action: insight.recommendedAction,
      action_steps: insight.actionSteps,
      impact_score: insight.impactScore,
      confidence_score: insight.confidenceScore,
    });
  }

  private async calculatePromptHealth(promptId: string): Promise<PromptHealthScore> {
    const { data: healthScore } = await supabase.rpc('calculate_prompt_health_score', {
      p_prompt_id: promptId,
    });

    const score = healthScore || 50;

    const { data: ratings } = await supabase
      .from('satisfaction_ratings')
      .select('rating')
      .eq('prompt_id', promptId);

    const avgRating = ratings && ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    const redFlags = [];
    const strengths = [];

    if (score < 60) redFlags.push('Overall health below acceptable threshold');
    if (avgRating < 3) redFlags.push('User satisfaction is low');
    if (score > 80) strengths.push('Excellent overall performance');
    if (avgRating > 4.5) strengths.push('High user satisfaction');

    return {
      promptId,
      overallScore: score,
      qualityScore: score * 0.9,
      performanceScore: score * 1.1,
      adoptionScore: score * 0.8,
      satisfactionScore: avgRating * 20,
      redFlags,
      strengths,
      needsAttention: score < 60,
    };
  }

  private calculateSimilarity(
    titleA: string,
    titleB: string,
    contentA: string,
    contentB: string
  ): number {
    const titleSim = titleA.toLowerCase() === titleB.toLowerCase() ? 100 : 0;
    const lengthSim = Math.min(
      100,
      ((contentA.length + contentB.length - Math.abs(contentA.length - contentB.length)) /
        Math.max(contentA.length, contentB.length, 1)) *
        100
    );

    return titleSim * 0.6 + lengthSim * 0.4;
  }

  private async analyzeOptimizationPotential(
    promptId: string
  ): Promise<
    Array<{
      type: string;
      title: string;
      description: string;
      currentMetrics: any;
      potentialImprovement: any;
      recommendations: string[];
      effort: string;
      impact: string;
      priorityScore: number;
    }>
  > {
    const opportunities = [];

    const { data: usage } = await supabase
      .from('analytics_events')
      .select('*')
      .eq('prompt_id', promptId)
      .eq('event_name', 'prompt_use');

    if (usage && usage.length < 10) {
      opportunities.push({
        type: 'usage_expansion',
        title: 'Increase Prompt Usage',
        description: 'This prompt has low usage. Consider promoting it or improving discoverability.',
        currentMetrics: { usageCount: usage.length },
        potentialImprovement: { targetUsage: 50 },
        recommendations: [
          'Add to featured prompts',
          'Improve description and tags',
          'Share in team channels',
        ],
        effort: 'low',
        impact: 'medium',
        priorityScore: 60,
      });
    }

    return opportunities;
  }
}

export const aiInsightsService = AIInsightsService.getInstance();
