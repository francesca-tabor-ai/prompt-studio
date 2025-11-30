import { supabase } from '../../lib/supabase';

export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ThreatPattern {
  type: string;
  indicators: string[];
  severity: ThreatLevel;
}

export interface SuspiciousActivityLog {
  activityType: string;
  severity: ThreatLevel;
  identifier: string;
  identifierType: 'user_id' | 'ip_address' | 'api_key';
  details?: Record<string, any>;
  actionTaken?: string;
}

class ThreatDetectionService {
  private static instance: ThreatDetectionService;

  private sqlInjectionPatterns = [
    /(\bUNION\b.*\bSELECT\b)/i,
    /(\bSELECT\b.*\bFROM\b.*\bWHERE\b)/i,
    /('; DROP TABLE)/i,
    /(--|\#|\/\*)/,
    /(\bOR\b\s+\d+\s*=\s*\d+)/i,
    /(\bAND\b\s+\d+\s*=\s*\d+)/i,
  ];

  private xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];

  private pathTraversalPatterns = [
    /\.\.\//g,
    /\.\.%2F/gi,
    /%2e%2e%2f/gi,
  ];

  private suspiciousUserAgents = [
    'sqlmap',
    'nikto',
    'nessus',
    'masscan',
    'nmap',
    'metasploit',
  ];

  private constructor() {}

  static getInstance(): ThreatDetectionService {
    if (!ThreatDetectionService.instance) {
      ThreatDetectionService.instance = new ThreatDetectionService();
    }
    return ThreatDetectionService.instance;
  }

  async analyzeRequest(request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
    ip: string;
    userId?: string;
  }): Promise<{ safe: boolean; threats: string[]; severity: ThreatLevel }> {
    const threats: string[] = [];
    let maxSeverity: ThreatLevel = 'low';

    if (this.detectSQLInjection(request.url)) {
      threats.push('sql_injection_attempt');
      maxSeverity = this.escalateSeverity(maxSeverity, 'critical');
    }

    if (request.body && this.detectSQLInjection(JSON.stringify(request.body))) {
      threats.push('sql_injection_in_body');
      maxSeverity = this.escalateSeverity(maxSeverity, 'critical');
    }

    if (this.detectXSS(request.url) || (request.body && this.detectXSS(JSON.stringify(request.body)))) {
      threats.push('xss_attempt');
      maxSeverity = this.escalateSeverity(maxSeverity, 'high');
    }

    if (this.detectPathTraversal(request.url)) {
      threats.push('path_traversal_attempt');
      maxSeverity = this.escalateSeverity(maxSeverity, 'high');
    }

    if (this.detectSuspiciousUserAgent(request.headers['user-agent'] || '')) {
      threats.push('suspicious_user_agent');
      maxSeverity = this.escalateSeverity(maxSeverity, 'medium');
    }

    if (await this.detectAnomalousPattern(request)) {
      threats.push('anomalous_pattern');
      maxSeverity = this.escalateSeverity(maxSeverity, 'medium');
    }

    if (threats.length > 0) {
      await this.logSuspiciousActivity({
        activityType: threats.join(', '),
        severity: maxSeverity,
        identifier: request.userId || request.ip,
        identifierType: request.userId ? 'user_id' : 'ip_address',
        details: {
          url: request.url,
          method: request.method,
          userAgent: request.headers['user-agent'],
          threats,
        },
      });
    }

    return {
      safe: threats.length === 0,
      threats,
      severity: maxSeverity,
    };
  }

  private detectSQLInjection(input: string): boolean {
    return this.sqlInjectionPatterns.some((pattern) => pattern.test(input));
  }

  private detectXSS(input: string): boolean {
    return this.xssPatterns.some((pattern) => pattern.test(input));
  }

  private detectPathTraversal(input: string): boolean {
    return this.pathTraversalPatterns.some((pattern) => pattern.test(input));
  }

  private detectSuspiciousUserAgent(userAgent: string): boolean {
    const lowerUA = userAgent.toLowerCase();
    return this.suspiciousUserAgents.some((agent) => lowerUA.includes(agent));
  }

  private async detectAnomalousPattern(request: {
    ip: string;
    userId?: string;
  }): Promise<boolean> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const { data: recentActivity } = await supabase
      .from('rate_limits')
      .select('request_count')
      .eq('identifier', request.userId || request.ip)
      .gte('window_start', fiveMinutesAgo.toISOString());

    if (!recentActivity) return false;

    const totalRequests = recentActivity.reduce((sum, r) => sum + r.request_count, 0);

    if (totalRequests > 500) {
      return true;
    }

    return false;
  }

  private escalateSeverity(current: ThreatLevel, detected: ThreatLevel): ThreatLevel {
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const currentIndex = severityOrder.indexOf(current);
    const detectedIndex = severityOrder.indexOf(detected);

    return severityOrder[Math.max(currentIndex, detectedIndex)] as ThreatLevel;
  }

  async logSuspiciousActivity(activity: SuspiciousActivityLog): Promise<void> {
    try {
      await supabase.from('suspicious_activity').insert({
        activity_type: activity.activityType,
        severity: activity.severity,
        identifier: activity.identifier,
        identifier_type: activity.identifierType,
        details: activity.details || {},
        action_taken: activity.actionTaken,
      });

      if (activity.severity === 'critical' || activity.severity === 'high') {
        await this.triggerAlert(activity);
      }

      if (activity.severity === 'critical') {
        await this.autoBlockIP(activity.identifier);
      }
    } catch (error) {
      console.error('Failed to log suspicious activity:', error);
    }
  }

  private async triggerAlert(activity: SuspiciousActivityLog): Promise<void> {
    console.warn('SECURITY ALERT:', {
      type: activity.activityType,
      severity: activity.severity,
      identifier: activity.identifier,
      details: activity.details,
    });
  }

  private async autoBlockIP(identifier: string): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from('blocked_ips')
        .select('*')
        .eq('ip_address', identifier)
        .single();

      if (!existing) {
        await supabase.from('blocked_ips').insert({
          ip_address: identifier,
          reason: 'Automatic block due to critical security threat',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          permanent: false,
        });
      }
    } catch (error) {
      console.error('Failed to auto-block IP:', error);
    }
  }

  async checkIPBlocklist(ipAddress: string): Promise<boolean> {
    const { data } = await supabase.rpc('is_ip_blocked', {
      p_ip_address: ipAddress,
    });

    return data || false;
  }

  async blockIP(
    ipAddress: string,
    reason: string,
    durationHours?: number,
    permanent: boolean = false
  ): Promise<void> {
    const expiresAt = durationHours
      ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
      : null;

    await supabase.from('blocked_ips').insert({
      ip_address: ipAddress,
      reason,
      expires_at: expiresAt?.toISOString(),
      permanent,
    });
  }

  async unblockIP(ipAddress: string): Promise<void> {
    await supabase
      .from('blocked_ips')
      .update({ status: 'removed' })
      .eq('ip_address', ipAddress);
  }

  async getSuspiciousActivityReport(
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const { data: activities } = await supabase
      .from('suspicious_activity')
      .select('*')
      .gte('detected_at', startDate.toISOString())
      .lte('detected_at', endDate.toISOString())
      .order('detected_at', { ascending: false });

    const bySeverity = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const byType: Record<string, number> = {};

    if (activities) {
      for (const activity of activities) {
        bySeverity[activity.severity as ThreatLevel]++;
        byType[activity.activity_type] = (byType[activity.activity_type] || 0) + 1;
      }
    }

    return {
      total: activities?.length || 0,
      bySeverity,
      byType,
      activities: activities?.slice(0, 100),
    };
  }

  async getTopThreats(limit: number = 10): Promise<any[]> {
    const { data } = await supabase
      .from('suspicious_activity')
      .select('activity_type, severity, identifier')
      .order('detected_at', { ascending: false })
      .limit(limit);

    return data || [];
  }
}

export const threatDetectionService = ThreatDetectionService.getInstance();
