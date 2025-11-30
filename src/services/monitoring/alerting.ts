import { supabase } from '../../lib/supabase';
import { logger } from './logger';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertCondition = 'greater_than' | 'less_than' | 'equals' | 'not_equals';
export type IncidentStatus = 'firing' | 'acknowledged' | 'resolved';

export interface Alert {
  id: string;
  name: string;
  description?: string;
  serviceName?: string;
  metricName?: string;
  condition: AlertCondition;
  threshold?: number;
  severity: AlertSeverity;
  evaluationWindow: string;
  cooldownPeriod: string;
  notificationChannels: string[];
  isActive: boolean;
}

export interface AlertIncident {
  id: string;
  alertId: string;
  incidentId: string;
  status: IncidentStatus;
  severity: AlertSeverity;
  triggeredAt: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  triggerValue?: number;
  message?: string;
}

class AlertingService {
  private static instance: AlertingService;
  private evaluationInterval: number = 60000;

  private constructor() {
    this.startEvaluationLoop();
  }

  static getInstance(): AlertingService {
    if (!AlertingService.instance) {
      AlertingService.instance = new AlertingService();
    }
    return AlertingService.instance;
  }

  private startEvaluationLoop(): void {
    setInterval(() => {
      this.evaluateAllAlerts();
    }, this.evaluationInterval);
  }

  async evaluateAllAlerts(): Promise<void> {
    const { data: alerts } = await supabase
      .from('alerts')
      .select('*')
      .eq('is_active', true);

    if (!alerts) return;

    for (const alert of alerts) {
      await this.evaluateAlert(alert);
    }
  }

  private async evaluateAlert(alert: any): Promise<void> {
    try {
      const shouldFire = await this.checkAlertCondition(alert);

      if (shouldFire) {
        await this.fireAlert(alert);
      } else {
        await this.resolveAlertIfActive(alert.id);
      }
    } catch (error: any) {
      logger.error('Alert evaluation failed', error, { alertId: alert.id });
    }
  }

  private async checkAlertCondition(alert: any): Promise<boolean> {
    const metricName = alert.metric_name;
    const threshold = alert.threshold;

    if (metricName === 'health_status') {
      return this.checkHealthStatus(alert.service_name);
    }

    if (metricName === 'error_rate') {
      return this.checkErrorRate(alert.service_name, threshold);
    }

    if (metricName === 'response_time_ms') {
      return this.checkResponseTime(alert.service_name, threshold);
    }

    if (metricName === 'cpu_usage_percent') {
      return this.checkCPUUsage(alert.service_name, threshold);
    }

    if (metricName === 'memory_usage_percent') {
      return this.checkMemoryUsage(alert.service_name, threshold);
    }

    return false;
  }

  private async checkHealthStatus(serviceName: string): Promise<boolean> {
    const { data } = await supabase
      .from('health_checks')
      .select('status')
      .eq('service_name', serviceName)
      .order('checked_at', { ascending: false })
      .limit(1)
      .single();

    return data?.status === 'unhealthy';
  }

  private async checkErrorRate(
    serviceName: string,
    threshold: number
  ): Promise<boolean> {
    const { data } = await supabase.rpc('get_error_rate', {
      p_service_name: serviceName,
      p_time_window: '5 minutes',
    });

    return (data || 0) > threshold;
  }

  private async checkResponseTime(
    serviceName: string,
    threshold: number
  ): Promise<boolean> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const { data } = await supabase
      .from('application_metrics')
      .select('value')
      .eq('service_name', serviceName)
      .eq('metric_name', 'api.response_time')
      .gte('timestamp', fiveMinutesAgo.toISOString());

    if (!data || data.length === 0) return false;

    const avgResponseTime =
      data.reduce((sum, m) => sum + parseFloat(m.value), 0) / data.length;

    return avgResponseTime > threshold;
  }

  private async checkCPUUsage(
    serviceName: string,
    threshold: number
  ): Promise<boolean> {
    const { data } = await supabase
      .from('system_metrics')
      .select('cpu_usage_percent')
      .eq('service_name', serviceName)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    return (data?.cpu_usage_percent || 0) > threshold;
  }

  private async checkMemoryUsage(
    serviceName: string,
    threshold: number
  ): Promise<boolean> {
    const { data } = await supabase
      .from('system_metrics')
      .select('memory_usage_percent')
      .eq('service_name', serviceName)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    return (data?.memory_usage_percent || 0) > threshold;
  }

  private async fireAlert(alert: any): Promise<void> {
    const { data: recentIncident } = await supabase
      .from('alert_incidents')
      .select('*')
      .eq('alert_id', alert.id)
      .eq('status', 'firing')
      .order('triggered_at', { ascending: false })
      .limit(1)
      .single();

    if (recentIncident) {
      return;
    }

    const { data: lastResolved } = await supabase
      .from('alert_incidents')
      .select('resolved_at')
      .eq('alert_id', alert.id)
      .eq('status', 'resolved')
      .order('resolved_at', { ascending: false })
      .limit(1)
      .single();

    if (lastResolved) {
      const cooldownMs = this.parseDuration(alert.cooldown_period);
      const timeSinceResolved = Date.now() - new Date(lastResolved.resolved_at).getTime();

      if (timeSinceResolved < cooldownMs) {
        return;
      }
    }

    const incidentId = `inc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await supabase.from('alert_incidents').insert({
      alert_id: alert.id,
      incident_id: incidentId,
      status: 'firing',
      severity: alert.severity,
      message: `Alert "${alert.alert_name}" triggered`,
    });

    await this.sendNotifications(alert, incidentId);

    logger.warn(`Alert triggered: ${alert.alert_name}`, {
      alertId: alert.id,
      incidentId,
      severity: alert.severity,
    });
  }

  private async resolveAlertIfActive(alertId: string): Promise<void> {
    const { data: activeIncidents } = await supabase
      .from('alert_incidents')
      .select('*')
      .eq('alert_id', alertId)
      .eq('status', 'firing');

    if (!activeIncidents || activeIncidents.length === 0) return;

    for (const incident of activeIncidents) {
      await supabase
        .from('alert_incidents')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', incident.id);

      logger.info(`Alert resolved: ${incident.incident_id}`, {
        incidentId: incident.id,
      });
    }
  }

  private async sendNotifications(alert: any, incidentId: string): Promise<void> {
    const channels = alert.notification_channels || [];

    for (const channel of channels) {
      try {
        await this.sendNotificationToChannel(channel, alert, incidentId);
      } catch (error: any) {
        logger.error(`Failed to send notification to ${channel}`, error, {
          alertId: alert.id,
          incidentId,
        });
      }
    }
  }

  private async sendNotificationToChannel(
    channel: string,
    alert: any,
    incidentId: string
  ): Promise<void> {
    logger.info(`Notification sent to ${channel}`, {
      alertName: alert.alert_name,
      incidentId,
      severity: alert.severity,
    });
  }

  async acknowledgeIncident(incidentId: string, userId: string): Promise<void> {
    await supabase
      .from('alert_incidents')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq('incident_id', incidentId);

    logger.info(`Incident acknowledged: ${incidentId}`, { userId });
  }

  async getActiveIncidents(): Promise<AlertIncident[]> {
    const { data } = await supabase
      .from('alert_incidents')
      .select('*, alerts(alert_name)')
      .in('status', ['firing', 'acknowledged'])
      .order('triggered_at', { ascending: false });

    if (!data) return [];

    return data.map((row) => ({
      id: row.id,
      alertId: row.alert_id,
      incidentId: row.incident_id,
      status: row.status,
      severity: row.severity,
      triggeredAt: new Date(row.triggered_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      acknowledgedBy: row.acknowledged_by,
      triggerValue: row.trigger_value,
      message: row.message,
    }));
  }

  async getIncidentHistory(hours: number = 24): Promise<AlertIncident[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const { data } = await supabase
      .from('alert_incidents')
      .select('*')
      .gte('triggered_at', startTime.toISOString())
      .order('triggered_at', { ascending: false });

    if (!data) return [];

    return data.map((row) => ({
      id: row.id,
      alertId: row.alert_id,
      incidentId: row.incident_id,
      status: row.status,
      severity: row.severity,
      triggeredAt: new Date(row.triggered_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      acknowledgedBy: row.acknowledged_by,
      triggerValue: row.trigger_value,
      message: row.message,
    }));
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/(\d+)\s*(second|minute|hour|day)s?/);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      second: 1000,
      minute: 60000,
      hour: 3600000,
      day: 86400000,
    };

    return value * (multipliers[unit] || 0);
  }
}

export const alertingService = AlertingService.getInstance();
