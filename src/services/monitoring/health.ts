import { supabase } from '../../lib/supabase';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthCheck {
  serviceName: string;
  checkType: string;
  status: HealthStatus;
  responseTimeMs?: number;
  errorMessage?: string;
  details?: Record<string, any>;
}

export interface ServiceHealth {
  service: string;
  status: HealthStatus;
  checks: HealthCheck[];
  lastCheck: Date;
}

class HealthService {
  private static instance: HealthService;
  private serviceName: string;
  private checkInterval: number = 60000;

  private constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  static getInstance(serviceName: string = 'app'): HealthService {
    if (!HealthService.instance) {
      HealthService.instance = new HealthService(serviceName);
    }
    return HealthService.instance;
  }

  async performHealthCheck(
    checkType: string,
    checkFn: () => Promise<boolean>,
    timeout: number = 5000
  ): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), timeout)
      );

      const isHealthy = await Promise.race([checkFn(), timeoutPromise]);
      const responseTime = Date.now() - startTime;

      const check: HealthCheck = {
        serviceName: this.serviceName,
        checkType,
        status: isHealthy ? 'healthy' : 'degraded',
        responseTimeMs: responseTime,
      };

      await this.recordHealthCheck(check);
      return check;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      const check: HealthCheck = {
        serviceName: this.serviceName,
        checkType,
        status: 'unhealthy',
        responseTimeMs: responseTime,
        errorMessage: error.message,
      };

      await this.recordHealthCheck(check);
      return check;
    }
  }

  private async recordHealthCheck(check: HealthCheck): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from('health_checks')
        .select('consecutive_failures, last_failure_at, last_success_at')
        .eq('service_name', check.serviceName)
        .eq('check_type', check.checkType)
        .order('checked_at', { ascending: false })
        .limit(1)
        .single();

      const consecutiveFailures =
        check.status === 'unhealthy'
          ? (existing?.consecutive_failures || 0) + 1
          : 0;

      await supabase.from('health_checks').insert({
        service_name: check.serviceName,
        check_type: check.checkType,
        status: check.status,
        response_time_ms: check.responseTimeMs,
        error_message: check.errorMessage,
        details: check.details || {},
        consecutive_failures: consecutiveFailures,
        last_success_at: check.status === 'healthy' ? new Date().toISOString() : existing?.last_success_at,
        last_failure_at: check.status === 'unhealthy' ? new Date().toISOString() : existing?.last_failure_at,
      });
    } catch (error) {
      console.error('Failed to record health check:', error);
    }
  }

  async checkDatabase(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('health_checks')
        .select('id')
        .limit(1);

      return !error && data !== null;
    } catch {
      return false;
    }
  }

  async checkAPI(endpoint: string): Promise<boolean> {
    try {
      const response = await fetch(endpoint, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  async runAllChecks(): Promise<ServiceHealth> {
    const checks: HealthCheck[] = [];

    checks.push(
      await this.performHealthCheck('database', () => this.checkDatabase())
    );

    const overallStatus = this.determineOverallStatus(checks);

    return {
      service: this.serviceName,
      status: overallStatus,
      checks,
      lastCheck: new Date(),
    };
  }

  private determineOverallStatus(checks: HealthCheck[]): HealthStatus {
    if (checks.some((c) => c.status === 'unhealthy')) return 'unhealthy';
    if (checks.some((c) => c.status === 'degraded')) return 'degraded';
    if (checks.every((c) => c.status === 'healthy')) return 'healthy';
    return 'unknown';
  }

  async getServiceHealthSummary(): Promise<ServiceHealth[]> {
    const { data } = await supabase.rpc('get_service_health_summary');

    if (!data) return [];

    return data.map((row: any) => ({
      service: row.service_name,
      status: row.status,
      checks: [],
      lastCheck: new Date(row.last_check),
    }));
  }

  async getHealthHistory(
    serviceName: string,
    hours: number = 24
  ): Promise<HealthCheck[]> {
    const { data } = await supabase
      .from('health_checks')
      .select('*')
      .eq('service_name', serviceName)
      .gte('checked_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('checked_at', { ascending: true });

    if (!data) return [];

    return data.map((row) => ({
      serviceName: row.service_name,
      checkType: row.check_type,
      status: row.status,
      responseTimeMs: row.response_time_ms,
      errorMessage: row.error_message,
      details: row.details,
    }));
  }

  startPeriodicChecks(): void {
    this.runAllChecks();

    setInterval(() => {
      this.runAllChecks();
    }, this.checkInterval);
  }
}

export const healthService = HealthService.getInstance();

export function createHealthService(serviceName: string): HealthService {
  return HealthService.getInstance(serviceName);
}
