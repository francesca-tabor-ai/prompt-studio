import { supabase } from '../lib/supabase';
import type { ApiError, ApiResponse } from './types';

export class ApiClient {
  private static instance: ApiClient;

  private constructor() {}

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  async getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  handleError(error: unknown): ApiError {
    if (error && typeof error === 'object' && 'message' in error) {
      return {
        error: 'API_ERROR',
        message: (error as { message: string }).message,
        statusCode: 500,
        details: error as Record<string, unknown>,
      };
    }

    return {
      error: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      statusCode: 500,
    };
  }

  createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
    return {
      data,
      message,
      success: true,
    };
  }

  createErrorResponse(error: ApiError): ApiResponse<null> {
    return {
      data: null,
      message: error.message,
      success: false,
    };
  }

  async logRequest(
    method: string,
    endpoint: string,
    params?: Record<string, unknown>
  ): Promise<void> {
    const user = await this.getCurrentUser();

    await supabase.from('analytics_events').insert({
      event_type: 'other',
      event_name: `API_${method.toUpperCase()}_${endpoint}`,
      user_id: user?.id,
      properties: {
        method,
        endpoint,
        params,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async checkAuthorization(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles (
          name,
          role_permissions (
            permissions (
              resource,
              action
            )
          )
        )
      `)
      .eq('user_id', userId);

    if (!userRoles || userRoles.length === 0) {
      return false;
    }

    for (const userRole of userRoles) {
      const role = userRole.roles as any;
      if (!role || !role.role_permissions) continue;

      for (const rolePermission of role.role_permissions) {
        const permission = rolePermission.permissions;
        if (permission.resource === resource && permission.action === action) {
          return true;
        }
      }
    }

    return false;
  }

  validatePaginationParams(page?: number, limit?: number) {
    const validPage = Math.max(1, page || 1);
    const validLimit = Math.min(Math.max(1, limit || 20), 100);
    const offset = (validPage - 1) * validLimit;

    return { page: validPage, limit: validLimit, offset };
  }
}

export const apiClient = ApiClient.getInstance();
