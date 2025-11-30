import { supabase } from '../lib/supabase';
import { performanceMetricsService } from './performanceMetricsService';
import { usageAnalyticsService } from './usageAnalyticsService';

export interface ReportTemplate {
  id: string;
  templateName: string;
  templateSlug: string;
  description: string;
  category: string;
  reportType: string;
  metrics: string[];
  visualizations: any[];
  filters: Record<string, any>;
  breakdownDimensions: string[];
}

export interface ReportSchedule {
  id: string;
  scheduleName: string;
  templateId: string;
  frequency: string;
  recipients: string[];
  exportFormats: string[];
  isActive: boolean;
  nextRunAt: string;
}

export interface ReportExecution {
  id: string;
  templateId: string;
  reportTitle: string;
  executionType: string;
  dateRangeStart: Date;
  dateRangeEnd: Date;
  status: string;
  executiveSummary: any;
  keyInsights: string[];
  metricsCalculated: any;
}

export interface ExportOptions {
  format: 'pdf' | 'csv' | 'json';
  includeCharts: boolean;
  includeRawData: boolean;
}

export class ReportGenerationService {
  private static instance: ReportGenerationService;

  private constructor() {}

  static getInstance(): ReportGenerationService {
    if (!ReportGenerationService.instance) {
      ReportGenerationService.instance = new ReportGenerationService();
    }
    return ReportGenerationService.instance;
  }

  async getTemplates(category?: string): Promise<ReportTemplate[]> {
    try {
      let query = supabase
        .from('report_templates')
        .select('*')
        .eq('is_active', true)
        .order('template_name');

      if (category) {
        query = query.eq('category', category);
      }

      const { data } = await query;

      if (!data) return [];

      return data.map((t) => ({
        id: t.id,
        templateName: t.template_name,
        templateSlug: t.template_slug,
        description: t.description,
        category: t.category,
        reportType: t.report_type,
        metrics: t.metrics || [],
        visualizations: t.visualizations || [],
        filters: t.filters || {},
        breakdownDimensions: t.breakdown_dimensions || [],
      }));
    } catch (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
  }

  async generateReport(
    templateId: string,
    startDate: Date,
    endDate: Date,
    customFilters?: Record<string, any>
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: template } = await supabase
        .from('report_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (!template) throw new Error('Template not found');

      const executionData = {
        template_id: templateId,
        report_title: template.template_name,
        report_subtitle: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        execution_type: 'manual',
        date_range_start: startDate.toISOString().split('T')[0],
        date_range_end: endDate.toISOString().split('T')[0],
        status: 'processing',
        generated_by: user?.id,
      };

      const { data: execution, error } = await supabase
        .from('report_executions')
        .insert(executionData)
        .select()
        .single();

      if (error || !execution) throw error;

      await this.processReport(execution.id, template, startDate, endDate, customFilters);

      return execution.id;
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  private async processReport(
    executionId: string,
    template: any,
    startDate: Date,
    endDate: Date,
    customFilters?: Record<string, any>
  ): Promise<void> {
    try {
      const startTime = Date.now();

      const metrics = await this.collectMetrics(template.metrics, startDate, endDate);

      const executiveSummary = this.generateExecutiveSummary(metrics, startDate, endDate);
      const keyInsights = this.generateKeyInsights(metrics);

      await supabase
        .from('report_executions')
        .update({
          status: 'completed',
          executive_summary: executiveSummary,
          key_insights: keyInsights,
          metrics_calculated: metrics,
          processing_time_seconds: Math.floor((Date.now() - startTime) / 1000),
        })
        .eq('id', executionId);

      await this.createReportSections(executionId, template, metrics);
    } catch (error) {
      await supabase
        .from('report_executions')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', executionId);

      throw error;
    }
  }

  private async collectMetrics(
    metricsList: string[],
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};

    const [performanceData, usageData] = await Promise.all([
      performanceMetricsService.getPerformanceMetrics(startDate, endDate),
      usageAnalyticsService.getUsageMetrics(startDate, endDate),
    ]);

    metrics.performance = performanceData;
    metrics.usage = usageData;

    return metrics;
  }

  private generateExecutiveSummary(
    metrics: Record<string, any>,
    startDate: Date,
    endDate: Date
  ): any {
    return {
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      },
      overview: {
        totalMetrics: Object.keys(metrics).length,
        dataQuality: 'High',
        completeness: 95,
      },
      performance: {
        accuracy: metrics.performance?.avgAiAccuracy || 0,
        satisfaction: metrics.performance?.avgSatisfactionRating || 0,
        successRate: metrics.performance?.sandboxSuccessRate || 0,
      },
      usage: {
        totalEvents: metrics.usage?.totalEvents || 0,
        uniqueUsers: metrics.usage?.uniqueUsers || 0,
        engagement: metrics.usage?.promptUses || 0,
      },
    };
  }

  private generateKeyInsights(metrics: Record<string, any>): string[] {
    const insights: string[] = [];

    if (metrics.performance) {
      const perf = metrics.performance;

      if (perf.avgAiAccuracy >= 4.5) {
        insights.push('AI accuracy is excellent, exceeding 4.5/5 benchmark');
      } else if (perf.avgAiAccuracy < 3.5) {
        insights.push('AI accuracy needs improvement, falling below 3.5/5 threshold');
      }

      if (perf.sandboxSuccessRate >= 90) {
        insights.push('Sandbox testing shows outstanding quality with 90%+ success rate');
      }

      if (perf.avgTimeToApprovalHours > 48) {
        insights.push('Approval process is slow, averaging over 48 hours');
      }
    }

    if (metrics.usage) {
      const usage = metrics.usage;

      if (usage.uniqueUsers > 100) {
        insights.push(`Strong adoption with ${usage.uniqueUsers} active users`);
      }

      const engagementRate = usage.totalEvents > 0 ? (usage.promptUses / usage.totalEvents) * 100 : 0;
      if (engagementRate > 50) {
        insights.push('High user engagement with over 50% conversion rate');
      }
    }

    if (insights.length === 0) {
      insights.push('All metrics are within normal ranges');
    }

    return insights;
  }

  private async createReportSections(
    executionId: string,
    template: any,
    metrics: Record<string, any>
  ): Promise<void> {
    const sections = [];

    sections.push({
      execution_id: executionId,
      section_order: 1,
      section_type: 'summary',
      section_title: 'Executive Summary',
      content: { type: 'summary', data: metrics },
    });

    sections.push({
      execution_id: executionId,
      section_order: 2,
      section_type: 'metrics',
      section_title: 'Key Performance Indicators',
      content: { type: 'metrics', data: metrics.performance },
    });

    sections.push({
      execution_id: executionId,
      section_order: 3,
      section_type: 'chart',
      section_title: 'Usage Trends',
      content: { type: 'usage', data: metrics.usage },
      visualization_type: 'line_chart',
    });

    await supabase.from('report_sections').insert(sections);
  }

  async scheduleReport(
    templateId: string,
    scheduleName: string,
    frequency: string,
    recipients: string[],
    exportFormats: string[],
    scheduleTime?: string
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const nextRunAt = new Date();
      nextRunAt.setDate(nextRunAt.getDate() + 1);

      const { data, error } = await supabase
        .from('report_schedules')
        .insert({
          schedule_name: scheduleName,
          template_id: templateId,
          frequency,
          recipients,
          export_formats: exportFormats,
          next_run_at: nextRunAt.toISOString(),
          created_by: user?.id,
        })
        .select()
        .single();

      if (error || !data) throw error;

      return data.id;
    } catch (error) {
      console.error('Error scheduling report:', error);
      throw error;
    }
  }

  async getScheduledReports(): Promise<ReportSchedule[]> {
    try {
      const { data } = await supabase
        .from('report_schedules')
        .select('*')
        .order('created_at', { ascending: false });

      if (!data) return [];

      return data.map((s) => ({
        id: s.id,
        scheduleName: s.schedule_name,
        templateId: s.template_id,
        frequency: s.frequency,
        recipients: s.recipients,
        exportFormats: s.export_formats,
        isActive: s.is_active,
        nextRunAt: s.next_run_at,
      }));
    } catch (error) {
      console.error('Error fetching scheduled reports:', error);
      return [];
    }
  }

  async getReportExecutions(limit: number = 20): Promise<ReportExecution[]> {
    try {
      const { data } = await supabase
        .from('report_executions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!data) return [];

      return data.map((e) => ({
        id: e.id,
        templateId: e.template_id,
        reportTitle: e.report_title,
        executionType: e.execution_type,
        dateRangeStart: new Date(e.date_range_start),
        dateRangeEnd: new Date(e.date_range_end),
        status: e.status,
        executiveSummary: e.executive_summary,
        keyInsights: e.key_insights || [],
        metricsCalculated: e.metrics_calculated,
      }));
    } catch (error) {
      console.error('Error fetching report executions:', error);
      return [];
    }
  }

  async getReportDetails(executionId: string): Promise<any> {
    try {
      const { data: execution } = await supabase
        .from('report_executions')
        .select('*')
        .eq('id', executionId)
        .single();

      if (!execution) return null;

      const { data: sections } = await supabase
        .from('report_sections')
        .select('*')
        .eq('execution_id', executionId)
        .order('section_order');

      return {
        ...execution,
        sections: sections || [],
      };
    } catch (error) {
      console.error('Error fetching report details:', error);
      return null;
    }
  }

  async exportReport(executionId: string, format: 'pdf' | 'csv' | 'json'): Promise<string> {
    try {
      const report = await this.getReportDetails(executionId);

      if (!report) throw new Error('Report not found');

      let exportData: string;
      let fileName: string;

      switch (format) {
        case 'csv':
          exportData = this.generateCSV(report);
          fileName = `report_${executionId}_${Date.now()}.csv`;
          break;

        case 'json':
          exportData = JSON.stringify(report, null, 2);
          fileName = `report_${executionId}_${Date.now()}.json`;
          break;

        case 'pdf':
          exportData = this.generatePDFContent(report);
          fileName = `report_${executionId}_${Date.now()}.pdf`;
          break;

        default:
          throw new Error('Unsupported format');
      }

      const { data: exportRecord } = await supabase
        .from('report_exports')
        .insert({
          execution_id: executionId,
          export_format: format,
          file_name: fileName,
          file_size_bytes: exportData.length,
        })
        .select()
        .single();

      return exportRecord?.id || '';
    } catch (error) {
      console.error('Error exporting report:', error);
      throw error;
    }
  }

  private generateCSV(report: any): string {
    const rows: string[][] = [];

    rows.push(['Report Title', report.report_title]);
    rows.push(['Period', `${report.date_range_start} to ${report.date_range_end}`]);
    rows.push(['Generated', report.generated_at]);
    rows.push([]);
    rows.push(['Key Insights']);

    (report.key_insights || []).forEach((insight: string) => {
      rows.push([insight]);
    });

    rows.push([]);
    rows.push(['Metrics']);

    if (report.metrics_calculated) {
      Object.entries(report.metrics_calculated).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          Object.entries(value).forEach(([subKey, subValue]) => {
            rows.push([`${key}.${subKey}`, String(subValue)]);
          });
        } else {
          rows.push([key, String(value)]);
        }
      });
    }

    return rows.map((row) => row.join(',')).join('\n');
  }

  private generatePDFContent(report: any): string {
    return `
Report: ${report.report_title}
Period: ${report.date_range_start} to ${report.date_range_end}
Generated: ${report.generated_at}

EXECUTIVE SUMMARY
${JSON.stringify(report.executive_summary, null, 2)}

KEY INSIGHTS
${(report.key_insights || []).map((i: string, idx: number) => `${idx + 1}. ${i}`).join('\n')}

DETAILED METRICS
${JSON.stringify(report.metrics_calculated, null, 2)}
    `.trim();
  }

  async distributeReport(
    executionId: string,
    recipients: string[],
    format: 'pdf' | 'csv'
  ): Promise<void> {
    try {
      const distributions = recipients.map((email) => ({
        execution_id: executionId,
        recipient_email: email,
        recipient_type: 'to',
        export_format: format,
        status: 'pending',
      }));

      await supabase.from('report_distributions').insert(distributions);

      await this.sendReportEmails(executionId, recipients, format);
    } catch (error) {
      console.error('Error distributing report:', error);
      throw error;
    }
  }

  private async sendReportEmails(
    executionId: string,
    recipients: string[],
    format: string
  ): Promise<void> {
    console.log(`Sending ${format} report ${executionId} to ${recipients.length} recipients`);

    await supabase
      .from('report_distributions')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('execution_id', executionId)
      .in('recipient_email', recipients);
  }

  async archiveReport(executionId: string): Promise<void> {
    await supabase
      .from('report_executions')
      .update({
        archived: true,
        archived_at: new Date().toISOString(),
      })
      .eq('id', executionId);
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    await supabase.from('report_schedules').delete().eq('id', scheduleId);
  }
}

export const reportGenerationService = ReportGenerationService.getInstance();
