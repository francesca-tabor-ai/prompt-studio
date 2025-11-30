import { supabase } from '../../lib/supabase';
import { rateLimiter } from './rateLimiter';
import { threatDetectionService } from './threatDetection';
import { inputValidationService } from './inputValidation';
import { encryptionService } from '../security/encryption';

export interface APIRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  ip: string;
  userId?: string;
}

export interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
  statusCode: number;
  headers?: Record<string, string>;
}

export interface CORSConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  allowCredentials: boolean;
  maxAge: number;
}

class APIGateway {
  private static instance: APIGateway;

  private csrfTokens: Map<string, { token: string; expiresAt: number }> = new Map();

  private constructor() {
    this.startCSRFCleanup();
  }

  static getInstance(): APIGateway {
    if (!APIGateway.instance) {
      APIGateway.instance = new APIGateway();
    }
    return APIGateway.instance;
  }

  async processRequest(request: APIRequest): Promise<APIResponse> {
    try {
      const blocked = await threatDetectionService.checkIPBlocklist(request.ip);
      if (blocked) {
        return {
          success: false,
          error: 'Access denied',
          statusCode: 403,
        };
      }

      const threat = await threatDetectionService.analyzeRequest(request);
      if (!threat.safe) {
        return {
          success: false,
          error: 'Request blocked due to security concerns',
          statusCode: 403,
        };
      }

      const rateLimitResult = await rateLimiter.checkIPLimit(request.ip);
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          statusCode: 429,
          headers: {
            'X-RateLimit-Limit': '50',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString(),
            'Retry-After': String(rateLimitResult.retryAfter),
          },
        };
      }

      if (request.userId) {
        const userRateLimit = await rateLimiter.checkUserLimit(request.userId);
        if (!userRateLimit.allowed) {
          return {
            success: false,
            error: 'User rate limit exceeded',
            statusCode: 429,
          };
        }
      }

      const apiKey = this.extractAPIKey(request.headers);
      if (apiKey) {
        const keyValid = await this.verifyAPIKey(apiKey);
        if (!keyValid) {
          return {
            success: false,
            error: 'Invalid API key',
            statusCode: 401,
          };
        }
      }

      if (this.isStateChangingOperation(request.method)) {
        const csrfValid = await this.verifyCSRFToken(request);
        if (!csrfValid) {
          return {
            success: false,
            error: 'CSRF token validation failed',
            statusCode: 403,
          };
        }
      }

      const corsHeaders = await this.handleCORS(request);

      return {
        success: true,
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        },
      };
    } catch (error: any) {
      console.error('API Gateway error:', error);
      return {
        success: false,
        error: 'Internal server error',
        statusCode: 500,
      };
    }
  }

  async handleCORS(request: APIRequest): Promise<Record<string, string>> {
    const origin = request.headers['origin'] || '';

    const { data: policy } = await supabase
      .from('cors_policies')
      .select('*')
      .eq('name', 'default')
      .eq('status', 'active')
      .single();

    if (!policy) {
      return {};
    }

    const allowedOrigins = policy.allowed_origins as string[];
    const allowedMethods = policy.allowed_methods as string[];
    const allowedHeaders = policy.allowed_headers as string[];

    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': allowedMethods.join(', '),
        'Access-Control-Allow-Headers': allowedHeaders.join(', '),
        'Access-Control-Allow-Credentials': policy.allow_credentials ? 'true' : 'false',
        'Access-Control-Max-Age': String(policy.max_age),
      };
    }

    return {};
  }

  generateCSRFToken(userId: string): string {
    const token = encryptionService.generateSecureToken(32);
    const expiresAt = Date.now() + 60 * 60 * 1000;

    this.csrfTokens.set(userId, { token, expiresAt });

    return token;
  }

  async verifyCSRFToken(request: APIRequest): Promise<boolean> {
    if (!request.userId) {
      return false;
    }

    const token = request.headers['x-csrf-token'];
    if (!token) {
      return false;
    }

    const stored = this.csrfTokens.get(request.userId);
    if (!stored) {
      return false;
    }

    if (Date.now() > stored.expiresAt) {
      this.csrfTokens.delete(request.userId);
      return false;
    }

    return stored.token === token;
  }

  private startCSRFCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [userId, data] of this.csrfTokens.entries()) {
        if (now > data.expiresAt) {
          this.csrfTokens.delete(userId);
        }
      }
    }, 5 * 60 * 1000);
  }

  private extractAPIKey(headers: Record<string, string>): string | null {
    return headers['x-api-key'] || headers['authorization']?.replace('Bearer ', '') || null;
  }

  async verifyAPIKey(apiKey: string): Promise<boolean> {
    const keyHash = encryptionService.hashData(apiKey);

    const { data } = await supabase.rpc('verify_api_key', {
      p_key_hash: keyHash,
    });

    if (data && data.length > 0 && data[0].valid) {
      await supabase
        .from('api_keys')
        .update({
          last_used_at: new Date().toISOString(),
        })
        .eq('id', data[0].key_id);

      return true;
    }

    return false;
  }

  async createAPIKey(
    userId: string,
    name: string,
    scopes: string[] = [],
    expiresInDays?: number
  ): Promise<string> {
    const apiKey = `sk_${encryptionService.generateSecureToken(32)}`;
    const keyHash = encryptionService.hashData(apiKey);
    const keyPrefix = apiKey.substring(0, 7);

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await supabase.from('api_keys').insert({
      user_id: userId,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name: name,
      scopes: scopes,
      expires_at: expiresAt?.toISOString(),
    });

    return apiKey;
  }

  async revokeAPIKey(keyId: string): Promise<void> {
    await supabase
      .from('api_keys')
      .update({ status: 'revoked' })
      .eq('id', keyId);
  }

  async listAPIKeys(userId: string): Promise<any[]> {
    const { data } = await supabase
      .from('api_keys')
      .select('id, key_prefix, name, status, created_at, last_used_at, expires_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return data || [];
  }

  signRequest(
    method: string,
    url: string,
    body: any,
    apiKey: string
  ): string {
    const timestamp = Date.now();
    const payload = `${method}:${url}:${JSON.stringify(body)}:${timestamp}`;
    return encryptionService.generateHMAC(payload, apiKey);
  }

  verifyRequestSignature(
    method: string,
    url: string,
    body: any,
    signature: string,
    apiKey: string,
    timestampWindow: number = 300000
  ): boolean {
    const expectedSignature = this.signRequest(method, url, body, apiKey);

    if (signature !== expectedSignature) {
      return false;
    }

    return true;
  }

  private isStateChangingOperation(method: string): boolean {
    return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
  }

  async getDDoSMetrics(windowMinutes: number = 5): Promise<any> {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const { data: requests } = await supabase
      .from('rate_limits')
      .select('identifier, identifier_type, request_count')
      .gte('window_start', windowStart.toISOString());

    const byIP: Record<string, number> = {};
    const byUser: Record<string, number> = {};

    if (requests) {
      for (const req of requests) {
        if (req.identifier_type === 'ip_address') {
          byIP[req.identifier] = (byIP[req.identifier] || 0) + req.request_count;
        } else if (req.identifier_type === 'user_id') {
          byUser[req.identifier] = (byUser[req.identifier] || 0) + req.request_count;
        }
      }
    }

    const topIPs = Object.entries(byIP)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const totalRequests = Object.values(byIP).reduce((sum, count) => sum + count, 0);

    return {
      totalRequests,
      uniqueIPs: Object.keys(byIP).length,
      topIPs,
      averageRequestsPerIP: totalRequests / Object.keys(byIP).length || 0,
    };
  }
}

export const apiGateway = APIGateway.getInstance();
