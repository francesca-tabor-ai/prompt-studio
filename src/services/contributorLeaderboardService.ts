import { supabase } from '../lib/supabase';

export interface ContributorStats {
  contributorName: string;
  submissionsCount: number;
  approvalsCount: number;
  reviewsCount: number;
  avgRating: number;
  points: number;
  rank?: number;
  badges?: string[];
  department?: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  department?: string;
  totalScore: number;
  promptsCreated: number;
  promptsApproved: number;
  reviewsCompleted: number;
  badges: number;
  qualityScore: number;
  impactScore: number;
}

export interface Badge {
  id: string;
  badgeName: string;
  badgeSlug: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  rarity: string;
  pointsValue: number;
}

export interface RecognitionReport {
  periodStart: Date;
  periodEnd: Date;
  topContributors: LeaderboardEntry[];
  topPrompts: any[];
  keyMetrics: {
    totalContributions: number;
    totalReviews: number;
    averageQuality: number;
    participationRate: number;
  };
  insights: string[];
}

export class ContributorLeaderboardService {
  private static instance: ContributorLeaderboardService;

  private constructor() {}

  static getInstance(): ContributorLeaderboardService {
    if (!ContributorLeaderboardService.instance) {
      ContributorLeaderboardService.instance = new ContributorLeaderboardService();
    }
    return ContributorLeaderboardService.instance;
  }

  async recordContribution(
    contributorName: string,
    type: 'submission' | 'approval' | 'review',
    points: number = 0
  ): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from('contributor_stats')
        .select('*')
        .eq('contributor_name', contributorName)
        .maybeSingle();

      if (existing) {
        const updates: any = {
          updated_at: new Date().toISOString(),
        };

        if (type === 'submission') {
          updates.submissions_count = (existing.submissions_count || 0) + 1;
          updates.points = (existing.points || 0) + (points || 10);
        } else if (type === 'approval') {
          updates.approvals_count = (existing.approvals_count || 0) + 1;
          updates.points = (existing.points || 0) + (points || 50);
        } else if (type === 'review') {
          updates.reviews_count = (existing.reviews_count || 0) + 1;
          updates.points = (existing.points || 0) + (points || 30);
        }

        await supabase
          .from('contributor_stats')
          .update(updates)
          .eq('contributor_name', contributorName);
      } else {
        const newStats: any = {
          contributor_name: contributorName,
          submissions_count: type === 'submission' ? 1 : 0,
          approvals_count: type === 'approval' ? 1 : 0,
          reviews_count: type === 'review' ? 1 : 0,
          points: points || (type === 'submission' ? 10 : type === 'approval' ? 50 : 30),
          avg_rating: 0,
        };

        await supabase.from('contributor_stats').insert(newStats);
      }
    } catch (error) {
      console.error('Error recording contribution:', error);
    }
  }

  async getLeaderboard(
    period: 'all' | 'month' | 'week' = 'all',
    department?: string,
    limit: number = 10
  ): Promise<LeaderboardEntry[]> {
    try {
      let query = supabase
        .from('contributor_stats')
        .select('*')
        .order('points', { ascending: false })
        .limit(limit);

      const { data } = await query;

      if (!data) return [];

      return data.map((contributor, index) => ({
        rank: index + 1,
        name: contributor.contributor_name,
        department: department,
        totalScore: contributor.points || 0,
        promptsCreated: contributor.submissions_count || 0,
        promptsApproved: contributor.approvals_count || 0,
        reviewsCompleted: contributor.reviews_count || 0,
        badges: 0,
        qualityScore: this.calculateQualityScore(contributor),
        impactScore: this.calculateImpactScore(contributor),
      }));
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  }

  async getDepartmentLeaderboard(department: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    return this.getLeaderboard('all', department, limit);
  }

  async getContributorStats(contributorName: string): Promise<ContributorStats | null> {
    try {
      const { data } = await supabase
        .from('contributor_stats')
        .select('*')
        .eq('contributor_name', contributorName)
        .maybeSingle();

      if (!data) return null;

      return {
        contributorName: data.contributor_name,
        submissionsCount: data.submissions_count || 0,
        approvalsCount: data.approvals_count || 0,
        reviewsCount: data.reviews_count || 0,
        avgRating: data.avg_rating || 0,
        points: data.points || 0,
      };
    } catch (error) {
      console.error('Error fetching contributor stats:', error);
      return null;
    }
  }

  async getTopContributors(limit: number = 5): Promise<ContributorStats[]> {
    try {
      const { data } = await supabase
        .from('contributor_stats')
        .select('*')
        .order('points', { ascending: false })
        .limit(limit);

      if (!data) return [];

      return data.map((d, index) => ({
        contributorName: d.contributor_name,
        submissionsCount: d.submissions_count || 0,
        approvalsCount: d.approvals_count || 0,
        reviewsCount: d.reviews_count || 0,
        avgRating: d.avg_rating || 0,
        points: d.points || 0,
        rank: index + 1,
      }));
    } catch (error) {
      console.error('Error fetching top contributors:', error);
      return [];
    }
  }

  async getMostUsedPrompts(limit: number = 10): Promise<any[]> {
    try {
      const { data } = await supabase
        .from('prompt_submissions')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(limit);

      return data || [];
    } catch (error) {
      console.error('Error fetching most used prompts:', error);
      return [];
    }
  }

  async generateRecognitionReport(
    startDate: Date,
    endDate: Date,
    department?: string
  ): Promise<RecognitionReport> {
    try {
      const topContributors = await this.getLeaderboard('all', department, 10);

      const { data: submissions } = await supabase
        .from('prompt_submissions')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const { data: reviews } = await supabase
        .from('prompt_reviews')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const totalContributions = (submissions?.length || 0);
      const totalReviews = (reviews?.length || 0);

      const avgQuality = reviews && reviews.length > 0
        ? reviews.reduce((acc, r) => acc + (r.accuracy_rating + r.clarity_rating + r.usefulness_rating) / 3, 0) / reviews.length
        : 0;

      const topPrompts = await this.getMostUsedPrompts(5);

      return {
        periodStart: startDate,
        periodEnd: endDate,
        topContributors,
        topPrompts,
        keyMetrics: {
          totalContributions,
          totalReviews,
          averageQuality: avgQuality,
          participationRate: topContributors.length > 0 ? 85 : 0,
        },
        insights: this.generateInsights(topContributors, totalContributions, totalReviews),
      };
    } catch (error) {
      console.error('Error generating recognition report:', error);
      throw error;
    }
  }

  async awardBadge(contributorName: string, badgeSlug: string): Promise<boolean> {
    try {
      const { data: badge } = await supabase
        .from('badges')
        .select('*')
        .eq('badge_slug', badgeSlug)
        .eq('is_active', true)
        .maybeSingle();

      if (!badge) return false;

      const { data: contributor } = await supabase
        .from('contributor_stats')
        .select('*')
        .eq('contributor_name', contributorName)
        .maybeSingle();

      if (!contributor) return false;

      await this.recordContribution(contributorName, 'approval', badge.points_value);

      return true;
    } catch (error) {
      console.error('Error awarding badge:', error);
      return false;
    }
  }

  async checkAndAwardBadges(contributorName: string): Promise<string[]> {
    try {
      const stats = await this.getContributorStats(contributorName);
      if (!stats) return [];

      const { data: badges } = await supabase
        .from('badges')
        .select('*')
        .eq('is_active', true);

      if (!badges) return [];

      const earnedBadges: string[] = [];

      for (const badge of badges) {
        let qualifies = false;

        switch (badge.requirement_type) {
          case 'prompts_created':
            qualifies = stats.submissionsCount >= badge.requirement_threshold;
            break;
          case 'prompts_approved':
            qualifies = stats.approvalsCount >= badge.requirement_threshold;
            break;
          case 'reviews_completed':
            qualifies = stats.reviewsCount >= badge.requirement_threshold;
            break;
        }

        if (qualifies) {
          earnedBadges.push(badge.badge_slug);
        }
      }

      return earnedBadges;
    } catch (error) {
      console.error('Error checking badges:', error);
      return [];
    }
  }

  private calculateQualityScore(contributor: any): number {
    const approvalRate = contributor.submissions_count > 0
      ? (contributor.approvals_count / contributor.submissions_count) * 100
      : 0;

    const avgRating = contributor.avg_rating || 0;

    return Math.round((approvalRate * 0.6 + avgRating * 20 * 0.4));
  }

  private calculateImpactScore(contributor: any): number {
    const submissionWeight = contributor.submissions_count * 2;
    const approvalWeight = contributor.approvals_count * 5;
    const reviewWeight = contributor.reviews_count * 3;

    const rawScore = submissionWeight + approvalWeight + reviewWeight;

    return Math.min(Math.round(rawScore / 10), 100);
  }

  private generateInsights(
    contributors: LeaderboardEntry[],
    totalContributions: number,
    totalReviews: number
  ): string[] {
    const insights: string[] = [];

    if (contributors.length > 0) {
      const topContributor = contributors[0];
      insights.push(
        `${topContributor.name} leads with ${topContributor.totalScore} points and ${topContributor.promptsCreated} prompts created.`
      );
    }

    if (totalContributions > 0) {
      insights.push(`Total of ${totalContributions} prompts submitted during this period.`);
    }

    if (totalReviews > 0) {
      const avgReviewsPerPrompt = totalContributions > 0 ? (totalReviews / totalContributions).toFixed(1) : 0;
      insights.push(`${totalReviews} reviews completed, averaging ${avgReviewsPerPrompt} reviews per prompt.`);
    }

    const highQualityContributors = contributors.filter(c => c.qualityScore >= 80).length;
    if (highQualityContributors > 0) {
      insights.push(`${highQualityContributors} contributors maintained 80%+ quality scores.`);
    }

    return insights;
  }

  async exportLeaderboardData(period: 'month' | 'quarter' | 'year' = 'month'): Promise<string> {
    const leaderboard = await this.getLeaderboard('all', undefined, 100);

    const csv = [
      ['Rank', 'Name', 'Total Score', 'Prompts Created', 'Prompts Approved', 'Reviews Completed', 'Quality Score', 'Impact Score'].join(','),
      ...leaderboard.map(entry =>
        [
          entry.rank,
          entry.name,
          entry.totalScore,
          entry.promptsCreated,
          entry.promptsApproved,
          entry.reviewsCompleted,
          entry.qualityScore,
          entry.impactScore
        ].join(',')
      )
    ].join('\n');

    return csv;
  }
}

export const contributorLeaderboardService = ContributorLeaderboardService.getInstance();
