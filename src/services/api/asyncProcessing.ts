import { supabase } from '../../lib/supabase';
import { webhookService } from './webhooks';

export interface AsyncJob {
  id: string;
  type: string;
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  result?: any;
  error?: string;
}

class AsyncProcessingService {
  private static instance: AsyncProcessingService;
  private workers: Map<string, (job: AsyncJob) => Promise<any>> = new Map();

  private constructor() {
    this.startJobProcessor();
    this.registerDefaultWorkers();
  }

  static getInstance(): AsyncProcessingService {
    if (!AsyncProcessingService.instance) {
      AsyncProcessingService.instance = new AsyncProcessingService();
    }
    return AsyncProcessingService.instance;
  }

  async createJob(
    type: string,
    payload: any,
    userId?: string,
    webhookUrl?: string
  ): Promise<string> {
    const { data } = await supabase.rpc('create_async_job', {
      p_job_type: type,
      p_payload: payload,
      p_created_by: userId,
      p_webhook_url: webhookUrl,
    });

    return data;
  }

  async getJob(jobId: string): Promise<AsyncJob | null> {
    const { data } = await supabase
      .from('async_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      type: data.job_type,
      payload: data.payload,
      status: data.status,
      progress: data.progress,
      result: data.result,
      error: data.error_message,
    };
  }

  async listJobs(userId: string, limit: number = 20): Promise<AsyncJob[]> {
    const { data } = await supabase
      .from('async_jobs')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      type: row.job_type,
      payload: row.payload,
      status: row.status,
      progress: row.progress,
      result: row.result,
      error: row.error_message,
    }));
  }

  async cancelJob(jobId: string): Promise<void> {
    await supabase
      .from('async_jobs')
      .update({ status: 'cancelled' })
      .eq('id', jobId)
      .in('status', ['pending', 'processing']);
  }

  registerWorker(
    type: string,
    worker: (job: AsyncJob) => Promise<any>
  ): void {
    this.workers.set(type, worker);
  }

  private async processJob(job: AsyncJob): Promise<void> {
    const worker = this.workers.get(job.type);

    if (!worker) {
      console.error(`No worker registered for job type: ${job.type}`);
      return;
    }

    await supabase
      .from('async_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    try {
      const result = await worker(job);

      await supabase
        .from('async_jobs')
        .update({
          status: 'completed',
          result,
          progress: 100,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      const { data: jobData } = await supabase
        .from('async_jobs')
        .select('webhook_url')
        .eq('id', job.id)
        .single();

      if (jobData?.webhook_url) {
        await webhookService.trigger('job.completed', {
          jobId: job.id,
          type: job.type,
          result,
        });
      }
    } catch (error: any) {
      await supabase
        .from('async_jobs')
        .update({
          status: 'failed',
          error_message: error.message,
          failed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      const { data: jobData } = await supabase
        .from('async_jobs')
        .select('webhook_url')
        .eq('id', job.id)
        .single();

      if (jobData?.webhook_url) {
        await webhookService.trigger('job.failed', {
          jobId: job.id,
          type: job.type,
          error: error.message,
        });
      }
    }
  }

  private async startJobProcessor(): Promise<void> {
    setInterval(async () => {
      await this.processPendingJobs();
    }, 5000);
  }

  private async processPendingJobs(): Promise<void> {
    const { data: jobs } = await supabase
      .from('async_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (!jobs || jobs.length === 0) {
      return;
    }

    for (const jobRow of jobs) {
      const job: AsyncJob = {
        id: jobRow.id,
        type: jobRow.job_type,
        payload: jobRow.payload,
        status: jobRow.status,
        progress: jobRow.progress,
      };

      await this.processJob(job);
    }
  }

  private registerDefaultWorkers(): void {
    this.registerWorker('export_data', async (job) => {
      await this.updateProgress(job.id, 25);

      const data = await this.exportData(job.payload);

      await this.updateProgress(job.id, 75);

      return { downloadUrl: data };
    });

    this.registerWorker('bulk_update', async (job) => {
      const total = job.payload.items.length;
      let processed = 0;

      for (const item of job.payload.items) {
        await this.processBulkItem(item);
        processed++;
        const progress = Math.floor((processed / total) * 100);
        await this.updateProgress(job.id, progress);
      }

      return { processed };
    });

    this.registerWorker('generate_report', async (job) => {
      await this.updateProgress(job.id, 20);

      const report = await this.generateReport(job.payload);

      await this.updateProgress(job.id, 90);

      return report;
    });
  }

  private async updateProgress(jobId: string, progress: number): Promise<void> {
    await supabase.rpc('update_job_progress', {
      p_job_id: jobId,
      p_progress: progress,
    });
  }

  private async exportData(params: any): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return 'https://example.com/exports/data-export.csv';
  }

  private async processBulkItem(item: any): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async generateReport(params: any): Promise<any> {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return { reportUrl: 'https://example.com/reports/report.pdf' };
  }
}

export const asyncProcessingService = AsyncProcessingService.getInstance();
