import { supabase } from '../../lib/supabase';

export interface AccessPolicy {
  policyName: string;
  secretPattern: string;
  allowedUsers: string[];
  allowedRoles: string[];
  allowedServices: string[];
  allowedOperations: string[];
  conditions?: Record<string, any>;
  priority: number;
}

export interface AccessRequest {
  secretName: string;
  userId?: string;
  roleId?: string;
  serviceName?: string;
  operation: 'read' | 'create' | 'update' | 'delete' | 'rotate' | 'revoke';
  context?: Record<string, any>;
}

class SecretsAccessControl {
  private static instance: SecretsAccessControl;

  private constructor() {}

  static getInstance(): SecretsAccessControl {
    if (!SecretsAccessControl.instance) {
      SecretsAccessControl.instance = new SecretsAccessControl();
    }
    return SecretsAccessControl.instance;
  }

  async checkAccess(request: AccessRequest): Promise<boolean> {
    const { data: policies } = await supabase
      .from('secret_policies')
      .select('*')
      .eq('enabled', true)
      .order('priority', { ascending: false });

    if (!policies) {
      return false;
    }

    for (const policy of policies) {
      if (!this.matchesPattern(request.secretName, policy.secret_pattern)) {
        continue;
      }

      if (!this.operationAllowed(request.operation, policy.allowed_operations)) {
        continue;
      }

      if (
        this.matchesUser(request.userId, policy.allowed_users) ||
        this.matchesService(request.serviceName, policy.allowed_services)
      ) {
        if (this.evaluateConditions(policy.conditions, request.context)) {
          return true;
        }
      }
    }

    return false;
  }

  async createPolicy(policy: AccessPolicy): Promise<string> {
    const { data, error } = await supabase
      .from('secret_policies')
      .insert({
        policy_name: policy.policyName,
        secret_pattern: policy.secretPattern,
        allowed_users: policy.allowedUsers,
        allowed_roles: policy.allowedRoles,
        allowed_services: policy.allowedServices,
        allowed_operations: policy.allowedOperations,
        conditions: policy.conditions || {},
        priority: policy.priority,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create policy: ${error.message}`);
    }

    return data.id;
  }

  async updatePolicy(
    policyName: string,
    updates: Partial<AccessPolicy>
  ): Promise<void> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.secretPattern) updateData.secret_pattern = updates.secretPattern;
    if (updates.allowedUsers) updateData.allowed_users = updates.allowedUsers;
    if (updates.allowedRoles) updateData.allowed_roles = updates.allowedRoles;
    if (updates.allowedServices)
      updateData.allowed_services = updates.allowedServices;
    if (updates.allowedOperations)
      updateData.allowed_operations = updates.allowedOperations;
    if (updates.conditions) updateData.conditions = updates.conditions;
    if (updates.priority !== undefined) updateData.priority = updates.priority;

    await supabase
      .from('secret_policies')
      .update(updateData)
      .eq('policy_name', policyName);
  }

  async deletePolicy(policyName: string): Promise<void> {
    await supabase
      .from('secret_policies')
      .delete()
      .eq('policy_name', policyName);
  }

  async listPolicies(): Promise<AccessPolicy[]> {
    const { data } = await supabase
      .from('secret_policies')
      .select('*')
      .order('priority', { ascending: false });

    if (!data) {
      return [];
    }

    return data.map((row) => ({
      policyName: row.policy_name,
      secretPattern: row.secret_pattern,
      allowedUsers: row.allowed_users || [],
      allowedRoles: row.allowed_roles || [],
      allowedServices: row.allowed_services || [],
      allowedOperations: row.allowed_operations || [],
      conditions: row.conditions || {},
      priority: row.priority,
    }));
  }

  async grantAccess(
    userId: string,
    secretPattern: string,
    operations: string[]
  ): Promise<void> {
    const policyName = `user_${userId}_${Date.now()}`;

    await this.createPolicy({
      policyName,
      secretPattern,
      allowedUsers: [userId],
      allowedRoles: [],
      allowedServices: [],
      allowedOperations: operations,
      priority: 50,
    });
  }

  async revokeAccess(userId: string, secretPattern: string): Promise<void> {
    const { data: policies } = await supabase
      .from('secret_policies')
      .select('*')
      .eq('secret_pattern', secretPattern);

    if (!policies) {
      return;
    }

    for (const policy of policies) {
      const allowedUsers = policy.allowed_users || [];
      if (allowedUsers.includes(userId)) {
        const updatedUsers = allowedUsers.filter((u: string) => u !== userId);

        if (updatedUsers.length === 0) {
          await this.deletePolicy(policy.policy_name);
        } else {
          await this.updatePolicy(policy.policy_name, {
            allowedUsers: updatedUsers,
          });
        }
      }
    }
  }

  async getUserAccessibleSecrets(userId: string): Promise<string[]> {
    const { data: policies } = await supabase
      .from('secret_policies')
      .select('secret_pattern, allowed_operations')
      .eq('enabled', true);

    if (!policies) {
      return [];
    }

    const patterns: string[] = [];

    for (const policy of policies) {
      const allowedUsers = policy.allowed_users || [];
      if (allowedUsers.includes(userId)) {
        patterns.push(policy.secret_pattern);
      }
    }

    return patterns;
  }

  async getAccessLog(
    secretId?: string,
    userId?: string,
    limit: number = 100
  ): Promise<any[]> {
    let query = supabase
      .from('secret_access_log')
      .select('*')
      .order('accessed_at', { ascending: false })
      .limit(limit);

    if (secretId) {
      query = query.eq('secret_id', secretId);
    }

    if (userId) {
      query = query.eq('accessed_by', userId);
    }

    const { data } = await query;

    return data || [];
  }

  async getAccessDenials(limit: number = 50): Promise<any[]> {
    const { data } = await supabase
      .from('secret_access_log')
      .select('*')
      .eq('access_granted', false)
      .order('accessed_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  async getAccessMetrics(secretId?: string): Promise<any> {
    let query = supabase.from('secret_access_log').select('*');

    if (secretId) {
      query = query.eq('secret_id', secretId);
    }

    const { data: logs } = await query;

    if (!logs) {
      return {
        total: 0,
        granted: 0,
        denied: 0,
        byOperation: {},
        byUser: {},
      };
    }

    const granted = logs.filter((l) => l.access_granted).length;
    const denied = logs.filter((l) => !l.access_granted).length;

    const byOperation: Record<string, number> = {};
    const byUser: Record<string, number> = {};

    for (const log of logs) {
      byOperation[log.access_type] = (byOperation[log.access_type] || 0) + 1;

      if (log.accessed_by) {
        byUser[log.accessed_by] = (byUser[log.accessed_by] || 0) + 1;
      }
    }

    return {
      total: logs.length,
      granted,
      denied,
      byOperation,
      byUser,
    };
  }

  private matchesPattern(secretName: string, pattern: string): boolean {
    if (pattern === '*') {
      return true;
    }

    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');

    const regex = new RegExp(`^${regexPattern}$`);

    return regex.test(secretName);
  }

  private operationAllowed(
    operation: string,
    allowedOperations: any
  ): boolean {
    if (Array.isArray(allowedOperations)) {
      return allowedOperations.includes(operation);
    }

    return false;
  }

  private matchesUser(userId: string | undefined, allowedUsers: any): boolean {
    if (!userId) {
      return false;
    }

    if (Array.isArray(allowedUsers)) {
      return allowedUsers.includes(userId);
    }

    return false;
  }

  private matchesService(
    serviceName: string | undefined,
    allowedServices: any
  ): boolean {
    if (!serviceName) {
      return false;
    }

    if (Array.isArray(allowedServices)) {
      return allowedServices.includes(serviceName);
    }

    return false;
  }

  private evaluateConditions(
    conditions: any,
    context?: Record<string, any>
  ): boolean {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    if (!context) {
      return false;
    }

    for (const [key, value] of Object.entries(conditions)) {
      if (context[key] !== value) {
        return false;
      }
    }

    return true;
  }
}

export const secretsAccessControl = SecretsAccessControl.getInstance();
