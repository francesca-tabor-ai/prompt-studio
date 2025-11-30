import { supabase } from '../../lib/supabase';

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface MetricTags {
  [key: string]: string | number;
}

export interface MetricOptions {
  tags?: MetricTags;
  unit?: string;
}

class MetricsService {
  private static instance: MetricsService;
  private serviceName: string;
  private metricsBuffer: any[] = [];
  private flushInterval: number = 10000;

  private constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.startFlushTimer();
  }

  static getInstance(serviceName: string = 'app'): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService(serviceName);
    }
    return MetricsService.instance;
  }

  private startFlushTimer(): void {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private async flush(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      await supabase.from('application_metrics').insert(metrics);
    } catch (error) {
      console.error('Failed to flush metrics:', error);
      this.metricsBuffer.push(...metrics);
    }
  }

  private recordMetric(
    metricName: string,
    metricType: MetricType,
    value: number,
    options: MetricOptions = {}
  ): void {
    this.metricsBuffer.push({
      service_name: this.serviceName,
      metric_name: metricName,
      metric_type: metricType,
      value,
      unit: options.unit,
      tags: options.tags || {},
    });

    if (this.metricsBuffer.length >= 100) {
      this.flush();
    }
  }

  counter(name: string, value: number = 1, options?: MetricOptions): void {
    this.recordMetric(name, 'counter', value, options);
  }

  gauge(name: string, value: number, options?: MetricOptions): void {
    this.recordMetric(name, 'gauge', value, options);
  }

  histogram(name: string, value: number, options?: MetricOptions): void {
    this.recordMetric(name, 'histogram', value, options);
  }

  timing(name: string, durationMs: number, options?: MetricOptions): void {
    this.histogram(name, durationMs, { ...options, unit: 'ms' });
  }

  async recordAPICall(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number
  ): Promise<void> {
    this.timing('api.response_time', duration, {
      tags: { endpoint, method, status: statusCode },
    });

    this.counter('api.requests_total', 1, {
      tags: { endpoint, method, status: statusCode },
    });

    if (statusCode >= 500) {
      this.counter('api.errors_total', 1, {
        tags: { endpoint, method, type: 'server_error' },
      });
    } else if (statusCode >= 400) {
      this.counter('api.errors_total', 1, {
        tags: { endpoint, method, type: 'client_error' },
      });
    }
  }

  async recordSystemMetrics(): Promise<void> {
    if (typeof window === 'undefined') return;

    const memory = (performance as any).memory;
    if (memory) {
      this.gauge('system.memory.used', memory.usedJSHeapSize / 1024 / 1024, {
        unit: 'MB',
      });
      this.gauge('system.memory.total', memory.totalJSHeapSize / 1024 / 1024, {
        unit: 'MB',
      });
      this.gauge(
        'system.memory.usage_percent',
        (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
        { unit: '%' }
      );
    }
  }

  async getMetrics(
    metricName: string,
    startTime: Date,
    endTime: Date
  ): Promise<any[]> {
    const { data } = await supabase
      .from('application_metrics')
      .select('*')
      .eq('service_name', this.serviceName)
      .eq('metric_name', metricName)
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())
      .order('timestamp', { ascending: true });

    return data || [];
  }

  async getAggregatedMetrics(
    metricName: string,
    aggregation: 'avg' | 'sum' | 'min' | 'max',
    startTime: Date,
    endTime: Date
  ): Promise<number> {
    const metrics = await this.getMetrics(metricName, startTime, endTime);

    if (metrics.length === 0) return 0;

    const values = metrics.map((m) => parseFloat(m.value));

    switch (aggregation) {
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      default:
        return 0;
    }
  }

  async getErrorRate(timeWindowMinutes: number = 5): Promise<number> {
    const { data } = await supabase.rpc('get_error_rate', {
      p_service_name: this.serviceName,
      p_time_window: `${timeWindowMinutes} minutes`,
    });

    return data || 0;
  }
}

export const metricsService = MetricsService.getInstance();

export function createMetricsService(serviceName: string): MetricsService {
  return MetricsService.getInstance(serviceName);
}
