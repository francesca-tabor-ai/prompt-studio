import { supabase } from '../lib/supabase';

export interface ApprovalQueueItem {
  id: string;
  promptId: string;
  queueStatus: string;
  submissionType: string;
  priority: number;
  submittedBy: string;
  submittedAt: string;
  assignedTo?: string;
  department?: string;
  workflow?: string;
  slaDeadline?: string;
  isSlaBreach: boolean;
  requiresTesting: boolean;
  requiresPeerReview: boolean;
}

export interface ApprovalAction {
  actionType: 'approve' | 'reject' | 'request_revision' | 'assign' | 'escalate';
  decision: string;
  reason?: string;
  comments?: string;
  conditions?: any;
  approvalScope?: string;
  restrictedToDepartments?: string[];
  restrictedToWorkflows?: string[];
  requestedChanges?: string[];
}

export interface RevisionRequest {
  id: string;
  promptId: string;
  requestedBy: string;
  revisionType: string;
  requestedChanges: string[];
  detailedFeedback?: string;
  priority: string;
  status: string;
}

export class ApprovalWorkflowService {
  private static instance: ApprovalWorkflowService;

  private constructor() {}

  static getInstance(): ApprovalWorkflowService {
    if (!ApprovalWorkflowService.instance) {
      ApprovalWorkflowService.instance = new ApprovalWorkflowService();
    }
    return ApprovalWorkflowService.instance;
  }

  async submitForApproval(
    promptId: string,
    options?: {
      priority?: number;
      requiresTesting?: boolean;
      requiresPeerReview?: boolean;
      department?: string;
      workflow?: string;
    }
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const slaConfig = await this.getSLAConfig(options?.department, options?.priority);
      const slaDeadline = this.calculateSLADeadline(new Date(), slaConfig.targetHours);

      const { data: queueItem, error } = await supabase
        .from('approval_queue')
        .insert({
          prompt_id: promptId,
          queue_status: 'pending',
          submission_type: 'new',
          priority: options?.priority || 5,
          submitted_by: user?.id,
          department: options?.department,
          workflow: options?.workflow,
          requires_testing: options?.requiresTesting || false,
          requires_peer_review: options?.requiresPeerReview || false,
          sla_deadline: slaDeadline.toISOString(),
        })
        .select()
        .single();

      if (error || !queueItem) throw error;

      await this.createSLATracking(queueItem.id, promptId, slaConfig);

      await this.logHistory(promptId, queueItem.id, 'draft', 'pending', user?.id || '', 'submitted');

      return queueItem.id;
    } catch (error) {
      console.error('Error submitting for approval:', error);
      throw error;
    }
  }

  async getApprovalQueue(filters?: {
    status?: string;
    assignedTo?: string;
    department?: string;
    slaBreach?: boolean;
  }): Promise<ApprovalQueueItem[]> {
    try {
      let query = supabase
        .from('approval_queue')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (filters?.status) {
        query = query.eq('queue_status', filters.status);
      }

      if (filters?.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }

      if (filters?.department) {
        query = query.eq('department', filters.department);
      }

      if (filters?.slaBreach) {
        query = query.eq('is_sla_breached', true);
      }

      const { data } = await query;

      if (!data) return [];

      return data.map((item) => ({
        id: item.id,
        promptId: item.prompt_id,
        queueStatus: item.queue_status,
        submissionType: item.submission_type,
        priority: item.priority,
        submittedBy: item.submitted_by,
        submittedAt: item.submitted_at,
        assignedTo: item.assigned_to,
        department: item.department,
        workflow: item.workflow,
        slaDeadline: item.sla_deadline,
        isSlaBreach: item.is_sla_breached,
        requiresTesting: item.requires_testing,
        requiresPeerReview: item.requires_peer_review,
      }));
    } catch (error) {
      console.error('Error fetching approval queue:', error);
      return [];
    }
  }

  async processApprovalAction(
    queueId: string,
    action: ApprovalAction
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: queueItem } = await supabase
        .from('approval_queue')
        .select('prompt_id, queue_status')
        .eq('id', queueId)
        .single();

      if (!queueItem) throw new Error('Queue item not found');

      await supabase.from('approval_actions').insert({
        queue_id: queueId,
        prompt_id: queueItem.prompt_id,
        action_type: action.actionType,
        decision: action.decision,
        admin_id: user?.id,
        admin_email: user?.email,
        reason: action.reason,
        comments: action.comments,
        conditions: action.conditions,
        approval_scope: action.approvalScope,
        restricted_to_departments: action.restrictedToDepartments,
        restricted_to_workflows: action.restrictedToWorkflows,
        requires_changes: action.requestedChanges ? action.requestedChanges.length > 0 : false,
        requested_changes: action.requestedChanges,
      });

      let newStatus = queueItem.queue_status;
      let promptStatus = 'under_review';

      switch (action.actionType) {
        case 'approve':
          newStatus = 'approved';
          promptStatus = action.approvalScope === 'conditional' ? 'conditionally_approved' : 'published';
          break;
        case 'reject':
          newStatus = 'rejected';
          promptStatus = 'rejected';
          break;
        case 'request_revision':
          newStatus = 'revision_requested';
          promptStatus = 'revision_needed';
          break;
      }

      await supabase.rpc('update_queue_status', {
        p_queue_id: queueId,
        p_new_status: newStatus,
        p_changed_by: user?.id,
        p_reason: action.reason,
      });

      if (action.actionType === 'approve' || action.actionType === 'reject') {
        await this.completeSLATracking(queueId);
      }

      await supabase
        .from('prompt_submissions')
        .update({ status: promptStatus })
        .eq('id', queueItem.prompt_id);

      await this.sendNotification(queueItem.prompt_id, queueId, action);
    } catch (error) {
      console.error('Error processing approval action:', error);
      throw error;
    }
  }

  async bulkApprove(
    queueIds: string[],
    reason?: string,
    conditions?: any
  ): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;

    for (const queueId of queueIds) {
      try {
        await this.processApprovalAction(queueId, {
          actionType: 'approve',
          decision: 'approved',
          reason,
          conditions,
          approvalScope: conditions ? 'conditional' : 'full',
        });
        succeeded++;
      } catch (error) {
        console.error(`Failed to approve queue item ${queueId}:`, error);
        failed++;
      }
    }

    return { succeeded, failed };
  }

  async bulkReject(
    queueIds: string[],
    reason: string
  ): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;

    for (const queueId of queueIds) {
      try {
        await this.processApprovalAction(queueId, {
          actionType: 'reject',
          decision: 'rejected',
          reason,
        });
        succeeded++;
      } catch (error) {
        console.error(`Failed to reject queue item ${queueId}:`, error);
        failed++;
      }
    }

    return { succeeded, failed };
  }

  async requestRevision(
    queueId: string,
    revisionType: string,
    requestedChanges: string[],
    detailedFeedback?: string,
    priority: string = 'normal'
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: queueItem } = await supabase
        .from('approval_queue')
        .select('prompt_id')
        .eq('id', queueId)
        .single();

      if (!queueItem) throw new Error('Queue item not found');

      const { data: revision, error } = await supabase
        .from('revision_requests')
        .insert({
          prompt_id: queueItem.prompt_id,
          queue_id: queueId,
          requested_by: user?.id,
          requested_by_email: user?.email,
          revision_type: revisionType,
          requested_changes: requestedChanges,
          detailed_feedback: detailedFeedback,
          priority,
        })
        .select()
        .single();

      if (error || !revision) throw error;

      await this.processApprovalAction(queueId, {
        actionType: 'request_revision',
        decision: 'revision_needed',
        reason: 'Revisions requested',
        comments: detailedFeedback,
        requestedChanges,
      });

      return revision.id;
    } catch (error) {
      console.error('Error requesting revision:', error);
      throw error;
    }
  }

  async assignReviewer(queueId: string, reviewerId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase
        .from('approval_queue')
        .update({
          assigned_to: reviewerId,
          assigned_at: new Date().toISOString(),
          queue_status: 'in_review',
        })
        .eq('id', queueId);

      const { data: queueItem } = await supabase
        .from('approval_queue')
        .select('prompt_id')
        .eq('id', queueId)
        .single();

      if (queueItem) {
        await this.logHistory(
          queueItem.prompt_id,
          queueId,
          'pending',
          'in_review',
          user?.id || '',
          'assigned'
        );

        await this.sendNotification(queueItem.prompt_id, queueId, {
          actionType: 'assign',
          decision: 'assigned_for_review',
        });
      }
    } catch (error) {
      console.error('Error assigning reviewer:', error);
      throw error;
    }
  }

  async getApprovalHistory(promptId: string): Promise<any[]> {
    try {
      const { data } = await supabase
        .from('approval_history')
        .select('*')
        .eq('prompt_id', promptId)
        .order('created_at', { ascending: false });

      return data || [];
    } catch (error) {
      console.error('Error fetching approval history:', error);
      return [];
    }
  }

  async getRevisionRequests(promptId: string): Promise<RevisionRequest[]> {
    try {
      const { data } = await supabase
        .from('revision_requests')
        .select('*')
        .eq('prompt_id', promptId)
        .order('created_at', { ascending: false });

      if (!data) return [];

      return data.map((r) => ({
        id: r.id,
        promptId: r.prompt_id,
        requestedBy: r.requested_by,
        revisionType: r.revision_type,
        requestedChanges: r.requested_changes,
        detailedFeedback: r.detailed_feedback,
        priority: r.priority,
        status: r.status,
      }));
    } catch (error) {
      console.error('Error fetching revision requests:', error);
      return [];
    }
  }

  async getSLAStatus(queueId: string): Promise<any> {
    try {
      const { data } = await supabase
        .from('approval_sla_tracking')
        .select('*')
        .eq('queue_id', queueId)
        .single();

      return data;
    } catch (error) {
      console.error('Error fetching SLA status:', error);
      return null;
    }
  }

  async checkSLACompliance(): Promise<void> {
    try {
      await supabase.rpc('check_sla_compliance');
    } catch (error) {
      console.error('Error checking SLA compliance:', error);
    }
  }

  private async getSLAConfig(
    department?: string,
    priority?: number
  ): Promise<{ targetHours: number; warningThresholdHours: number }> {
    try {
      let query = supabase.from('approval_sla_config').select('*').eq('is_active', true);

      if (priority && priority >= 8) {
        query = query.eq('config_name', 'high_priority');
      } else if (priority && priority >= 9) {
        query = query.eq('config_name', 'critical');
      } else if (department) {
        query = query.eq('department', department);
      } else {
        query = query.eq('config_name', 'default_standard');
      }

      const { data } = await query.limit(1).single();

      if (data) {
        return {
          targetHours: data.target_hours,
          warningThresholdHours: data.warning_threshold_hours,
        };
      }

      return { targetHours: 48, warningThresholdHours: 36 };
    } catch (error) {
      return { targetHours: 48, warningThresholdHours: 36 };
    }
  }

  private calculateSLADeadline(startDate: Date, targetHours: number): Date {
    return new Date(startDate.getTime() + targetHours * 60 * 60 * 1000);
  }

  private async createSLATracking(
    queueId: string,
    promptId: string,
    slaConfig: { targetHours: number; warningThresholdHours: number }
  ): Promise<void> {
    const now = new Date();
    const targetCompletionAt = this.calculateSLADeadline(now, slaConfig.targetHours);
    const warningThresholdAt = this.calculateSLADeadline(now, slaConfig.warningThresholdHours);

    await supabase.from('approval_sla_tracking').insert({
      queue_id: queueId,
      prompt_id: promptId,
      target_completion_at: targetCompletionAt.toISOString(),
      warning_threshold_at: warningThresholdAt.toISOString(),
    });
  }

  private async completeSLATracking(queueId: string): Promise<void> {
    const now = new Date();

    await supabase
      .from('approval_sla_tracking')
      .update({
        completed_at: now.toISOString(),
      })
      .eq('queue_id', queueId);
  }

  private async logHistory(
    promptId: string,
    queueId: string,
    statusFrom: string,
    statusTo: string,
    changedBy: string,
    actionTaken: string
  ): Promise<void> {
    await supabase.from('approval_history').insert({
      prompt_id: promptId,
      queue_id: queueId,
      status_from: statusFrom,
      status_to: statusTo,
      changed_by: changedBy,
      action_taken: actionTaken,
    });
  }

  private async sendNotification(
    promptId: string,
    queueId: string,
    action: ApprovalAction
  ): Promise<void> {
    try {
      const { data: submission } = await supabase
        .from('prompt_submissions')
        .select('title, submitter')
        .eq('id', promptId)
        .single();

      if (!submission) return;

      let notificationType = 'approval_granted';
      let subject = 'Prompt Approved';
      let message = `Your prompt "${submission.title}" has been approved.`;

      if (action.actionType === 'reject') {
        notificationType = 'approval_rejected';
        subject = 'Prompt Rejected';
        message = `Your prompt "${submission.title}" has been rejected. Reason: ${action.reason}`;
      } else if (action.actionType === 'request_revision') {
        notificationType = 'revision_requested';
        subject = 'Revision Requested';
        message = `Your prompt "${submission.title}" requires revisions. ${action.comments}`;
      }

      await supabase.from('approval_notifications').insert({
        notification_type: notificationType,
        recipient_id: submission.submitter,
        recipient_email: 'user@example.com',
        subject,
        message,
        prompt_id: promptId,
        queue_id: queueId,
        priority: action.actionType === 'reject' ? 'high' : 'normal',
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }
}

export const approvalWorkflowService = ApprovalWorkflowService.getInstance();
