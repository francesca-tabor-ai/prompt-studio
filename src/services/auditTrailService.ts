import { supabase } from '../lib/supabase';

export interface AuditEvent {
  id: string;
  eventId: string;
  eventType: string;
  eventCategory: string;
  eventSeverity: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  actorId: string;
  actorEmail?: string;
  beforeState?: any;
  afterState?: any;
  changesSummary?: string;
  ipAddress?: string;
  success: boolean;
  createdAt: string;
}

export interface ComplianceReport {
  id: string;
  reportType: string;
  reportName: string;
  timePeriodStart: string;
  timePeriodEnd: string;
  eventCount: number;
  userCount: number;
  summary: string;
  complianceFramework?: string;
}

export class AuditTrailService {
  private static instance: AuditTrailService;

  private constructor() {}

  static getInstance(): AuditTrailService {
    if (!AuditTrailService.instance) {
      AuditTrailService.instance = new AuditTrailService();
    }
    return AuditTrailService.instance;
  }

  async logEvent(
    eventType: string,
    eventCategory: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    options?: {
      beforeState?: any;
      afterState?: any;
      changesSummary?: string;
      metadata?: any;
      severity?: string;
      targetUserId?: string;
      complianceFlags?: string[];
    }
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('No authenticated user');
      }

      const { data: event } = await supabase.rpc('log_audit_event', {
        p_event_type: eventType,
        p_event_category: eventCategory,
        p_action: action,
        p_resource_type: resourceType,
        p_resource_id: resourceId || null,
        p_actor_id: user.id,
        p_before_state: options?.beforeState ? JSON.stringify(options.beforeState) : null,
        p_after_state: options?.afterState ? JSON.stringify(options.afterState) : null,
        p_metadata: options?.metadata ? JSON.stringify(options.metadata) : '{}',
      });

      if (options?.changesSummary && event) {
        await this.addEventDetail(event, 'field_change', options.changesSummary);
      }

      return event || '';
    } catch (error) {
      console.error('Error logging audit event:', error);
      return '';
    }
  }

  async logPromptCreation(promptId: string, promptData: any): Promise<void> {
    await this.logEvent(
      'prompt_create',
      'content',
      'create',
      'prompt',
      promptId,
      {
        afterState: promptData,
        changesSummary: `Created prompt: ${promptData.title}`,
        metadata: { promptTitle: promptData.title },
      }
    );
  }

  async logPromptUpdate(
    promptId: string,
    beforeData: any,
    afterData: any
  ): Promise<void> {
    const changes = this.detectChanges(beforeData, afterData);

    await this.logEvent(
      'prompt_update',
      'content',
      'update',
      'prompt',
      promptId,
      {
        beforeState: beforeData,
        afterState: afterData,
        changesSummary: `Updated prompt: ${changes.join(', ')}`,
        metadata: { changedFields: changes },
      }
    );
  }

  async logPromptDeletion(promptId: string, promptData: any): Promise<void> {
    await this.logEvent(
      'prompt_delete',
      'content',
      'delete',
      'prompt',
      promptId,
      {
        beforeState: promptData,
        changesSummary: `Deleted prompt: ${promptData.title}`,
        severity: 'warning',
        complianceFlags: ['data_deletion'],
      }
    );
  }

  async logApprovalAction(
    promptId: string,
    actionType: 'approve' | 'reject' | 'revision',
    decision: string,
    reason?: string
  ): Promise<void> {
    const eventTypeMap = {
      approve: 'approval_approve',
      reject: 'approval_reject',
      revision: 'approval_revision',
    };

    await this.logEvent(
      eventTypeMap[actionType],
      'workflow',
      actionType,
      'approval',
      promptId,
      {
        afterState: { decision, reason },
        changesSummary: `${actionType} action: ${decision}`,
        metadata: { reason },
      }
    );
  }

  async logUserLogin(userId: string): Promise<void> {
    await this.logEvent(
      'user_login',
      'security',
      'login',
      'user',
      userId,
      {
        changesSummary: 'User logged in',
        severity: 'info',
      }
    );
  }

  async logDataExport(
    resourceType: string,
    recordCount: number,
    exportFormat: string
  ): Promise<void> {
    await this.logEvent(
      'data_export',
      'data',
      'export',
      resourceType,
      undefined,
      {
        changesSummary: `Exported ${recordCount} records as ${exportFormat}`,
        metadata: { recordCount, exportFormat },
        severity: 'warning',
        complianceFlags: ['data_export'],
      }
    );
  }

  async logSecurityChange(
    changeType: string,
    details: any
  ): Promise<void> {
    await this.logEvent(
      'security_change',
      'security',
      'modify',
      'system',
      undefined,
      {
        afterState: details,
        changesSummary: `Security change: ${changeType}`,
        severity: 'high',
        complianceFlags: ['security_change'],
      }
    );
  }

  async getAuditEvents(filters?: {
    startDate?: Date;
    endDate?: Date;
    actorId?: string;
    eventType?: string;
    resourceType?: string;
    resourceId?: string;
    severity?: string;
    limit?: number;
  }): Promise<AuditEvent[]> {
    try {
      let query = supabase
        .from('audit_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }

      if (filters?.actorId) {
        query = query.eq('actor_id', filters.actorId);
      }

      if (filters?.eventType) {
        query = query.eq('event_type', filters.eventType);
      }

      if (filters?.resourceType) {
        query = query.eq('resource_type', filters.resourceType);
      }

      if (filters?.resourceId) {
        query = query.eq('resource_id', filters.resourceId);
      }

      if (filters?.severity) {
        query = query.eq('event_severity', filters.severity);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(100);
      }

      const { data } = await query;

      if (!data) return [];

      return data.map((e) => ({
        id: e.id,
        eventId: e.event_id,
        eventType: e.event_type,
        eventCategory: e.event_category,
        eventSeverity: e.event_severity,
        action: e.action,
        resourceType: e.resource_type,
        resourceId: e.resource_id,
        actorId: e.actor_id,
        actorEmail: e.actor_email,
        beforeState: e.before_state,
        afterState: e.after_state,
        changesSummary: e.changes_summary,
        ipAddress: e.ip_address,
        success: e.success,
        createdAt: e.created_at,
      }));
    } catch (error) {
      console.error('Error fetching audit events:', error);
      return [];
    }
  }

  async searchAuditEvents(
    searchParams: {
      startDate?: Date;
      endDate?: Date;
      actorId?: string;
      eventType?: string;
      resourceType?: string;
      resourceId?: string;
    }
  ): Promise<any[]> {
    try {
      const { data } = await supabase.rpc('search_audit_events', {
        p_start_date: searchParams.startDate?.toISOString() || null,
        p_end_date: searchParams.endDate?.toISOString() || null,
        p_actor_id: searchParams.actorId || null,
        p_event_type: searchParams.eventType || null,
        p_resource_type: searchParams.resourceType || null,
        p_resource_id: searchParams.resourceId || null,
      });

      return data || [];
    } catch (error) {
      console.error('Error searching audit events:', error);
      return [];
    }
  }

  async verifyIntegrity(
    startEventId: string,
    endEventId: string
  ): Promise<boolean> {
    try {
      const { data } = await supabase.rpc('verify_audit_chain', {
        p_start_event_id: startEventId,
        p_end_event_id: endEventId,
      });

      return !!data;
    } catch (error) {
      console.error('Error verifying audit integrity:', error);
      return false;
    }
  }

  async createSnapshot(
    resourceType: string,
    resourceId: string,
    data: any,
    snapshotType: 'pre_change' | 'post_change' | 'scheduled' = 'scheduled'
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const snapshotHash = await this.hashData(data);

      await supabase.from('audit_snapshots').insert({
        snapshot_type: snapshotType,
        resource_type: resourceType,
        resource_id: resourceId,
        snapshot_data: data,
        snapshot_hash: snapshotHash,
        created_by: user?.id,
      });
    } catch (error) {
      console.error('Error creating snapshot:', error);
    }
  }

  async generateComplianceReport(
    reportType: string,
    reportName: string,
    startDate: Date,
    endDate: Date,
    complianceFramework?: string
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const events = await this.getAuditEvents({
        startDate,
        endDate,
        limit: 10000,
      });

      const uniqueActors = new Set(events.map((e) => e.actorId));

      const findings = this.analyzeCompliance(events, complianceFramework);

      const { data: report, error } = await supabase
        .from('compliance_reports')
        .insert({
          report_type: reportType,
          report_name: reportName,
          time_period_start: startDate.toISOString(),
          time_period_end: endDate.toISOString(),
          generated_by: user?.id,
          event_count: events.length,
          user_count: uniqueActors.size,
          findings,
          summary: this.generateReportSummary(events, findings),
          compliance_framework: complianceFramework,
          report_data: {
            events: events.slice(0, 1000),
            statistics: this.calculateStatistics(events),
          },
        })
        .select()
        .single();

      if (error || !report) throw error;

      return report.id;
    } catch (error) {
      console.error('Error generating compliance report:', error);
      throw error;
    }
  }

  async getComplianceReports(filters?: {
    reportType?: string;
    startDate?: Date;
    limit?: number;
  }): Promise<ComplianceReport[]> {
    try {
      let query = supabase
        .from('compliance_reports')
        .select('*')
        .order('generated_at', { ascending: false });

      if (filters?.reportType) {
        query = query.eq('report_type', filters.reportType);
      }

      if (filters?.startDate) {
        query = query.gte('generated_at', filters.startDate.toISOString());
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(50);
      }

      const { data } = await query;

      if (!data) return [];

      return data.map((r) => ({
        id: r.id,
        reportType: r.report_type,
        reportName: r.report_name,
        timePeriodStart: r.time_period_start,
        timePeriodEnd: r.time_period_end,
        eventCount: r.event_count,
        userCount: r.user_count,
        summary: r.summary,
        complianceFramework: r.compliance_framework,
      }));
    } catch (error) {
      console.error('Error fetching compliance reports:', error);
      return [];
    }
  }

  async exportAuditLog(
    filters: any,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const events = await this.getAuditEvents(filters);

      if (format === 'csv') {
        return this.convertToCSV(events);
      }

      return JSON.stringify(events, null, 2);
    } catch (error) {
      console.error('Error exporting audit log:', error);
      throw error;
    }
  }

  async syncToExternalSystem(
    eventId: string,
    externalSystem: string,
    payload: any
  ): Promise<void> {
    try {
      await supabase.from('external_audit_sync').insert({
        external_system: externalSystem,
        sync_type: 'real_time',
        event_id: eventId,
        sync_payload: payload,
        sync_status: 'pending',
      });
    } catch (error) {
      console.error('Error syncing to external system:', error);
    }
  }

  private async addEventDetail(
    eventId: string,
    detailType: string,
    value: string
  ): Promise<void> {
    try {
      await supabase.from('audit_event_details').insert({
        event_id: eventId,
        detail_type: detailType,
        field_name: 'summary',
        new_value: value,
      });
    } catch (error) {
      console.error('Error adding event detail:', error);
    }
  }

  private detectChanges(before: any, after: any): string[] {
    const changes: string[] = [];

    Object.keys(after).forEach((key) => {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes.push(key);
      }
    });

    return changes;
  }

  private async hashData(data: any): Promise<string> {
    const str = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private analyzeCompliance(events: AuditEvent[], framework?: string): any {
    const findings = {
      totalEvents: events.length,
      highSeverityEvents: events.filter((e) => e.eventSeverity === 'high').length,
      criticalSeverityEvents: events.filter((e) => e.eventSeverity === 'critical').length,
      failedActions: events.filter((e) => !e.success).length,
      dataExports: events.filter((e) => e.eventType === 'data_export').length,
      securityChanges: events.filter((e) => e.eventType === 'security_change').length,
      complianceIssues: [] as string[],
    };

    if (findings.failedActions > events.length * 0.1) {
      findings.complianceIssues.push('High failure rate detected');
    }

    if (findings.dataExports > 50) {
      findings.complianceIssues.push('Unusual number of data exports');
    }

    return findings;
  }

  private generateReportSummary(events: AuditEvent[], findings: any): string {
    return `Audit report covering ${events.length} events. ${findings.highSeverityEvents} high severity events, ${findings.criticalSeverityEvents} critical events. ${findings.complianceIssues.length} compliance issues identified.`;
  }

  private calculateStatistics(events: AuditEvent[]): any {
    const byCategory = events.reduce((acc, event) => {
      acc[event.eventCategory] = (acc[event.eventCategory] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byType = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      byCategory,
      byType,
      totalEvents: events.length,
      successRate: (events.filter((e) => e.success).length / events.length) * 100,
    };
  }

  private convertToCSV(events: AuditEvent[]): string {
    const headers = [
      'Event ID',
      'Event Type',
      'Action',
      'Actor ID',
      'Resource Type',
      'Resource ID',
      'Success',
      'Created At',
    ];

    const rows = events.map((e) => [
      e.eventId,
      e.eventType,
      e.action,
      e.actorId,
      e.resourceType,
      e.resourceId || '',
      e.success ? 'Yes' : 'No',
      e.createdAt,
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }
}

export const auditTrailService = AuditTrailService.getInstance();
