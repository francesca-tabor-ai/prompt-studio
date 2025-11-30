import { supabase } from '../lib/supabase';

export interface Role {
  id: string;
  name: string;
  description?: string;
  roleLevel: number;
  isSystemRole: boolean;
  isAssignable: boolean;
  colorCode: string;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  departmentScope?: string[];
  workflowScope?: string[];
  isActive: boolean;
  validFrom: string;
  validUntil?: string;
  assignedBy: string;
  assignmentReason?: string;
}

export interface RoleTemplate {
  id: string;
  templateName: string;
  templateSlug: string;
  description: string;
  useCase: string;
  permissionKeys: string[];
  isRecommended: boolean;
}

export class RBACService {
  private static instance: RBACService;

  private constructor() {}

  static getInstance(): RBACService {
    if (!RBACService.instance) {
      RBACService.instance = new RBACService();
    }
    return RBACService.instance;
  }

  async getRoles(): Promise<Role[]> {
    try {
      const { data } = await supabase
        .from('roles')
        .select('*')
        .order('role_level', { ascending: false });

      if (!data) return [];

      return data.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        roleLevel: r.role_level || 0,
        isSystemRole: r.is_system_role || false,
        isAssignable: r.is_assignable !== false,
        colorCode: r.color_code || '#6B7280',
      }));
    } catch (error) {
      console.error('Error fetching roles:', error);
      return [];
    }
  }

  async createRole(
    name: string,
    description: string,
    roleLevel: number = 50,
    permissionIds: string[] = []
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: role, error } = await supabase
        .from('roles')
        .insert({
          name,
          description,
          role_level: roleLevel,
          is_system_role: false,
          is_assignable: true,
        })
        .select()
        .single();

      if (error || !role) throw error;

      if (permissionIds.length > 0) {
        await this.assignPermissionsToRole(role.id, permissionIds);
      }

      await this.logChange('role_created', user?.id || '', 'create', null, role.id, {
        role_name: name,
        role_level: roleLevel,
      });

      return role.id;
    } catch (error) {
      console.error('Error creating role:', error);
      throw error;
    }
  }

  async updateRole(
    roleId: string,
    updates: Partial<{ name: string; description: string; roleLevel: number }>
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: before } = await supabase
        .from('roles')
        .select('*')
        .eq('id', roleId)
        .single();

      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.description) updateData.description = updates.description;
      if (updates.roleLevel !== undefined) updateData.role_level = updates.roleLevel;

      await supabase.from('roles').update(updateData).eq('id', roleId);

      await this.logChange('role_updated', user?.id || '', 'update', null, roleId, {
        before,
        after: updateData,
      });
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  }

  async deleteRole(roleId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: role } = await supabase
        .from('roles')
        .select('is_system_role')
        .eq('id', roleId)
        .single();

      if (role?.is_system_role) {
        throw new Error('Cannot delete system roles');
      }

      await supabase.from('roles').delete().eq('id', roleId);

      await this.logChange('role_deleted', user?.id || '', 'delete', null, roleId);
    } catch (error) {
      console.error('Error deleting role:', error);
      throw error;
    }
  }

  async getPermissions(): Promise<Permission[]> {
    try {
      const { data } = await supabase.from('permissions').select('*').order('name');

      if (!data) return [];

      return data.map((p) => ({
        id: p.id,
        name: p.name,
        resource: p.resource,
        action: p.action,
        description: p.description,
      }));
    } catch (error) {
      console.error('Error fetching permissions:', error);
      return [];
    }
  }

  async getRolePermissions(roleId: string): Promise<string[]> {
    try {
      const { data } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', roleId);

      if (!data) return [];

      return data.map((rp) => rp.permission_id);
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      return [];
    }
  }

  async assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('role_permissions').delete().eq('role_id', roleId);

      const assignments = permissionIds.map((permissionId) => ({
        role_id: roleId,
        permission_id: permissionId,
      }));

      await supabase.from('role_permissions').insert(assignments);

      await this.logChange('permission_granted', user?.id || '', 'grant', null, roleId, {
        permission_count: permissionIds.length,
      });
    } catch (error) {
      console.error('Error assigning permissions:', error);
      throw error;
    }
  }

  async assignRoleToUser(
    userId: string,
    roleId: string,
    options?: {
      departmentScope?: string[];
      workflowScope?: string[];
      validUntil?: Date;
      reason?: string;
    }
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: assignment, error } = await supabase
        .from('user_role_assignments')
        .insert({
          user_id: userId,
          role_id: roleId,
          department_scope: options?.departmentScope,
          workflow_scope: options?.workflowScope,
          valid_until: options?.validUntil?.toISOString(),
          assignment_reason: options?.reason,
          assigned_by: user?.id,
        })
        .select()
        .single();

      if (error || !assignment) throw error;

      await this.logChange('user_role_assigned', user?.id || '', 'assign', userId, roleId, {
        department_scope: options?.departmentScope,
        valid_until: options?.validUntil,
      }, options?.reason);

      return assignment.id;
    } catch (error) {
      console.error('Error assigning role to user:', error);
      throw error;
    }
  }

  async revokeUserRole(assignmentId: string, reason?: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: assignment } = await supabase
        .from('user_role_assignments')
        .select('user_id, role_id')
        .eq('id', assignmentId)
        .single();

      await supabase
        .from('user_role_assignments')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: user?.id,
          revoke_reason: reason,
        })
        .eq('id', assignmentId);

      if (assignment) {
        await this.logChange(
          'user_role_revoked',
          user?.id || '',
          'revoke',
          assignment.user_id,
          assignment.role_id,
          null,
          reason
        );
      }
    } catch (error) {
      console.error('Error revoking user role:', error);
      throw error;
    }
  }

  async getUserRoles(userId: string): Promise<UserRoleAssignment[]> {
    try {
      const { data } = await supabase
        .from('user_role_assignments')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false });

      if (!data) return [];

      return data.map((a) => ({
        id: a.id,
        userId: a.user_id,
        roleId: a.role_id,
        departmentScope: a.department_scope,
        workflowScope: a.workflow_scope,
        isActive: a.is_active,
        validFrom: a.valid_from,
        validUntil: a.valid_until,
        assignedBy: a.assigned_by,
        assignmentReason: a.assignment_reason,
      }));
    } catch (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const { data } = await supabase.rpc('get_user_permission_keys', {
        p_user_id: userId,
      });

      if (!data) return [];

      return data.map((row: any) => row.permission_key);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return [];
    }
  }

  async checkUserPermission(userId: string, permissionKey: string): Promise<boolean> {
    try {
      const { data } = await supabase.rpc('check_permission', {
        p_user_id: userId,
        p_permission_key: permissionKey,
      });

      return !!data;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  async setDepartmentPermissions(
    userId: string,
    department: string,
    permissionLevel: 'read' | 'write' | 'manage' | 'admin',
    options?: {
      canManageUsers?: boolean;
      canApprovePrompts?: boolean;
      canViewAnalytics?: boolean;
      canExportData?: boolean;
      validUntil?: Date;
    }
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase
        .from('department_scoped_permissions')
        .upsert({
          user_id: userId,
          department,
          permission_level: permissionLevel,
          can_manage_users: options?.canManageUsers || false,
          can_approve_prompts: options?.canApprovePrompts || false,
          can_view_analytics: options?.canViewAnalytics || false,
          can_export_data: options?.canExportData || false,
          valid_until: options?.validUntil?.toISOString(),
          assigned_by: user?.id,
        });

      await this.logChange('department_permission_changed', user?.id || '', 'modify', userId, null, {
        department,
        permission_level: permissionLevel,
      });
    } catch (error) {
      console.error('Error setting department permissions:', error);
      throw error;
    }
  }

  async getRoleTemplates(): Promise<RoleTemplate[]> {
    try {
      const { data } = await supabase
        .from('rbac_role_templates')
        .select('*')
        .eq('is_public', true)
        .order('is_recommended', { ascending: false })
        .order('template_name');

      if (!data) return [];

      return data.map((t) => ({
        id: t.id,
        templateName: t.template_name,
        templateSlug: t.template_slug,
        description: t.description,
        useCase: t.use_case,
        permissionKeys: t.permission_keys || [],
        isRecommended: t.is_recommended,
      }));
    } catch (error) {
      console.error('Error fetching role templates:', error);
      return [];
    }
  }

  async applyRoleTemplate(
    templateId: string,
    userId: string,
    options?: {
      departmentScope?: string[];
      validUntil?: Date;
    }
  ): Promise<void> {
    try {
      const { data: template } = await supabase
        .from('rbac_role_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (!template) throw new Error('Template not found');

      const roleName = `${template.template_name} (Custom)`;
      const roleLevel = template.role_config?.role_level || 50;

      const roleId = await this.createRole(roleName, template.description, roleLevel);

      await this.assignRoleToUser(userId, roleId, {
        departmentScope: options?.departmentScope,
        validUntil: options?.validUntil,
        reason: `Applied template: ${template.template_name}`,
      });

      await supabase
        .from('rbac_role_templates')
        .update({ usage_count: (template.usage_count || 0) + 1 })
        .eq('id', templateId);
    } catch (error) {
      console.error('Error applying role template:', error);
      throw error;
    }
  }

  async getAuditLog(filters?: {
    userId?: string;
    eventType?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      let query = supabase
        .from('rbac_change_log')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.userId) {
        query = query.eq('target_user_id', filters.userId);
      }

      if (filters?.eventType) {
        query = query.eq('event_type', filters.eventType);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(100);
      }

      const { data } = await query;

      return data || [];
    } catch (error) {
      console.error('Error fetching audit log:', error);
      return [];
    }
  }

  async expireRoleAssignments(): Promise<void> {
    try {
      await supabase.rpc('expire_role_assignments');
    } catch (error) {
      console.error('Error expiring role assignments:', error);
    }
  }

  private async logChange(
    eventType: string,
    actorId: string,
    action: string,
    targetUserId: string | null,
    targetRoleId: string | null,
    changes?: any,
    reason?: string
  ): Promise<void> {
    try {
      await supabase.rpc('log_rbac_change', {
        p_event_type: eventType,
        p_actor_id: actorId,
        p_action: action,
        p_target_user_id: targetUserId,
        p_target_role_id: targetRoleId,
        p_changes: changes ? JSON.stringify(changes) : null,
        p_reason: reason,
      });
    } catch (error) {
      console.error('Error logging RBAC change:', error);
    }
  }
}

export const rbacService = RBACService.getInstance();
