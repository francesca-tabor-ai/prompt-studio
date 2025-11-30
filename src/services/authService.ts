import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  company?: string;
  department?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string;
  created_at: string;
}

export interface UserWithRoles extends UserProfile {
  roles: Role[];
  permissions: string[];
}

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  roles: Role[];
  permissions: string[];
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  company?: string;
  department?: string;
}

export interface AuditLogEntry {
  user_id?: string;
  email: string;
  event_type: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

export const authService = {
  async register(data: RegisterData): Promise<{ user: User | null; error: Error | null }> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            company: data.company,
            department: data.department,
          },
        },
      });

      if (authError) throw authError;

      await this.logAuditEvent({
        user_id: authData.user?.id,
        email: data.email,
        event_type: 'registration',
        metadata: { full_name: data.full_name },
      });

      return { user: authData.user, error: null };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  },

  async login(credentials: LoginCredentials): Promise<{ session: Session | null; error: Error | null }> {
    try {
      const isLocked = await this.checkLoginAttempts(credentials.email);
      if (isLocked) {
        throw new Error('Account temporarily locked due to too many failed login attempts. Please try again later.');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        this.recordFailedLogin(credentials.email).catch(console.error);
        this.logAuditEvent({
          email: credentials.email,
          event_type: 'login_failed',
          metadata: { reason: error.message },
        }).catch(console.error);
        throw error;
      }

      this.clearLoginAttempts(credentials.email).catch(console.error);
      this.createSession(data.user.id, data.session).catch(console.error);
      this.logAuditEvent({
        user_id: data.user.id,
        email: credentials.email,
        event_type: 'login',
        metadata: { success: true },
      }).catch(console.error);

      return { session: data.session, error: null };
    } catch (error) {
      return { session: null, error: error as Error };
    }
  },

  async logout(): Promise<{ error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await this.invalidateSessions(user.id);

        await this.logAuditEvent({
          user_id: user.id,
          email: user.email || '',
          event_type: 'logout',
        });
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Exception fetching user profile:', error);
      return null;
    }
  },

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async getUserRoles(userId: string): Promise<Role[]> {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('roles(id, name, description, created_at)')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching user roles:', error);
        return [];
      }

      return data?.map((ur: any) => ur.roles).filter(Boolean) || [];
    } catch (error) {
      console.error('Exception fetching user roles:', error);
      return [];
    }
  },

  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId);

      if (roleError || !roleData || roleData.length === 0) {
        return [];
      }

      const roleIds = roleData.map((r) => r.role_id);

      const { data, error } = await supabase
        .from('role_permissions')
        .select('permissions(name)')
        .in('role_id', roleIds);

      if (error) {
        console.error('Error fetching user permissions:', error);
        return [];
      }

      const permissions = data
        ?.map((rp: any) => rp.permissions?.name)
        .filter(Boolean) || [];

      return [...new Set(permissions)];
    } catch (error) {
      console.error('Exception fetching user permissions:', error);
      return [];
    }
  },

  async hasPermission(userId: string, permissionName: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permissionName);
  },

  async hasRole(userId: string, roleName: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roles.some((r) => r.name === roleName);
  },

  async assignRole(userId: string, roleName: string): Promise<{ error: Error | null }> {
    try {
      const { data: role } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleName)
        .single();

      if (!role) throw new Error('Role not found');

      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role_id: role.id });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async removeRole(userId: string, roleName: string): Promise<{ error: Error | null }> {
    try {
      const { data: role } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleName)
        .single();

      if (!role) throw new Error('Role not found');

      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', role.id);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async createSession(userId: string, session: Session | null): Promise<void> {
    try {
      if (!session) return;

      const expiresAt = new Date(session.expires_at! * 1000);

      await supabase.from('auth_sessions').insert({
        user_id: userId,
        token_hash: this.hashToken(session.access_token),
        expires_at: expiresAt.toISOString(),
      });
    } catch (error) {
      console.error('Error creating session:', error);
    }
  },

  async invalidateSessions(userId: string): Promise<void> {
    await supabase
      .from('auth_sessions')
      .delete()
      .eq('user_id', userId);
  },

  async cleanupExpiredSessions(): Promise<void> {
    await supabase
      .from('auth_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString());
  },

  async checkLoginAttempts(email: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('login_attempts')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (!data) return false;

      if (data.locked_until && new Date(data.locked_until) > new Date()) {
        return true;
      }

      if (data.attempt_count >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(data.last_attempt_at);
        lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);

        await supabase
          .from('login_attempts')
          .update({ locked_until: lockUntil.toISOString() })
          .eq('email', email);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking login attempts:', error);
      return false;
    }
  },

  async recordFailedLogin(email: string): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from('login_attempts')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('login_attempts')
          .update({
            attempt_count: existing.attempt_count + 1,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('email', email);
      } else {
        await supabase.from('login_attempts').insert({
          email,
          ip_address: 'unknown',
          attempt_count: 1,
        });
      }
    } catch (error) {
      console.error('Error recording failed login:', error);
    }
  },

  async clearLoginAttempts(email: string): Promise<void> {
    await supabase
      .from('login_attempts')
      .delete()
      .eq('email', email);
  },

  async logAuditEvent(entry: AuditLogEntry): Promise<void> {
    try {
      await supabase.from('auth_audit_log').insert({
        user_id: entry.user_id,
        email: entry.email,
        event_type: entry.event_type,
        ip_address: entry.ip_address,
        user_agent: entry.user_agent,
        metadata: entry.metadata || {},
      });
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  },

  async getAuditLogs(userId?: string, limit = 50): Promise<any[]> {
    let query = supabase
      .from('auth_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }

    return data || [];
  },

  async getAllRoles(): Promise<Role[]> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching roles:', error);
      return [];
    }

    return data || [];
  },

  async getAllPermissions(): Promise<Permission[]> {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('resource, action');

    if (error) {
      console.error('Error fetching permissions:', error);
      return [];
    }

    return data || [];
  },

  hashToken(token: string): string {
    return btoa(token.substring(0, 32));
  },

  async resetPassword(email: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      await this.logAuditEvent({
        email,
        event_type: 'password_reset_requested',
      });

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async updatePassword(newPassword: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      const user = await this.getCurrentUser();
      if (user) {
        await this.logAuditEvent({
          user_id: user.id,
          email: user.email || '',
          event_type: 'password_changed',
        });
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },
};
