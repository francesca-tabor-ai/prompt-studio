import { supabase } from '../../lib/supabase';

export type SpanStatus = 'ok' | 'error' | 'unset';

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: SpanStatus;
  tags?: Record<string, any>;
  logs?: Array<{ timestamp: Date; message: string; fields?: Record<string, any> }>;
  error?: boolean;
  errorMessage?: string;
}

class TracingService {
  private static instance: TracingService;
  private activeSpans: Map<string, Span> = new Map();

  private constructor() {}

  static getInstance(): TracingService {
    if (!TracingService.instance) {
      TracingService.instance = new TracingService();
    }
    return TracingService.instance;
  }

  generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  generateSpanId(): string {
    return `span_${Math.random().toString(36).substr(2, 16)}`;
  }

  startSpan(
    serviceName: string,
    operationName: string,
    traceId?: string,
    parentSpanId?: string
  ): Span {
    const span: Span = {
      traceId: traceId || this.generateTraceId(),
      spanId: this.generateSpanId(),
      parentSpanId,
      serviceName,
      operationName,
      startTime: new Date(),
      status: 'unset',
      tags: {},
      logs: [],
    };

    this.activeSpans.set(span.spanId, span);
    return span;
  }

  endSpan(spanId: string, status: SpanStatus = 'ok', error?: Error): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    span.status = status;

    if (error) {
      span.error = true;
      span.errorMessage = error.message;
      this.addSpanLog(spanId, 'error', { error: error.message, stack: error.stack });
    }

    this.recordSpan(span);
    this.activeSpans.delete(spanId);
  }

  addSpanTag(spanId: string, key: string, value: any): void {
    const span = this.activeSpans.get(spanId);
    if (span && span.tags) {
      span.tags[key] = value;
    }
  }

  addSpanLog(spanId: string, message: string, fields?: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);
    if (span && span.logs) {
      span.logs.push({
        timestamp: new Date(),
        message,
        fields,
      });
    }
  }

  private async recordSpan(span: Span): Promise<void> {
    try {
      await supabase.from('distributed_traces').insert({
        trace_id: span.traceId,
        span_id: span.spanId,
        parent_span_id: span.parentSpanId,
        service_name: span.serviceName,
        operation_name: span.operationName,
        start_time: span.startTime.toISOString(),
        end_time: span.endTime?.toISOString(),
        duration_ms: span.duration,
        status: span.status,
        tags: span.tags || {},
        logs: span.logs || [],
        error: span.error || false,
        error_message: span.errorMessage,
      });
    } catch (error) {
      console.error('Failed to record span:', error);
    }
  }

  async getTrace(traceId: string): Promise<Span[]> {
    const { data } = await supabase
      .from('distributed_traces')
      .select('*')
      .eq('trace_id', traceId)
      .order('start_time', { ascending: true });

    if (!data) return [];

    return data.map((row) => ({
      traceId: row.trace_id,
      spanId: row.span_id,
      parentSpanId: row.parent_span_id,
      serviceName: row.service_name,
      operationName: row.operation_name,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      duration: row.duration_ms,
      status: row.status,
      tags: row.tags,
      logs: row.logs,
      error: row.error,
      errorMessage: row.error_message,
    }));
  }

  async getRecentTraces(limit: number = 100): Promise<any[]> {
    const { data } = await supabase
      .from('distributed_traces')
      .select('trace_id, service_name, operation_name, start_time, duration_ms, error')
      .is('parent_span_id', null)
      .order('start_time', { ascending: false })
      .limit(limit);

    return data || [];
  }

  async getErrorTraces(hours: number = 24): Promise<any[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const { data } = await supabase
      .from('distributed_traces')
      .select('*')
      .eq('error', true)
      .gte('start_time', startTime.toISOString())
      .order('start_time', { ascending: false });

    return data || [];
  }

  async getSlowTraces(thresholdMs: number = 2000, limit: number = 50): Promise<any[]> {
    const { data } = await supabase
      .from('distributed_traces')
      .select('*')
      .gt('duration_ms', thresholdMs)
      .is('parent_span_id', null)
      .order('duration_ms', { ascending: false })
      .limit(limit);

    return data || [];
  }

  wrapAsync<T>(
    serviceName: string,
    operationName: string,
    fn: (span: Span) => Promise<T>,
    traceId?: string,
    parentSpanId?: string
  ): Promise<T> {
    const span = this.startSpan(serviceName, operationName, traceId, parentSpanId);

    return fn(span)
      .then((result) => {
        this.endSpan(span.spanId, 'ok');
        return result;
      })
      .catch((error) => {
        this.endSpan(span.spanId, 'error', error);
        throw error;
      });
  }
}

export const tracingService = TracingService.getInstance();

export function trace<T>(
  serviceName: string,
  operationName: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return tracingService.wrapAsync(serviceName, operationName, fn);
}
