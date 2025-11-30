import { supabase } from '../../lib/supabase';

export type ComplianceFramework = 'GDPR' | 'CCPA' | 'HIPAA' | 'SOC2' | 'PCI-DSS';

export interface ComplianceEvent {
  eventType: 'data_access' | 'data_export' | 'data_deletion' | 'encryption' | 'key_rotation';
  resourceType: string;
  resourceId?: string;
  userId?: string;
  action: string;
  details?: Record<string, any>;
  framework?: ComplianceFramework;
}

export interface DataSubjectRequest {
  type: 'access' | 'deletion' | 'portability' | 'rectification';
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestedAt: Date;
  completedAt?: Date;
}

class ComplianceService {
  private static instance: ComplianceService;

  private constructor() {}

  static getInstance(): ComplianceService {
    if (!ComplianceService.instance) {
      ComplianceService.instance = new ComplianceService();
    }
    return ComplianceService.instance;
  }

  async logComplianceEvent(event: ComplianceEvent): Promise<void> {
    try {
      await supabase.from('compliance_audit_log').insert({
        event_type: event.eventType,
        resource_type: event.resourceType,
        resource_id: event.resourceId,
        user_id: event.userId,
        action: event.action,
        details: event.details || {},
        compliance_framework: event.framework,
      });
    } catch (error) {
      console.error('Failed to log compliance event:', error);
    }
  }

  async handleDataSubjectAccessRequest(userId: string): Promise<any> {
    await this.logComplianceEvent({
      eventType: 'data_access',
      resourceType: 'user_data',
      resourceId: userId,
      userId: userId,
      action: 'subject_access_request',
      framework: 'GDPR',
    });

    const userData = await this.exportUserData(userId);

    return {
      personalData: userData,
      processingActivities: await this.getUserProcessingActivities(userId),
      dataRetention: await this.getDataRetentionInfo(userId),
      thirdPartySharing: await this.getThirdPartySharing(userId),
    };
  }

  private async exportUserData(userId: string): Promise<any> {
    const tables = [
      'users',
      'prompts',
      'reviews',
      'comments',
      'activity_logs',
    ];

    const data: Record<string, any> = {};

    for (const table of tables) {
      const { data: tableData } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId);

      if (tableData) {
        data[table] = tableData;
      }
    }

    return data;
  }

  async handleDataDeletionRequest(userId: string): Promise<void> {
    await this.logComplianceEvent({
      eventType: 'data_deletion',
      resourceType: 'user_data',
      resourceId: userId,
      userId: userId,
      action: 'right_to_be_forgotten',
      framework: 'GDPR',
    });

    const tables = [
      'activity_logs',
      'comments',
      'reviews',
      'prompts',
      'users',
    ];

    for (const table of tables) {
      await supabase.from(table).delete().eq('user_id', userId);
    }
  }

  async handleDataPortabilityRequest(userId: string): Promise<string> {
    const userData = await this.exportUserData(userId);

    await this.logComplianceEvent({
      eventType: 'data_export',
      resourceType: 'user_data',
      resourceId: userId,
      userId: userId,
      action: 'data_portability_request',
      framework: 'GDPR',
    });

    return JSON.stringify(userData, null, 2);
  }

  async anonymizeUserData(userId: string): Promise<void> {
    await this.logComplianceEvent({
      eventType: 'data_deletion',
      resourceType: 'user_data',
      resourceId: userId,
      userId: userId,
      action: 'data_anonymization',
    });

    await supabase
      .from('users')
      .update({
        email: `anonymized_${userId}@deleted.local`,
        first_name: 'Deleted',
        last_name: 'User',
        is_deleted: true,
      })
      .eq('id', userId);

    await supabase
      .from('prompts')
      .update({
        created_by_name: 'Anonymous User',
      })
      .eq('user_id', userId);
  }

  private async getUserProcessingActivities(userId: string): Promise<any[]> {
    const { data } = await supabase
      .from('compliance_audit_log')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(100);

    return data || [];
  }

  private async getDataRetentionInfo(userId: string): Promise<any> {
    return {
      personalData: '7 years from last activity',
      activityLogs: '1 year',
      prompts: 'Indefinite (unless deletion requested)',
    };
  }

  private async getThirdPartySharing(userId: string): Promise<any[]> {
    return [
      {
        party: 'Supabase',
        purpose: 'Database hosting',
        dataShared: 'All user data',
      },
      {
        party: 'Analytics Provider',
        purpose: 'Usage analytics',
        dataShared: 'Anonymized usage data',
      },
    ];
  }

  async validateConsent(userId: string, purpose: string): Promise<boolean> {
    const { data } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', userId)
      .eq('purpose', purpose)
      .eq('status', 'granted')
      .single();

    return !!data;
  }

  async recordConsent(
    userId: string,
    purpose: string,
    granted: boolean
  ): Promise<void> {
    await supabase.from('user_consents').insert({
      user_id: userId,
      purpose: purpose,
      status: granted ? 'granted' : 'denied',
      granted_at: granted ? new Date().toISOString() : null,
    });

    await this.logComplianceEvent({
      eventType: 'data_access',
      resourceType: 'consent',
      resourceId: userId,
      userId: userId,
      action: granted ? 'consent_granted' : 'consent_denied',
      details: { purpose },
    });
  }

  async getComplianceReport(
    framework: ComplianceFramework,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const { data: events } = await supabase
      .from('compliance_audit_log')
      .select('*')
      .eq('compliance_framework', framework)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    const summary = {
      framework,
      period: { start: startDate, end: endDate },
      totalEvents: events?.length || 0,
      eventsByType: this.groupEventsByType(events || []),
      dataSubjectRequests: await this.getDataSubjectRequestStats(
        startDate,
        endDate
      ),
      securityIncidents: await this.getSecurityIncidents(startDate, endDate),
    };

    return summary;
  }

  private groupEventsByType(events: any[]): Record<string, number> {
    const grouped: Record<string, number> = {};

    for (const event of events) {
      grouped[event.event_type] = (grouped[event.event_type] || 0) + 1;
    }

    return grouped;
  }

  private async getDataSubjectRequestStats(
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const { data } = await supabase
      .from('compliance_audit_log')
      .select('*')
      .in('action', [
        'subject_access_request',
        'right_to_be_forgotten',
        'data_portability_request',
      ])
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    return {
      total: data?.length || 0,
      byType: this.groupEventsByAction(data || []),
    };
  }

  private groupEventsByAction(events: any[]): Record<string, number> {
    const grouped: Record<string, number> = {};

    for (const event of events) {
      grouped[event.action] = (grouped[event.action] || 0) + 1;
    }

    return grouped;
  }

  private async getSecurityIncidents(
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const { data } = await supabase
      .from('security_incidents')
      .select('id')
      .gte('detected_at', startDate.toISOString())
      .lte('detected_at', endDate.toISOString());

    return data?.length || 0;
  }

  async checkDataRetention(): Promise<void> {
    const retentionPolicies = [
      { table: 'activity_logs', days: 365 },
      { table: 'audit_logs', days: 2555 },
      { table: 'session_logs', days: 90 },
    ];

    for (const policy of retentionPolicies) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.days);

      await supabase
        .from(policy.table)
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      await this.logComplianceEvent({
        eventType: 'data_deletion',
        resourceType: policy.table,
        action: 'data_retention_cleanup',
        details: { retentionDays: policy.days },
      });
    }
  }

  isGDPRCompliant(): boolean {
    return true;
  }

  isCCPACompliant(): boolean {
    return true;
  }

  isHIPAACompliant(): boolean {
    return false;
  }

  getComplianceFrameworks(): ComplianceFramework[] {
    const frameworks: ComplianceFramework[] = [];

    if (this.isGDPRCompliant()) frameworks.push('GDPR');
    if (this.isCCPACompliant()) frameworks.push('CCPA');
    if (this.isHIPAACompliant()) frameworks.push('HIPAA');

    frameworks.push('SOC2');

    return frameworks;
  }
}

export const complianceService = ComplianceService.getInstance();
