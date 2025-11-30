import { supabase } from '../lib/supabase';

export interface SubmissionData {
  title: string;
  workflow: string;
  role: string;
  description: string;
  promptText: string;
  sampleOutput: string;
  requiredApprovals?: number;
  reviewerLevel?: 'junior' | 'senior' | 'expert' | 'any';
  tags?: string[];
}

export interface ReviewData {
  submissionId: string;
  accuracyRating: number;
  clarityRating: number;
  usefulnessRating: number;
  completenessRating: number;
  overallRating: number;
  strengths?: string;
  weaknesses?: string;
  suggestions?: string;
  detailedFeedback?: string;
  recommendation: 'approve' | 'request_changes' | 'reject';
}

export interface CommentData {
  submissionId: string;
  reviewId?: string;
  parentCommentId?: string;
  commentText: string;
  commentType?: 'general' | 'question' | 'suggestion' | 'concern' | 'praise';
}

export interface NotificationData {
  recipientId: string;
  recipientEmail: string;
  submissionId?: string;
  reviewId?: string;
  commentId?: string;
  notificationType: string;
  title: string;
  message: string;
  actionUrl?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export class PeerReviewService {
  private static instance: PeerReviewService;

  private constructor() {}

  static getInstance(): PeerReviewService {
    if (!PeerReviewService.instance) {
      PeerReviewService.instance = new PeerReviewService();
    }
    return PeerReviewService.instance;
  }

  async submitPrompt(data: SubmissionData): Promise<{ id: string | null; error: Error | null }> {
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const { data: submission, error } = await supabase
        .from('prompt_submissions')
        .insert({
          submitter_id: user.id,
          submitter_name: user.email || 'Anonymous',
          title: data.title,
          workflow: data.workflow,
          role: data.role,
          description: data.description,
          prompt_content: data.promptText,
          sample_output: data.sampleOutput,
          required_approvals: data.requiredApprovals || 2,
          reviewer_level: data.reviewerLevel || 'senior',
          status: 'pending',
          submission_version: 1,
        })
        .select()
        .single();

      if (error) throw error;

      await this.logAuditEvent({
        submissionId: submission.id,
        actorId: user.id,
        actorEmail: user.email!,
        action: 'created',
        entityType: 'submission',
        entityId: submission.id,
        newValue: submission,
      });

      await this.autoAssignReviewers(submission.id, data.workflow, data.role, data.reviewerLevel || 'senior');

      return { id: submission.id, error: null };
    } catch (error) {
      return { id: null, error: error as Error };
    }
  }

  async resubmitPrompt(
    parentSubmissionId: string,
    data: SubmissionData
  ): Promise<{ id: string | null; error: Error | null }> {
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const { data: parentSubmission } = await supabase
        .from('prompt_submissions')
        .select('submission_version')
        .eq('id', parentSubmissionId)
        .single();

      const newVersion = (parentSubmission?.submission_version || 0) + 1;

      const { data: submission, error } = await supabase
        .from('prompt_submissions')
        .insert({
          submitter_id: user.id,
          submitter_name: user.email || 'Anonymous',
          parent_submission_id: parentSubmissionId,
          submission_version: newVersion,
          title: data.title,
          workflow: data.workflow,
          role: data.role,
          description: data.description,
          prompt_content: data.promptText,
          sample_output: data.sampleOutput,
          required_approvals: data.requiredApprovals || 2,
          reviewer_level: data.reviewerLevel || 'senior',
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      await this.logAuditEvent({
        submissionId: submission.id,
        actorId: user.id,
        actorEmail: user.email!,
        action: 'resubmitted',
        entityType: 'submission',
        entityId: submission.id,
        newValue: submission,
        metadata: { parentSubmissionId, version: newVersion },
      });

      await this.notifyPreviousReviewers(parentSubmissionId, submission.id);

      return { id: submission.id, error: null };
    } catch (error) {
      return { id: null, error: error as Error };
    }
  }

  async submitReview(data: ReviewData): Promise<{ id: string | null; error: Error | null }> {
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const { data: review, error } = await supabase
        .from('prompt_reviews')
        .insert({
          submission_id: data.submissionId,
          reviewer_id: user.id,
          reviewer_name: user.email || 'Anonymous',
          accuracy_rating: data.accuracyRating,
          clarity_rating: data.clarityRating,
          usefulness_rating: data.usefulnessRating,
          completeness_rating: data.completenessRating,
          overall_rating: data.overallRating,
          strengths: data.strengths,
          weaknesses: data.weaknesses,
          suggestions: data.suggestions,
          comment: data.detailedFeedback || '',
          recommendation: data.recommendation,
          action: data.recommendation === 'approve' ? 'approve' : 'request_changes',
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('submission_reviewer_assignments')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('submission_id', data.submissionId)
        .eq('reviewer_id', user.id);

      await this.logAuditEvent({
        submissionId: data.submissionId,
        actorId: user.id,
        actorEmail: user.email!,
        action: 'reviewed',
        entityType: 'review',
        entityId: review.id,
        newValue: review,
      });

      if (data.recommendation === 'approve') {
        const isApproved = await this.checkAndProcessApproval(data.submissionId, review.id);
        if (isApproved) {
          await this.notifySubmitter(data.submissionId, 'approved', 'Your submission has been approved!');
        }
      } else if (data.recommendation === 'reject') {
        await this.notifySubmitter(data.submissionId, 'rejected', 'Your submission requires changes.');
      } else {
        await this.notifySubmitter(data.submissionId, 'changes_requested', 'Changes have been requested for your submission.');
      }

      return { id: review.id, error: null };
    } catch (error) {
      return { id: null, error: error as Error };
    }
  }

  async addComment(data: CommentData): Promise<{ id: string | null; error: Error | null }> {
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      let threadDepth = 0;
      if (data.parentCommentId) {
        const { data: parentComment } = await supabase
          .from('submission_comments')
          .select('thread_depth')
          .eq('id', data.parentCommentId)
          .single();

        threadDepth = (parentComment?.thread_depth || 0) + 1;
      }

      const { data: comment, error } = await supabase
        .from('submission_comments')
        .insert({
          submission_id: data.submissionId,
          review_id: data.reviewId,
          parent_comment_id: data.parentCommentId,
          commenter_id: user.id,
          commenter_name: user.email || 'Anonymous',
          comment_text: data.commentText,
          comment_type: data.commentType || 'general',
          thread_depth: threadDepth,
        })
        .select()
        .single();

      if (error) throw error;

      await this.logAuditEvent({
        submissionId: data.submissionId,
        actorId: user.id,
        actorEmail: user.email!,
        action: 'commented',
        entityType: 'comment',
        entityId: comment.id,
        newValue: comment,
      });

      await this.notifyCommentParticipants(data.submissionId, comment.id, data.parentCommentId);

      return { id: comment.id, error: null };
    } catch (error) {
      return { id: null, error: error as Error };
    }
  }

  async getSubmission(submissionId: string): Promise<any> {
    const { data } = await supabase
      .from('prompt_submissions')
      .select(`
        *,
        submission_reviewer_assignments(*),
        prompt_reviews(*),
        submission_comments(*),
        submission_approvals(*)
      `)
      .eq('id', submissionId)
      .single();

    return data;
  }

  async getMySubmissions(): Promise<any[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];

    const { data } = await supabase
      .from('prompt_submissions')
      .select('*, prompt_reviews(count)')
      .eq('submitter_id', user.id)
      .order('created_at', { ascending: false });

    return data || [];
  }

  async getMyAssignments(): Promise<any[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];

    const { data } = await supabase
      .from('submission_reviewer_assignments')
      .select('*, prompt_submissions(*)')
      .eq('reviewer_id', user.id)
      .order('assigned_at', { ascending: false });

    return data || [];
  }

  async getMyNotifications(): Promise<any[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];

    const { data } = await supabase
      .from('submission_notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(50);

    return data || [];
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    await supabase
      .from('submission_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);
  }

  async getSubmissionAuditLog(submissionId: string): Promise<any[]> {
    const { data } = await supabase
      .from('submission_audit_log')
      .select('*')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: false });

    return data || [];
  }

  async getWorkflowConfig(workflowName: string): Promise<any> {
    const { data } = await supabase
      .from('submission_workflow_config')
      .select('*')
      .eq('workflow_name', workflowName)
      .eq('is_active', true)
      .single();

    return data;
  }

  private async autoAssignReviewers(
    submissionId: string,
    workflow: string,
    role: string,
    requiredLevel: string
  ): Promise<void> {
    try {
      const config = await this.getWorkflowConfig(workflow);
      const minReviewers = config?.min_reviewers || 2;

      const { data: reviewers } = await supabase.rpc('find_available_reviewers', {
        p_workflow: workflow,
        p_role: role,
        p_required_level: requiredLevel,
        p_limit: minReviewers,
      });

      if (reviewers && reviewers.length > 0) {
        const assignments = reviewers.map((reviewer: any) => ({
          submission_id: submissionId,
          reviewer_id: reviewer.reviewer_id,
          reviewer_email: reviewer.reviewer_email,
          reviewer_level: reviewer.expertise_level,
          assignment_reason: 'auto_assigned',
        }));

        await supabase.from('submission_reviewer_assignments').insert(assignments);

        for (const reviewer of reviewers) {
          await this.sendNotification({
            recipientId: reviewer.reviewer_id,
            recipientEmail: reviewer.reviewer_email,
            submissionId,
            notificationType: 'assignment',
            title: 'New Review Assignment',
            message: 'You have been assigned a new prompt to review',
            priority: 'normal',
          });
        }
      }
    } catch (error) {
      console.error('Error auto-assigning reviewers:', error);
    }
  }

  private async checkAndProcessApproval(submissionId: string, reviewId: string): Promise<boolean> {
    try {
      const { data: isApproved } = await supabase.rpc('check_submission_approval_criteria', {
        p_submission_id: submissionId,
      });

      if (isApproved) {
        await supabase
          .from('prompt_submissions')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
          })
          .eq('id', submissionId);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking approval:', error);
      return false;
    }
  }

  private async notifySubmitter(submissionId: string, type: string, message: string): Promise<void> {
    try {
      const { data: submission } = await supabase
        .from('prompt_submissions')
        .select('submitter_id, submitter_name')
        .eq('id', submissionId)
        .single();

      if (submission?.submitter_id) {
        await this.sendNotification({
          recipientId: submission.submitter_id,
          recipientEmail: submission.submitter_name,
          submissionId,
          notificationType: type,
          title: message,
          message,
          priority: 'high',
        });
      }
    } catch (error) {
      console.error('Error notifying submitter:', error);
    }
  }

  private async notifyPreviousReviewers(oldSubmissionId: string, newSubmissionId: string): Promise<void> {
    try {
      const { data: reviewers } = await supabase
        .from('submission_reviewer_assignments')
        .select('reviewer_id, reviewer_email')
        .eq('submission_id', oldSubmissionId);

      if (reviewers) {
        for (const reviewer of reviewers) {
          await this.sendNotification({
            recipientId: reviewer.reviewer_id,
            recipientEmail: reviewer.reviewer_email,
            submissionId: newSubmissionId,
            notificationType: 'resubmission',
            title: 'Prompt Resubmitted',
            message: 'A prompt you reviewed has been resubmitted with updates',
            priority: 'normal',
          });
        }
      }
    } catch (error) {
      console.error('Error notifying reviewers:', error);
    }
  }

  private async notifyCommentParticipants(
    submissionId: string,
    commentId: string,
    parentCommentId?: string
  ): Promise<void> {
    try {
      const { data: submission } = await supabase
        .from('prompt_submissions')
        .select('submitter_id, submitter_name')
        .eq('id', submissionId)
        .single();

      if (submission?.submitter_id) {
        await this.sendNotification({
          recipientId: submission.submitter_id,
          recipientEmail: submission.submitter_name,
          submissionId,
          commentId,
          notificationType: 'new_comment',
          title: 'New Comment',
          message: 'A new comment has been added to your submission',
          priority: 'normal',
        });
      }

      if (parentCommentId) {
        const { data: parentComment } = await supabase
          .from('submission_comments')
          .select('commenter_id, commenter_name')
          .eq('id', parentCommentId)
          .single();

        if (parentComment?.commenter_id && parentComment.commenter_id !== submission?.submitter_id) {
          await this.sendNotification({
            recipientId: parentComment.commenter_id,
            recipientEmail: parentComment.commenter_name,
            submissionId,
            commentId,
            notificationType: 'new_comment',
            title: 'Reply to Your Comment',
            message: 'Someone replied to your comment',
            priority: 'normal',
          });
        }
      }
    } catch (error) {
      console.error('Error notifying comment participants:', error);
    }
  }

  private async sendNotification(data: NotificationData): Promise<void> {
    try {
      await supabase.from('submission_notifications').insert({
        recipient_id: data.recipientId,
        recipient_email: data.recipientEmail,
        submission_id: data.submissionId,
        review_id: data.reviewId,
        comment_id: data.commentId,
        notification_type: data.notificationType,
        title: data.title,
        message: data.message,
        action_url: data.actionUrl,
        priority: data.priority || 'normal',
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  private async logAuditEvent(event: {
    submissionId: string;
    actorId: string;
    actorEmail: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValue?: any;
    newValue?: any;
    reason?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await supabase.from('submission_audit_log').insert({
        submission_id: event.submissionId,
        actor_id: event.actorId,
        actor_email: event.actorEmail,
        action: event.action,
        entity_type: event.entityType,
        entity_id: event.entityId,
        old_value: event.oldValue || null,
        new_value: event.newValue || null,
        reason: event.reason,
        metadata: event.metadata || {},
      });
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  }

  private async getCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  }
}

export const peerReviewService = PeerReviewService.getInstance();
