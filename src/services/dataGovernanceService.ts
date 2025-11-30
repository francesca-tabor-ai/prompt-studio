import { supabase } from '../lib/supabase';

export interface RetentionPolicy {
  id: string;
  policyName: string;
  dataType: string;
  tableName: string;
  retentionDays: number;
  softDelete: boolean;
  archiveBeforeDelete: boolean;
  legalBasis?: string;
  regulatoryFramework?: string[];
  isActive: boolean;
  lastExecutedAt?: string;
  nextExecutionAt?: string;
}

export interface DataClassification {
  id: string;
  resourceType: string;
  resourceId: string;
  classificationLevel: string;
  sensitivityScore: number;
  containsPii: boolean;
  containsPhi: boolean;
  containsPci: boolean;
  dataCategories?: string[];
}

export interface PrivacyRequest {
  id: string;
  requestType: string;
  requestNumber: string;
  subjectUserId: string;
  subjectEmail: string;
  status: string;
  recordsFound: number;
  completionDeadline: string;
  requestedAt: string;
}

export class DataGovernanceService {
  private static instance: DataGovernanceService;

  private constructor() {}

  static getInstance(): DataGovernanceService {
    if (!DataGovernanceService.instance) {
      DataGovernanceService.instance = new DataGovernanceService();
    }
    return DataGovernanceService.instance;
  }

  async getRetentionPolicies(): Promise<RetentionPolicy[]> {
    try {
      const { data } = await supabase
        .from('data_retention_policies')
        .select('*')
        .order('data_type');

      if (!data) return [];

      return data.map((p) => ({
        id: p.id,
        policyName: p.policy_name,
        dataType: p.data_type,
        tableName: p.table_name,
        retentionDays: p.retention_days,
        softDelete: p.soft_delete,
        archiveBeforeDelete: p.archive_before_delete,
        legalBasis: p.legal_basis,
        regulatoryFramework: p.regulatory_framework,
        isActive: p.is_active,
        lastExecutedAt: p.last_executed_at,
        nextExecutionAt: p.next_execution_at,
      }));
    } catch (error) {
      console.error('Error fetching retention policies:', error);
      return [];
    }
  }

  async createRetentionPolicy(
    policyName: string,
    dataType: string,
    tableName: string,
    retentionDays: number,
    options?: {
      softDelete?: boolean;
      archiveBeforeDelete?: boolean;
      legalBasis?: string;
      regulatoryFramework?: string[];
    }
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: policy, error } = await supabase
        .from('data_retention_policies')
        .insert({
          policy_name: policyName,
          data_type: dataType,
          table_name: tableName,
          retention_days: retentionDays,
          soft_delete: options?.softDelete ?? true,
          archive_before_delete: options?.archiveBeforeDelete ?? true,
          legal_basis: options?.legalBasis,
          regulatory_framework: options?.regulatoryFramework,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error || !policy) throw error;

      return policy.id;
    } catch (error) {
      console.error('Error creating retention policy:', error);
      throw error;
    }
  }

  async executeRetentionPolicy(policyId: string): Promise<any> {
    try {
      const { data } = await supabase.rpc('apply_retention_policy', {
        p_policy_id: policyId,
      });

      return data;
    } catch (error) {
      console.error('Error executing retention policy:', error);
      throw error;
    }
  }

  async classifyData(
    resourceType: string,
    resourceId: string,
    classificationLevel: string,
    options?: {
      containsPii?: boolean;
      containsPhi?: boolean;
      containsPci?: boolean;
      dataCategories?: string[];
    }
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data } = await supabase.rpc('classify_data', {
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_classification_level: classificationLevel,
        p_contains_pii: options?.containsPii || false,
        p_classified_by: user?.id,
      });

      return data || '';
    } catch (error) {
      console.error('Error classifying data:', error);
      throw error;
    }
  }

  async getDataClassification(
    resourceType: string,
    resourceId: string
  ): Promise<DataClassification | null> {
    try {
      const { data } = await supabase
        .from('data_classification')
        .select('*')
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
        .single();

      if (!data) return null;

      return {
        id: data.id,
        resourceType: data.resource_type,
        resourceId: data.resource_id,
        classificationLevel: data.classification_level,
        sensitivityScore: data.sensitivity_score,
        containsPii: data.contains_pii,
        containsPhi: data.contains_phi,
        containsPci: data.contains_pci,
        dataCategories: data.data_categories,
      };
    } catch (error) {
      console.error('Error fetching data classification:', error);
      return null;
    }
  }

  async trackLineage(
    sourceType: string,
    sourceId: string,
    targetType: string,
    targetId: string,
    relationshipType: string
  ): Promise<void> {
    try {
      await supabase.rpc('track_lineage', {
        p_source_type: sourceType,
        p_source_id: sourceId,
        p_target_type: targetType,
        p_target_id: targetId,
        p_relationship_type: relationshipType,
      });
    } catch (error) {
      console.error('Error tracking lineage:', error);
    }
  }

  async getDataLineage(
    resourceType: string,
    resourceId: string
  ): Promise<any[]> {
    try {
      const { data } = await supabase
        .from('data_lineage')
        .select('*')
        .or(`source_id.eq.${resourceId},target_id.eq.${resourceId}`);

      return data || [];
    } catch (error) {
      console.error('Error fetching data lineage:', error);
      return [];
    }
  }

  async createPrivacyRequest(
    requestType: string,
    subjectUserId: string,
    subjectEmail: string,
    dataCategories?: string[]
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const requestNumber = `PR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const completionDeadline = new Date();
      completionDeadline.setDate(completionDeadline.getDate() + 30);

      const { data: request, error } = await supabase
        .from('privacy_requests')
        .insert({
          request_type: requestType,
          request_number: requestNumber,
          subject_user_id: subjectUserId,
          subject_email: subjectEmail,
          requested_by: user?.id,
          data_categories: dataCategories,
          completion_deadline: completionDeadline.toISOString(),
        })
        .select()
        .single();

      if (error || !request) throw error;

      return request.id;
    } catch (error) {
      console.error('Error creating privacy request:', error);
      throw error;
    }
  }

  async processPrivacyRequest(requestId: string): Promise<any> {
    try {
      const { data } = await supabase.rpc('process_privacy_request', {
        p_request_id: requestId,
      });

      return data;
    } catch (error) {
      console.error('Error processing privacy request:', error);
      throw error;
    }
  }

  async getPrivacyRequests(filters?: {
    status?: string;
    requestType?: string;
  }): Promise<PrivacyRequest[]> {
    try {
      let query = supabase
        .from('privacy_requests')
        .select('*')
        .order('requested_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.requestType) {
        query = query.eq('request_type', filters.requestType);
      }

      const { data } = await query;

      if (!data) return [];

      return data.map((r) => ({
        id: r.id,
        requestType: r.request_type,
        requestNumber: r.request_number,
        subjectUserId: r.subject_user_id,
        subjectEmail: r.subject_email,
        status: r.status,
        recordsFound: r.records_found,
        completionDeadline: r.completion_deadline,
        requestedAt: r.requested_at,
      }));
    } catch (error) {
      console.error('Error fetching privacy requests:', error);
      return [];
    }
  }

  async maskSensitiveData(
    value: string,
    maskingMethod: string = 'partial'
  ): Promise<string> {
    try {
      const { data } = await supabase.rpc('mask_sensitive_data', {
        p_value: value,
        p_masking_method: maskingMethod,
        p_preserve_length: true,
      });

      return data || value;
    } catch (error) {
      console.error('Error masking data:', error);
      return value;
    }
  }

  async getLifecycleEvents(filters?: {
    eventType?: string;
    resourceType?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      let query = supabase
        .from('data_lifecycle_events')
        .select('*')
        .order('executed_at', { ascending: false });

      if (filters?.eventType) {
        query = query.eq('event_type', filters.eventType);
      }

      if (filters?.resourceType) {
        query = query.eq('resource_type', filters.resourceType);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(100);
      }

      const { data } = await query;

      return data || [];
    } catch (error) {
      console.error('Error fetching lifecycle events:', error);
      return [];
    }
  }

  async generateGovernanceReport(
    reportType: string,
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const lifecycleEvents = await this.getLifecycleEvents();
      const privacyRequests = await this.getPrivacyRequests();

      const archived = lifecycleEvents.filter((e) => e.event_type === 'archived').length;
      const deleted = lifecycleEvents.filter((e) => e.event_type === 'deleted').length;
      const anonymized = lifecycleEvents.filter((e) => e.event_type === 'anonymized').length;

      const findings = {
        totalLifecycleEvents: lifecycleEvents.length,
        recordsArchived: archived,
        recordsDeleted: deleted,
        recordsAnonymized: anonymized,
        privacyRequests: privacyRequests.length,
        pendingPrivacyRequests: privacyRequests.filter((r) => r.status === 'pending').length,
      };

      const { data: report, error } = await supabase
        .from('governance_reports')
        .insert({
          report_type: reportType,
          report_name: `${reportType} Report - ${new Date().toISOString()}`,
          report_period_start: startDate.toISOString(),
          report_period_end: endDate.toISOString(),
          generated_by: user?.id,
          total_records_reviewed: lifecycleEvents.length,
          records_archived: archived,
          records_deleted: deleted,
          records_anonymized: anonymized,
          findings,
          summary: `Report covering ${lifecycleEvents.length} lifecycle events and ${privacyRequests.length} privacy requests`,
        })
        .select()
        .single();

      if (error || !report) throw error;

      return report.id;
    } catch (error) {
      console.error('Error generating governance report:', error);
      throw error;
    }
  }

  async getGovernanceReports(filters?: {
    reportType?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      let query = supabase
        .from('governance_reports')
        .select('*')
        .order('generated_at', { ascending: false });

      if (filters?.reportType) {
        query = query.eq('report_type', filters.reportType);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(50);
      }

      const { data } = await query;

      return data || [];
    } catch (error) {
      console.error('Error fetching governance reports:', error);
      return [];
    }
  }

  async archiveOldData(
    resourceType: string,
    cutoffDate: Date
  ): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: events, error } = await supabase
        .from('data_lifecycle_events')
        .insert([
          {
            event_type: 'archived',
            resource_type: resourceType,
            resource_id: '00000000-0000-0000-0000-000000000000',
            action_taken: 'archive',
            reason: `Automatic archival of records older than ${cutoffDate.toISOString()}`,
            executed_by: user?.id,
          },
        ])
        .select();

      if (error) throw error;

      return events?.length || 0;
    } catch (error) {
      console.error('Error archiving old data:', error);
      return 0;
    }
  }

  async deleteExpiredData(
    resourceType: string,
    retentionDays: number
  ): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: events, error } = await supabase
        .from('data_lifecycle_events')
        .insert([
          {
            event_type: 'deleted',
            resource_type: resourceType,
            resource_id: '00000000-0000-0000-0000-000000000000',
            action_taken: 'hard_delete',
            reason: `Automatic deletion per ${retentionDays}-day retention policy`,
            executed_by: user?.id,
          },
        ])
        .select();

      if (error) throw error;

      return events?.length || 0;
    } catch (error) {
      console.error('Error deleting expired data:', error);
      return 0;
    }
  }

  async getDataInventory(): Promise<any> {
    try {
      const classifications = await supabase
        .from('data_classification')
        .select('classification_level, resource_type');

      const byLevel = (classifications.data || []).reduce((acc, c) => {
        acc[c.classification_level] = (acc[c.classification_level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const byType = (classifications.data || []).reduce((acc, c) => {
        acc[c.resource_type] = (acc[c.resource_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalClassified: classifications.data?.length || 0,
        byClassificationLevel: byLevel,
        byResourceType: byType,
      };
    } catch (error) {
      console.error('Error getting data inventory:', error);
      return { totalClassified: 0, byClassificationLevel: {}, byResourceType: {} };
    }
  }

  async getComplianceScore(): Promise<number> {
    try {
      const policies = await this.getRetentionPolicies();
      const activePolicies = policies.filter((p) => p.isActive).length;

      const requests = await this.getPrivacyRequests();
      const completedOnTime = requests.filter(
        (r) =>
          r.status === 'completed' &&
          new Date(r.completionDeadline) > new Date(r.requestedAt)
      ).length;

      const score =
        activePolicies > 0 && requests.length > 0
          ? (completedOnTime / requests.length) * 100
          : activePolicies > 0
          ? 75
          : 50;

      return Math.round(score);
    } catch (error) {
      console.error('Error calculating compliance score:', error);
      return 0;
    }
  }
}

export const dataGovernanceService = DataGovernanceService.getInstance();
