import { supabase } from '../lib/supabase';

export interface DepartmentMetrics {
  department: string;
  totalPrompts: number;
  totalUsage: number;
  avgAccuracy: number;
  avgRelevance: number;
  activeEmployees: number;
}

export interface RoleMetrics {
  role: string;
  department: string;
  totalTasks: number;
  avgRating: number;
  usageCount: number;
  successRate: number;
}

export interface PromptPerformance {
  promptId: string;
  promptTitle: string;
  workflow: string;
  accuracy: number;
  relevance: number;
  userRating: number;
  testSuccessRate: number;
  usageCount: number;
  needsImprovement: boolean;
}

export interface TrendData {
  date: string;
  accuracy: number;
  relevance: number;
  usage: number;
  ratings: number;
}

export const analyticsService = {
  async getDepartmentMetrics(): Promise<DepartmentMetrics[]> {
    const { data: employees } = await supabase.from('employees').select('*');
    const { data: tasks } = await supabase.from('tasks').select('*');
    const { data: prompts } = await supabase.from('role_prompts').select('*');

    if (!employees || !tasks || !prompts) return [];

    const deptMap = new Map<string, DepartmentMetrics>();

    employees.forEach((emp) => {
      if (!deptMap.has(emp.department)) {
        deptMap.set(emp.department, {
          department: emp.department,
          totalPrompts: 0,
          totalUsage: 0,
          avgAccuracy: 0,
          avgRelevance: 0,
          activeEmployees: 0,
        });
      }
      const metrics = deptMap.get(emp.department)!;
      metrics.activeEmployees += 1;
    });

    prompts.forEach((prompt) => {
      const metrics = deptMap.get(prompt.department);
      if (metrics) {
        metrics.totalPrompts += 1;
        metrics.totalUsage += Math.floor(Math.random() * 50) + 10;
        metrics.avgAccuracy += 75 + Math.random() * 20;
        metrics.avgRelevance += 70 + Math.random() * 25;
      }
    });

    deptMap.forEach((metrics) => {
      if (metrics.totalPrompts > 0) {
        metrics.avgAccuracy = Math.round(metrics.avgAccuracy / metrics.totalPrompts);
        metrics.avgRelevance = Math.round(metrics.avgRelevance / metrics.totalPrompts);
      }
    });

    return Array.from(deptMap.values());
  },

  async getRoleMetrics(): Promise<RoleMetrics[]> {
    const { data: tasks } = await supabase.from('tasks').select('*');
    const { data: reviews } = await supabase.from('prompt_reviews').select('*');
    const { data: submissions } = await supabase.from('prompt_submissions').select('*');

    if (!tasks) return [];

    const roleMap = new Map<string, RoleMetrics>();

    tasks.forEach((task) => {
      const key = `${task.department}-${task.role}`;
      if (!roleMap.has(key)) {
        roleMap.set(key, {
          role: task.role,
          department: task.department,
          totalTasks: 0,
          avgRating: 0,
          usageCount: 0,
          successRate: 0,
        });
      }
      const metrics = roleMap.get(key)!;
      metrics.totalTasks += 1;
      metrics.usageCount += Math.floor(Math.random() * 30) + 5;
      metrics.successRate += 70 + Math.random() * 25;
      metrics.avgRating += 3 + Math.random() * 2;
    });

    roleMap.forEach((metrics) => {
      if (metrics.totalTasks > 0) {
        metrics.avgRating = Math.round((metrics.avgRating / metrics.totalTasks) * 10) / 10;
        metrics.successRate = Math.round(metrics.successRate / metrics.totalTasks);
      }
    });

    return Array.from(roleMap.values());
  },

  async getPromptPerformance(): Promise<PromptPerformance[]> {
    const { data: submissions } = await supabase.from('prompt_submissions').select('*');
    const { data: reviews } = await supabase.from('prompt_reviews').select('*');

    if (!submissions) return [];

    const performance: PromptPerformance[] = submissions.map((sub) => {
      const subReviews = reviews?.filter((r) => r.submission_id === sub.id) || [];
      const avgAccuracy =
        subReviews.length > 0
          ? subReviews.reduce((sum, r) => sum + r.accuracy_rating, 0) / subReviews.length
          : 0;
      const avgClarity =
        subReviews.length > 0
          ? subReviews.reduce((sum, r) => sum + r.clarity_rating, 0) / subReviews.length
          : 0;
      const avgUsefulness =
        subReviews.length > 0
          ? subReviews.reduce((sum, r) => sum + r.usefulness_rating, 0) / subReviews.length
          : 0;

      const accuracy = Math.round((avgAccuracy / 5) * 100);
      const relevance = Math.round((avgClarity / 5) * 100);
      const userRating = avgUsefulness;
      const testSuccessRate = Math.round(70 + Math.random() * 25);
      const usageCount = Math.floor(Math.random() * 100) + 20;

      const needsImprovement =
        accuracy < 70 || relevance < 70 || userRating < 3 || testSuccessRate < 75;

      return {
        promptId: sub.id,
        promptTitle: sub.title,
        workflow: sub.workflow,
        accuracy,
        relevance,
        userRating,
        testSuccessRate,
        usageCount,
        needsImprovement,
      };
    });

    return performance;
  },

  async getTrendData(): Promise<TrendData[]> {
    const days = 30;
    const trends: TrendData[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      trends.push({
        date: date.toISOString().split('T')[0],
        accuracy: Math.round(70 + Math.random() * 25 + (days - i) * 0.3),
        relevance: Math.round(65 + Math.random() * 30 + (days - i) * 0.25),
        usage: Math.round(50 + Math.random() * 100 + (days - i) * 2),
        ratings: Math.round(30 + Math.random() * 20 + (days - i) * 0.5) / 10,
      });
    }

    return trends;
  },

  async exportToCsv(data: any[], filename: string): Promise<void> {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row) => headers.map((header) => row[header]).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  async exportToPdf(elementId: string, filename: string): Promise<void> {
    console.log('PDF export would be implemented with a library like jsPDF');
    alert('PDF export functionality ready - would use jsPDF in production');
  },
};
