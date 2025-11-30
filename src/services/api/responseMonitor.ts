import { supabase } from '../../lib/supabase';

export interface ResponseMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  payloadSize: number;
  statusCode: number;
  compressed: boolean;
  paginationUsed: boolean;
  fieldsSelected: boolean;
}

export interface EndpointStats {
  endpoint: string;
  method: string;
  avgResponseTime: number;
  maxResponseTime: number;
  totalRequests: number;
  avgPayloadSize: number;
  compressionRate: number;
}

class ResponseMonitorService {
  private static instance: ResponseMonitorService;
  private metrics: ResponseMetrics[] = [];

  private constructor() {
    this.startReporting();
  }

  static getInstance(): ResponseMonitorService {
    if (!ResponseMonitorService.instance) {
      ResponseMonitorService.instance = new ResponseMonitorService();
    }
    return ResponseMonitorService.instance;
  }

  async logResponse(metrics: ResponseMetrics): Promise<void> {
    this.metrics.push(metrics);

    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }

    try {
      await supabase.rpc('log_api_response', {
        p_endpoint: metrics.endpoint,
        p_method: metrics.method,
        p_response_time_ms: metrics.responseTime,
        p_payload_size_bytes: metrics.payloadSize,
        p_status_code: metrics.statusCode,
        p_compressed: metrics.compressed,
        p_pagination_used: metrics.paginationUsed,
        p_fields_selected: metrics.fieldsSelected,
      });
    } catch (error) {
      console.error('Failed to log API response metrics:', error);
    }
  }

  async getSlowEndpoints(
    thresholdMs: number = 1000,
    limit: number = 20
  ): Promise<EndpointStats[]> {
    const { data } = await supabase.rpc('get_slow_endpoints', {
      p_threshold_ms: thresholdMs,
      p_limit: limit,
    });

    if (!data) {
      return [];
    }

    return data.map((row: any) => ({
      endpoint: row.endpoint,
      method: row.method,
      avgResponseTime: parseFloat(row.avg_response_time),
      maxResponseTime: parseFloat(row.max_response_time),
      totalRequests: parseInt(row.total_requests),
      avgPayloadSize: parseFloat(row.avg_payload_size),
      compressionRate: 0,
    }));
  }

  async getEndpointStats(endpoint: string): Promise<any> {
    const { data } = await supabase
      .from('api_response_metrics')
      .select('*')
      .eq('endpoint', endpoint)
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!data || data.length === 0) {
      return null;
    }

    const totalTime = data.reduce((sum, m) => sum + m.response_time_ms, 0);
    const totalSize = data.reduce((sum, m) => sum + m.payload_size_bytes, 0);
    const compressedCount = data.filter((m) => m.compressed).length;
    const paginatedCount = data.filter((m) => m.pagination_used).length;
    const fieldSelectedCount = data.filter((m) => m.fields_selected).length;

    return {
      endpoint,
      requests: data.length,
      avgResponseTime: totalTime / data.length,
      maxResponseTime: Math.max(...data.map((m) => m.response_time_ms)),
      minResponseTime: Math.min(...data.map((m) => m.response_time_ms)),
      avgPayloadSize: totalSize / data.length,
      maxPayloadSize: Math.max(...data.map((m) => m.payload_size_bytes)),
      compressionRate: (compressedCount / data.length) * 100,
      paginationRate: (paginatedCount / data.length) * 100,
      fieldSelectionRate: (fieldSelectedCount / data.length) * 100,
    };
  }

  async getOptimizationReport(): Promise<any> {
    const { data: recentMetrics } = await supabase
      .from('api_response_metrics')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!recentMetrics || recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        avgResponseTime: 0,
        avgPayloadSize: 0,
        optimizationUsage: {
          compression: 0,
          pagination: 0,
          fieldSelection: 0,
        },
        recommendations: [],
      };
    }

    const totalRequests = recentMetrics.length;
    const totalTime = recentMetrics.reduce(
      (sum, m) => sum + m.response_time_ms,
      0
    );
    const totalSize = recentMetrics.reduce(
      (sum, m) => sum + m.payload_size_bytes,
      0
    );

    const compressedCount = recentMetrics.filter((m) => m.compressed).length;
    const paginatedCount = recentMetrics.filter((m) => m.pagination_used).length;
    const fieldSelectedCount = recentMetrics.filter(
      (m) => m.fields_selected
    ).length;

    const compressionRate = (compressedCount / totalRequests) * 100;
    const paginationRate = (paginatedCount / totalRequests) * 100;
    const fieldSelectionRate = (fieldSelectedCount / totalRequests) * 100;

    const recommendations: string[] = [];

    if (compressionRate < 50) {
      recommendations.push(
        `Only ${compressionRate.toFixed(2)}% of responses are compressed. Enable compression for better performance.`
      );
    }

    if (paginationRate < 30) {
      recommendations.push(
        `Only ${paginationRate.toFixed(2)}% of responses use pagination. Consider implementing pagination for large datasets.`
      );
    }

    if (fieldSelectionRate < 20) {
      recommendations.push(
        `Only ${fieldSelectionRate.toFixed(2)}% of responses use field selection. Encourage clients to request only needed fields.`
      );
    }

    const slowEndpoints = await this.getSlowEndpoints(1000, 5);
    if (slowEndpoints.length > 0) {
      recommendations.push(
        `${slowEndpoints.length} endpoints have response times > 1s. Optimize these endpoints.`
      );
    }

    return {
      totalRequests,
      avgResponseTime: (totalTime / totalRequests).toFixed(2),
      avgPayloadSize: Math.floor(totalSize / totalRequests),
      optimizationUsage: {
        compression: compressionRate.toFixed(2),
        pagination: paginationRate.toFixed(2),
        fieldSelection: fieldSelectionRate.toFixed(2),
      },
      slowEndpoints,
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }

  getRecentMetrics(limit: number = 100): ResponseMetrics[] {
    return this.metrics.slice(-limit);
  }

  private startReporting(): void {
    setInterval(() => {
      this.reportSummary();
    }, 5 * 60 * 1000);
  }

  private reportSummary(): void {
    if (this.metrics.length === 0) {
      return;
    }

    const avgResponseTime =
      this.metrics.reduce((sum, m) => sum + m.responseTime, 0) /
      this.metrics.length;

    const avgPayloadSize =
      this.metrics.reduce((sum, m) => sum + m.payloadSize, 0) /
      this.metrics.length;

    console.log('API Response Summary:', {
      requests: this.metrics.length,
      avgResponseTime: avgResponseTime.toFixed(2),
      avgPayloadSize: Math.floor(avgPayloadSize),
    });
  }
}

export const responseMonitor = ResponseMonitorService.getInstance();
