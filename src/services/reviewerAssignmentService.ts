import { supabase } from '../lib/supabase';

export interface AssignmentOptions {
  submissionId: string;
  expertiseArea?: string;
  requiredLevel?: 'junior' | 'senior' | 'expert' | 'any';
  minReviewers?: number;
  maxReviewers?: number;
  method?: 'automatic' | 'manual' | 'load_balanced';
}

export interface ManualAssignmentOptions {
  submissionId: string;
  reviewerIds: string[];
  assignedBy: string;
  reason?: string;
}

export interface ReviewerMetrics {
  reviewerId: string;
  reviewerEmail: string;
  totalAssignments: number;
  completedReviews: number;
  pendingReviews: number;
  completionRate: number;
  averageResponseTime: number;
  averageCompletionTime: number;
  overdueCount: number;
}

export class ReviewerAssignmentService {
  private static instance: ReviewerAssignmentService;

  private constructor() {}

  static getInstance(): ReviewerAssignmentService {
    if (!ReviewerAssignmentService.instance) {
      ReviewerAssignmentService.instance = new ReviewerAssignmentService();
    }
    return ReviewerAssignmentService.instance;
  }

  async autoAssignReviewers(options: AssignmentOptions): Promise<{
    success: boolean;
    assignedReviewers: any[];
    error?: string;
  }> {
    try {
      const {
        submissionId,
        expertiseArea,
        requiredLevel = 'senior',
        minReviewers = 2,
        maxReviewers = 3,
        method = 'load_balanced',
      } = options;

      const { data: reviewers, error: reviewerError } = await supabase.rpc(
        'get_available_reviewers_balanced',
        {
          p_expertise_area: expertiseArea || null,
          p_required_level: requiredLevel,
          p_limit: maxReviewers,
        }
      );

      if (reviewerError) throw reviewerError;

      if (!reviewers || reviewers.length < minReviewers) {
        return {
          success: false,
          assignedReviewers: [],
          error: `Not enough available reviewers. Found ${reviewers?.length || 0}, need ${minReviewers}`,
        };
      }

      const assignments = [];
      for (const reviewer of reviewers.slice(0, maxReviewers)) {
        const assignment = await this.assignReviewer({
          submissionId,
          reviewerId: reviewer.reviewer_id,
          reviewerEmail: reviewer.reviewer_email,
          reviewerLevel: reviewer.expertise_level,
          method,
          matchScore: reviewer.balance_score,
          workload: reviewer.current_workload,
        });

        if (assignment) {
          assignments.push(assignment);
        }
      }

      return {
        success: true,
        assignedReviewers: assignments,
      };
    } catch (error) {
      console.error('Error auto-assigning reviewers:', error);
      return {
        success: false,
        assignedReviewers: [],
        error: (error as Error).message,
      };
    }
  }

  async manualAssignReviewers(options: ManualAssignmentOptions): Promise<{
    success: boolean;
    assignedReviewers: any[];
    error?: string;
  }> {
    try {
      const { submissionId, reviewerIds, assignedBy, reason } = options;

      const assignments = [];
      for (const reviewerId of reviewerIds) {
        const { data: reviewer } = await supabase
          .from('submission_reviewer_expertise')
          .select('*')
          .eq('reviewer_id', reviewerId)
          .single();

        if (reviewer) {
          const assignment = await this.assignReviewer({
            submissionId,
            reviewerId: reviewer.reviewer_id,
            reviewerEmail: reviewer.reviewer_email,
            reviewerLevel: reviewer.expertise_level,
            method: 'manual',
            assignedBy,
            reason,
          });

          if (assignment) {
            assignments.push(assignment);
          }
        }
      }

      return {
        success: true,
        assignedReviewers: assignments,
      };
    } catch (error) {
      console.error('Error manually assigning reviewers:', error);
      return {
        success: false,
        assignedReviewers: [],
        error: (error as Error).message,
      };
    }
  }

  private async assignReviewer(params: {
    submissionId: string;
    reviewerId: string;
    reviewerEmail: string;
    reviewerLevel: string;
    method: string;
    assignedBy?: string;
    matchScore?: number;
    workload?: number;
    reason?: string;
  }): Promise<any> {
    try {
      const { data: existing } = await supabase
        .from('submission_reviewer_assignments')
        .select('id')
        .eq('submission_id', params.submissionId)
        .eq('reviewer_id', params.reviewerId)
        .maybeSingle();

      if (existing) {
        return null;
      }

      const { data: assignment, error } = await supabase
        .from('submission_reviewer_assignments')
        .insert({
          submission_id: params.submissionId,
          reviewer_id: params.reviewerId,
          reviewer_email: params.reviewerEmail,
          reviewer_level: params.reviewerLevel,
          assigned_by: params.assignedBy,
          assignment_reason: params.reason || 'auto_assigned',
          status: 'assigned',
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('assignment_history').insert({
        submission_id: params.submissionId,
        assignment_id: assignment.id,
        action: params.method === 'manual' ? 'manually_assigned' : 'auto_assigned',
        assigned_by: params.assignedBy,
        assigned_to: params.reviewerId,
        assignment_method: params.method,
        match_score: params.matchScore,
        workload_at_assignment: params.workload,
        reason: params.reason,
      });

      await supabase
        .from('submission_reviewer_expertise')
        .update({ current_review_count: supabase.rpc('increment', { x: 1 }) })
        .eq('reviewer_id', params.reviewerId);

      await this.sendAssignmentNotification(assignment);

      return assignment;
    } catch (error) {
      console.error('Error assigning reviewer:', error);
      return null;
    }
  }

  async reassignReviewer(
    assignmentId: string,
    newReviewerId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: oldAssignment } = await supabase
        .from('submission_reviewer_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      if (!oldAssignment) {
        return { success: false, error: 'Assignment not found' };
      }

      await supabase
        .from('submission_reviewer_assignments')
        .update({ status: 'removed' })
        .eq('id', assignmentId);

      await supabase
        .from('submission_reviewer_expertise')
        .update({ current_review_count: supabase.rpc('decrement', { x: 1 }) })
        .eq('reviewer_id', oldAssignment.reviewer_id);

      const { data: newReviewer } = await supabase
        .from('submission_reviewer_expertise')
        .select('*')
        .eq('reviewer_id', newReviewerId)
        .single();

      if (!newReviewer) {
        return { success: false, error: 'New reviewer not found' };
      }

      const newAssignment = await this.assignReviewer({
        submissionId: oldAssignment.submission_id,
        reviewerId: newReviewer.reviewer_id,
        reviewerEmail: newReviewer.reviewer_email,
        reviewerLevel: newReviewer.expertise_level,
        method: 'manual',
        reason,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async getReviewerMetrics(reviewerId: string): Promise<ReviewerMetrics | null> {
    try {
      const { data } = await supabase
        .from('reviewer_analytics')
        .select('*')
        .eq('reviewer_id', reviewerId)
        .single();

      if (!data) return null;

      return {
        reviewerId: data.reviewer_id,
        reviewerEmail: data.reviewer_email,
        totalAssignments: data.total_assignments,
        completedReviews: data.completed_reviews,
        pendingReviews: data.pending_reviews,
        completionRate: data.completion_rate,
        averageResponseTime: data.average_response_time_hours,
        averageCompletionTime: data.average_completion_time_hours,
        overdueCount: data.overdue_count,
      };
    } catch (error) {
      console.error('Error fetching reviewer metrics:', error);
      return null;
    }
  }

  async getAllReviewerMetrics(): Promise<ReviewerMetrics[]> {
    try {
      const { data } = await supabase
        .from('reviewer_analytics')
        .select('*')
        .order('completion_rate', { ascending: false });

      if (!data) return [];

      return data.map((d) => ({
        reviewerId: d.reviewer_id,
        reviewerEmail: d.reviewer_email,
        totalAssignments: d.total_assignments,
        completedReviews: d.completed_reviews,
        pendingReviews: d.pending_reviews,
        completionRate: d.completion_rate,
        averageResponseTime: d.average_response_time_hours,
        averageCompletionTime: d.average_completion_time_hours,
        overdueCount: d.overdue_count,
      }));
    } catch (error) {
      console.error('Error fetching all reviewer metrics:', error);
      return [];
    }
  }

  async updateReviewerAnalytics(reviewerId: string): Promise<void> {
    try {
      await supabase.rpc('update_reviewer_analytics', {
        p_reviewer_id: reviewerId,
      });
    } catch (error) {
      console.error('Error updating reviewer analytics:', error);
    }
  }

  async getWorkloadSnapshot(reviewerId?: string): Promise<any[]> {
    try {
      let query = supabase
        .from('workload_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false });

      if (reviewerId) {
        query = query.eq('reviewer_id', reviewerId);
      }

      const { data } = await query.limit(30);
      return data || [];
    } catch (error) {
      console.error('Error fetching workload snapshot:', error);
      return [];
    }
  }

  async balanceWorkload(): Promise<{ success: boolean; rebalanced: number }> {
    try {
      const { data: overloaded } = await supabase
        .from('submission_reviewer_expertise')
        .select('*')
        .gte('current_review_count', supabase.rpc('max_concurrent_reviews'))
        .eq('is_active', true);

      const { data: underutilized } = await supabase
        .from('submission_reviewer_expertise')
        .select('*')
        .lt('current_review_count', 2)
        .eq('is_active', true)
        .eq('is_available', true);

      let rebalancedCount = 0;

      if (overloaded && underutilized && underutilized.length > 0) {
        for (const reviewer of overloaded) {
          const { data: assignments } = await supabase
            .from('submission_reviewer_assignments')
            .select('*')
            .eq('reviewer_id', reviewer.reviewer_id)
            .eq('status', 'assigned')
            .order('assigned_at', { ascending: true })
            .limit(1);

          if (assignments && assignments.length > 0) {
            const targetReviewer = underutilized[0];
            await this.reassignReviewer(
              assignments[0].id,
              targetReviewer.reviewer_id,
              'workload_balancing'
            );
            rebalancedCount++;
          }
        }
      }

      return { success: true, rebalanced: rebalancedCount };
    } catch (error) {
      console.error('Error balancing workload:', error);
      return { success: false, rebalanced: 0 };
    }
  }

  private async sendAssignmentNotification(assignment: any): Promise<void> {
    try {
      const { data: submission } = await supabase
        .from('prompt_submissions')
        .select('*')
        .eq('id', assignment.submission_id)
        .single();

      if (!submission) return;

      const reviewUrl = `${window.location.origin}/peer-review?submission=${submission.id}`;

      await supabase.from('submission_notifications').insert({
        recipient_id: assignment.reviewer_id,
        recipient_email: assignment.reviewer_email,
        submission_id: submission.id,
        notification_type: 'assignment',
        title: 'New Review Assignment',
        message: `You have been assigned to review: ${submission.title}`,
        action_url: reviewUrl,
        priority: 'normal',
      });

      await supabase.from('email_queue').insert({
        recipient_id: assignment.reviewer_id,
        recipient_email: assignment.reviewer_email,
        subject: `New Review Assignment: ${submission.title}`,
        body_html: this.generateAssignmentEmailHtml(submission, assignment, reviewUrl),
        body_text: this.generateAssignmentEmailText(submission, assignment, reviewUrl),
        email_type: 'assignment',
        priority: 'normal',
        related_submission_id: submission.id,
      });
    } catch (error) {
      console.error('Error sending assignment notification:', error);
    }
  }

  private generateAssignmentEmailHtml(
    submission: any,
    assignment: any,
    reviewUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Review Assignment</h1>
          </div>
          <div class="content">
            <p>Hello ${assignment.reviewer_email},</p>
            <p>You have been assigned a new prompt to review.</p>

            <div class="details">
              <h3>${submission.title}</h3>
              <p><strong>Workflow:</strong> ${submission.workflow}</p>
              <p><strong>Role:</strong> ${submission.role}</p>
              <p><strong>Description:</strong> ${submission.description || 'N/A'}</p>
              <p><strong>Required by:</strong> ${new Date(Date.now() + 72 * 60 * 60 * 1000).toLocaleString()}</p>
            </div>

            <p>Please review this prompt at your earliest convenience. Click the button below to start your review:</p>

            <a href="${reviewUrl}" class="button">Start Review</a>

            <p>If you have any questions, please contact the submission team.</p>
          </div>
          <div class="footer">
            <p>This is an automated notification from the Peer Review System.</p>
            <p>If you no longer wish to receive these emails, please update your notification preferences.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateAssignmentEmailText(
    submission: any,
    assignment: any,
    reviewUrl: string
  ): string {
    return `
New Review Assignment

Hello ${assignment.reviewer_email},

You have been assigned a new prompt to review.

Title: ${submission.title}
Workflow: ${submission.workflow}
Role: ${submission.role}
Description: ${submission.description || 'N/A'}
Required by: ${new Date(Date.now() + 72 * 60 * 60 * 1000).toLocaleString()}

Please review this prompt at your earliest convenience.

Review URL: ${reviewUrl}

If you have any questions, please contact the submission team.

---
This is an automated notification from the Peer Review System.
    `.trim();
  }
}

export const reviewerAssignmentService = ReviewerAssignmentService.getInstance();
