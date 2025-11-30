import { supabase } from '../lib/supabase';

export interface ReminderOptions {
  assignmentId: string;
  hoursOverdue: number;
  reminderType: 'gentle' | 'urgent' | 'critical';
}

export interface EscalationOptions {
  assignmentId: string;
  submissionId: string;
  reviewerId: string;
  hoursOverdue: number;
  escalationLevel: number;
  reason: string;
}

export class ReminderEscalationService {
  private static instance: ReminderEscalationService;

  private constructor() {}

  static getInstance(): ReminderEscalationService {
    if (!ReminderEscalationService.instance) {
      ReminderEscalationService.instance = new ReminderEscalationService();
    }
    return ReminderEscalationService.instance;
  }

  async checkAndProcessReminders(): Promise<{ sent: number; escalated: number }> {
    try {
      let sentCount = 0;
      let escalatedCount = 0;

      const { data: overdueAssignments } = await supabase.rpc('check_overdue_reviews');

      if (!overdueAssignments || overdueAssignments.length === 0) {
        return { sent: 0, escalated: 0 };
      }

      for (const assignment of overdueAssignments) {
        const hoursOverdue = assignment.hours_overdue;

        if (hoursOverdue >= 72) {
          await this.escalateReview({
            assignmentId: assignment.assignment_id,
            submissionId: assignment.submission_id,
            reviewerId: assignment.reviewer_id,
            hoursOverdue,
            escalationLevel: 3,
            reason: 'overdue',
          });
          escalatedCount++;
        } else if (hoursOverdue >= 48) {
          await this.sendReminder({
            assignmentId: assignment.assignment_id,
            hoursOverdue,
            reminderType: 'urgent',
          });
          sentCount++;
        } else if (hoursOverdue >= 24) {
          await this.sendReminder({
            assignmentId: assignment.assignment_id,
            hoursOverdue,
            reminderType: 'gentle',
          });
          sentCount++;
        }
      }

      return { sent: sentCount, escalated: escalatedCount };
    } catch (error) {
      console.error('Error processing reminders:', error);
      return { sent: 0, escalated: 0 };
    }
  }

  async sendReminder(options: ReminderOptions): Promise<boolean> {
    try {
      const { assignmentId, hoursOverdue, reminderType } = options;

      const { data: assignment } = await supabase
        .from('submission_reviewer_assignments')
        .select('*, prompt_submissions(*)')
        .eq('id', assignmentId)
        .single();

      if (!assignment) return false;

      const submission = assignment.prompt_submissions;
      const reviewUrl = `${window.location.origin}/peer-review?submission=${submission.id}`;

      const { data: lastReminder } = await supabase
        .from('email_queue')
        .select('created_at')
        .eq('recipient_id', assignment.reviewer_id)
        .eq('related_submission_id', submission.id)
        .eq('email_type', 'reminder')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastReminder) {
        const hoursSinceLastReminder =
          (Date.now() - new Date(lastReminder.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastReminder < 12) {
          return false;
        }
      }

      const subject = this.getReminderSubject(reminderType, submission.title);
      const { html, text } = this.generateReminderEmail(
        assignment,
        submission,
        hoursOverdue,
        reminderType,
        reviewUrl
      );

      await supabase.from('submission_notifications').insert({
        recipient_id: assignment.reviewer_id,
        recipient_email: assignment.reviewer_email,
        submission_id: submission.id,
        notification_type: 'reminder',
        title: subject,
        message: `Your review for "${submission.title}" is overdue by ${Math.round(hoursOverdue)} hours`,
        action_url: reviewUrl,
        priority: reminderType === 'critical' ? 'urgent' : 'high',
      });

      await supabase.from('email_queue').insert({
        recipient_id: assignment.reviewer_id,
        recipient_email: assignment.reviewer_email,
        subject,
        body_html: html,
        body_text: text,
        email_type: 'reminder',
        priority: reminderType === 'critical' ? 'urgent' : 'high',
        related_submission_id: submission.id,
      });

      return true;
    } catch (error) {
      console.error('Error sending reminder:', error);
      return false;
    }
  }

  async escalateReview(options: EscalationOptions): Promise<boolean> {
    try {
      const { assignmentId, submissionId, reviewerId, hoursOverdue, escalationLevel, reason } =
        options;

      const { data: rule } = await supabase
        .from('escalation_rules')
        .select('*')
        .eq('trigger_condition', reason)
        .eq('is_active', true)
        .lte('threshold_hours', hoursOverdue)
        .order('escalation_level', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!rule) return false;

      const { data: manager } = await this.findEscalationTarget(rule.escalate_to_role);

      if (!manager) return false;

      const { data: assignment } = await supabase
        .from('submission_reviewer_assignments')
        .select('*, prompt_submissions(*)')
        .eq('id', assignmentId)
        .single();

      if (!assignment) return false;

      const { data: escalation, error: escalationError } = await supabase
        .from('escalation_log')
        .insert({
          submission_id: submissionId,
          assignment_id: assignmentId,
          reviewer_id: reviewerId,
          rule_id: rule.id,
          escalation_level: escalationLevel,
          escalated_to_id: manager.id,
          escalated_to_email: manager.email,
          reason,
          hours_overdue: hoursOverdue,
        })
        .select()
        .single();

      if (escalationError) throw escalationError;

      const submission = assignment.prompt_submissions;
      const escalationUrl = `${window.location.origin}/admin?escalation=${escalation.id}`;

      const subject = `[ESCALATION Level ${escalationLevel}] Review Overdue: ${submission.title}`;
      const { html, text } = this.generateEscalationEmail(
        assignment,
        submission,
        manager,
        escalation,
        escalationUrl
      );

      await supabase.from('submission_notifications').insert({
        recipient_id: manager.id,
        recipient_email: manager.email,
        submission_id: submissionId,
        notification_type: 'reminder',
        title: subject,
        message: `Review assignment escalated - ${assignment.reviewer_email} has not completed review for ${Math.round(hoursOverdue)} hours`,
        action_url: escalationUrl,
        priority: 'urgent',
      });

      await supabase.from('email_queue').insert({
        recipient_id: manager.id,
        recipient_email: manager.email,
        subject,
        body_html: html,
        body_text: text,
        email_type: 'escalation',
        priority: 'urgent',
        related_submission_id: submissionId,
      });

      await supabase
        .from('escalation_log')
        .update({ notification_sent: true, email_sent: true })
        .eq('id', escalation.id);

      await supabase
        .from('reviewer_analytics')
        .update({
          overdue_count: supabase.rpc('increment', { x: 1 }),
          escalated_count: supabase.rpc('increment', { x: 1 }),
        })
        .eq('reviewer_id', reviewerId);

      return true;
    } catch (error) {
      console.error('Error escalating review:', error);
      return false;
    }
  }

  async resolveEscalation(
    escalationId: string,
    resolvedBy: string,
    notes: string
  ): Promise<boolean> {
    try {
      await supabase
        .from('escalation_log')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
          resolution_notes: notes,
        })
        .eq('id', escalationId);

      return true;
    } catch (error) {
      console.error('Error resolving escalation:', error);
      return false;
    }
  }

  async getActiveEscalations(): Promise<any[]> {
    try {
      const { data } = await supabase
        .from('escalation_log')
        .select('*, prompt_submissions(*), submission_reviewer_assignments(*)')
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      return data || [];
    } catch (error) {
      console.error('Error fetching escalations:', error);
      return [];
    }
  }

  private async findEscalationTarget(role: string): Promise<any> {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .contains('roles', [role])
        .limit(1)
        .maybeSingle();

      if (data) {
        const { data: user } = await supabase.auth.admin.getUserById(data.user_id);
        return user?.user || null;
      }

      return null;
    } catch (error) {
      console.error('Error finding escalation target:', error);
      return null;
    }
  }

  private getReminderSubject(type: string, title: string): string {
    switch (type) {
      case 'gentle':
        return `Reminder: Review pending for "${title}"`;
      case 'urgent':
        return `URGENT: Review overdue for "${title}"`;
      case 'critical':
        return `CRITICAL: Immediate action required for "${title}"`;
      default:
        return `Review reminder: "${title}"`;
    }
  }

  private generateReminderEmail(
    assignment: any,
    submission: any,
    hoursOverdue: number,
    reminderType: string,
    reviewUrl: string
  ): { html: string; text: string } {
    const urgencyColor = reminderType === 'critical' ? '#dc2626' : reminderType === 'urgent' ? '#ea580c' : '#2563eb';
    const urgencyLabel = reminderType === 'critical' ? 'CRITICAL' : reminderType === 'urgent' ? 'URGENT' : 'REMINDER';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${urgencyColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .alert { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
          .button { display: inline-block; background: ${urgencyColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">${urgencyLabel}</span>
            <h1>Review Reminder</h1>
          </div>
          <div class="content">
            <div class="alert">
              <strong>⚠️ This review is overdue by ${Math.round(hoursOverdue)} hours</strong>
            </div>

            <p>Hello ${assignment.reviewer_email},</p>
            <p>This is a reminder that you have a pending review assignment that requires your attention.</p>

            <div class="details">
              <h3>${submission.title}</h3>
              <p><strong>Workflow:</strong> ${submission.workflow}</p>
              <p><strong>Role:</strong> ${submission.role}</p>
              <p><strong>Assigned:</strong> ${new Date(assignment.assigned_at).toLocaleString()}</p>
              <p><strong>Overdue by:</strong> ${Math.round(hoursOverdue)} hours</p>
            </div>

            <p>Please complete your review as soon as possible to avoid further escalation.</p>

            <a href="${reviewUrl}" class="button">Complete Review Now</a>

            <p>If you are unable to complete this review, please contact your manager or reassign it to another reviewer.</p>
          </div>
          <div class="footer">
            <p>This is an automated reminder from the Peer Review System.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
${urgencyLabel}: Review Reminder

Hello ${assignment.reviewer_email},

This review is overdue by ${Math.round(hoursOverdue)} hours.

Title: ${submission.title}
Workflow: ${submission.workflow}
Role: ${submission.role}
Assigned: ${new Date(assignment.assigned_at).toLocaleString()}

Please complete your review as soon as possible.

Review URL: ${reviewUrl}

If you are unable to complete this review, please contact your manager or reassign it.

---
This is an automated reminder from the Peer Review System.
    `.trim();

    return { html, text };
  }

  private generateEscalationEmail(
    assignment: any,
    submission: any,
    manager: any,
    escalation: any,
    escalationUrl: string
  ): { html: string; text: string } {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .alert { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
          .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">ESCALATION LEVEL ${escalation.escalation_level}</span>
            <h1>Review Escalation</h1>
          </div>
          <div class="content">
            <div class="alert">
              <strong>🚨 A review assignment has been escalated and requires manager intervention</strong>
            </div>

            <p>Hello ${manager.email},</p>
            <p>A review assignment has been escalated due to lack of response or completion.</p>

            <div class="details">
              <h3>Submission Details</h3>
              <p><strong>Title:</strong> ${submission.title}</p>
              <p><strong>Workflow:</strong> ${submission.workflow}</p>
              <p><strong>Assigned to:</strong> ${assignment.reviewer_email}</p>
              <p><strong>Assigned on:</strong> ${new Date(assignment.assigned_at).toLocaleString()}</p>
              <p><strong>Hours overdue:</strong> ${Math.round(escalation.hours_overdue)}</p>
              <p><strong>Reason:</strong> ${escalation.reason}</p>
            </div>

            <p><strong>Action Required:</strong> Please contact the reviewer or reassign this review to ensure timely completion.</p>

            <a href="${escalationUrl}" class="button">View Escalation</a>
          </div>
          <div class="footer">
            <p>This is an automated escalation from the Peer Review System.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
ESCALATION LEVEL ${escalation.escalation_level}: Review Escalation

Hello ${manager.email},

A review assignment has been escalated and requires manager intervention.

Submission: ${submission.title}
Assigned to: ${assignment.reviewer_email}
Assigned on: ${new Date(assignment.assigned_at).toLocaleString()}
Hours overdue: ${Math.round(escalation.hours_overdue)}
Reason: ${escalation.reason}

Action Required: Please contact the reviewer or reassign this review.

Escalation URL: ${escalationUrl}

---
This is an automated escalation from the Peer Review System.
    `.trim();

    return { html, text };
  }
}

export const reminderEscalationService = ReminderEscalationService.getInstance();
