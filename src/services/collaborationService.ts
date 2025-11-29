import { supabase } from '../lib/supabase';

export interface PromptSubmission {
  id: string;
  title: string;
  workflow: string;
  role: string;
  prompt_content: string;
  sample_output: string;
  submitter_name: string;
  status: 'pending' | 'approved' | 'changes_requested' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface PromptReview {
  id: string;
  submission_id: string;
  reviewer_name: string;
  accuracy_rating: number;
  clarity_rating: number;
  usefulness_rating: number;
  comment: string;
  action: 'approve' | 'request_changes' | 'none';
  created_at: string;
}

export interface PromptSuggestion {
  id: string;
  submission_id: string;
  suggestion_text: string;
  suggestion_type: 'clarity' | 'structure' | 'examples' | 'tone';
  is_applied: boolean;
  created_at: string;
}

export interface ContributorStats {
  id: string;
  contributor_name: string;
  submissions_count: number;
  approvals_count: number;
  reviews_count: number;
  avg_rating: number;
  points: number;
  created_at: string;
  updated_at: string;
}

export const collaborationService = {
  async submitPrompt(
    submission: Omit<PromptSubmission, 'id' | 'status' | 'created_at' | 'updated_at'>
  ): Promise<PromptSubmission | null> {
    const { data, error } = await supabase
      .from('prompt_submissions')
      .insert({
        ...submission,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error submitting prompt:', error);
      return null;
    }

    await this.updateContributorStats(submission.submitter_name, 'submission');
    return data;
  },

  async getSubmissions(status?: string): Promise<PromptSubmission[]> {
    let query = supabase
      .from('prompt_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching submissions:', error);
      return [];
    }

    return data || [];
  },

  async getSubmissionById(id: string): Promise<PromptSubmission | null> {
    const { data, error } = await supabase
      .from('prompt_submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching submission:', error);
      return null;
    }

    return data;
  },

  async updateSubmissionStatus(
    id: string,
    status: PromptSubmission['status']
  ): Promise<boolean> {
    const { error } = await supabase
      .from('prompt_submissions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating submission status:', error);
      return false;
    }

    if (status === 'approved') {
      const submission = await this.getSubmissionById(id);
      if (submission) {
        await this.updateContributorStats(submission.submitter_name, 'approval');
      }
    }

    return true;
  },

  async addReview(
    review: Omit<PromptReview, 'id' | 'created_at'>
  ): Promise<PromptReview | null> {
    const { data, error } = await supabase
      .from('prompt_reviews')
      .insert(review)
      .select()
      .single();

    if (error) {
      console.error('Error adding review:', error);
      return null;
    }

    await this.updateContributorStats(review.reviewer_name, 'review');
    await this.updateSubmitterRating(review.submission_id);

    if (review.action === 'approve') {
      await this.updateSubmissionStatus(review.submission_id, 'approved');
    } else if (review.action === 'request_changes') {
      await this.updateSubmissionStatus(review.submission_id, 'changes_requested');
    }

    return data;
  },

  async getReviews(submissionId: string): Promise<PromptReview[]> {
    const { data, error } = await supabase
      .from('prompt_reviews')
      .select('*')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      return [];
    }

    return data || [];
  },

  async addSuggestions(
    submissionId: string,
    suggestions: { text: string; type: PromptSuggestion['suggestion_type'] }[]
  ): Promise<PromptSuggestion[]> {
    const suggestionsToInsert = suggestions.map((s) => ({
      submission_id: submissionId,
      suggestion_text: s.text,
      suggestion_type: s.type,
    }));

    const { data, error } = await supabase
      .from('prompt_suggestions')
      .insert(suggestionsToInsert)
      .select();

    if (error) {
      console.error('Error adding suggestions:', error);
      return [];
    }

    return data || [];
  },

  async getSuggestions(submissionId: string): Promise<PromptSuggestion[]> {
    const { data, error } = await supabase
      .from('prompt_suggestions')
      .select('*')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }

    return data || [];
  },

  async applySuggestion(suggestionId: string): Promise<boolean> {
    const { error } = await supabase
      .from('prompt_suggestions')
      .update({ is_applied: true })
      .eq('id', suggestionId);

    if (error) {
      console.error('Error applying suggestion:', error);
      return false;
    }

    return true;
  },

  async getLeaderboard(): Promise<ContributorStats[]> {
    const { data, error } = await supabase
      .from('contributor_stats')
      .select('*')
      .order('points', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }

    return data || [];
  },

  async updateContributorStats(
    contributorName: string,
    action: 'submission' | 'review' | 'approval'
  ): Promise<void> {
    const { data: existing } = await supabase
      .from('contributor_stats')
      .select('*')
      .eq('contributor_name', contributorName)
      .maybeSingle();

    const points = action === 'submission' ? 10 : action === 'review' ? 5 : 15;

    if (existing) {
      const updates: any = {
        updated_at: new Date().toISOString(),
        points: existing.points + points,
      };

      if (action === 'submission') {
        updates.submissions_count = existing.submissions_count + 1;
      } else if (action === 'review') {
        updates.reviews_count = existing.reviews_count + 1;
      } else if (action === 'approval') {
        updates.approvals_count = existing.approvals_count + 1;
      }

      await supabase
        .from('contributor_stats')
        .update(updates)
        .eq('contributor_name', contributorName);
    } else {
      await supabase.from('contributor_stats').insert({
        contributor_name: contributorName,
        submissions_count: action === 'submission' ? 1 : 0,
        approvals_count: action === 'approval' ? 1 : 0,
        reviews_count: action === 'review' ? 1 : 0,
        points,
      });
    }
  },

  async updateSubmitterRating(submissionId: string): Promise<void> {
    const reviews = await this.getReviews(submissionId);
    if (reviews.length === 0) return;

    const submission = await this.getSubmissionById(submissionId);
    if (!submission) return;

    const totalRating =
      reviews.reduce(
        (sum, r) => sum + r.accuracy_rating + r.clarity_rating + r.usefulness_rating,
        0
      ) /
      (reviews.length * 3);

    const { data: stats } = await supabase
      .from('contributor_stats')
      .select('*')
      .eq('contributor_name', submission.submitter_name)
      .maybeSingle();

    if (stats) {
      await supabase
        .from('contributor_stats')
        .update({
          avg_rating: totalRating,
          updated_at: new Date().toISOString(),
        })
        .eq('contributor_name', submission.submitter_name);
    }
  },
};
