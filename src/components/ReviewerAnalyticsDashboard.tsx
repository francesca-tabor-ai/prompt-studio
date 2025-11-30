import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Award,
  Activity,
  Users,
  BarChart3,
} from 'lucide-react';
import { reviewerAssignmentService } from '../services/reviewerAssignmentService';
import { reminderEscalationService } from '../services/reminderEscalationService';

export function ReviewerAnalyticsDashboard() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReviewer, setSelectedReviewer] = useState<string | null>(null);
  const [workloadHistory, setWorkloadHistory] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedReviewer) {
      loadWorkloadHistory(selectedReviewer);
    }
  }, [selectedReviewer]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsData, escalationsData] = await Promise.all([
        reviewerAssignmentService.getAllReviewerMetrics(),
        reminderEscalationService.getActiveEscalations(),
      ]);

      setMetrics(metricsData);
      setEscalations(escalationsData);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkloadHistory = async (reviewerId: string) => {
    const history = await reviewerAssignmentService.getWorkloadSnapshot(reviewerId);
    setWorkloadHistory(history);
  };

  const handleBalanceWorkload = async () => {
    if (!confirm('Balance workload across all reviewers? This may reassign some reviews.')) return;

    const result = await reviewerAssignmentService.balanceWorkload();
    if (result.success) {
      alert(`Successfully rebalanced ${result.rebalanced} assignments`);
      await loadData();
    }
  };

  const handleProcessReminders = async () => {
    if (!confirm('Send reminders for all overdue reviews?')) return;

    const result = await reminderEscalationService.checkAndProcessReminders();
    alert(`Sent ${result.sent} reminders and escalated ${result.escalated} reviews`);
  };

  const getPerformanceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceBadge = (rate: number) => {
    if (rate >= 90) return { color: 'bg-green-100 text-green-700', label: 'Excellent' };
    if (rate >= 70) return { color: 'bg-yellow-100 text-yellow-700', label: 'Good' };
    return { color: 'bg-red-100 text-red-700', label: 'Needs Attention' };
  };

  const StatCard = ({
    icon: Icon,
    label,
    value,
    color,
    subtitle,
  }: {
    icon: any;
    label: string;
    value: string | number;
    color: string;
    subtitle?: string;
  }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-600">{label}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totalReviewers = metrics.length;
  const avgCompletionRate = metrics.reduce((acc, m) => acc + m.completionRate, 0) / totalReviewers || 0;
  const totalPending = metrics.reduce((acc, m) => acc + m.pendingReviews, 0);
  const totalOverdue = metrics.reduce((acc, m) => acc + m.overdueCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reviewer Analytics</h2>
          <p className="text-gray-600">Performance metrics and workload management</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleProcessReminders}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Clock className="w-4 h-4 inline mr-2" />
            Process Reminders
          </button>
          <button
            onClick={handleBalanceWorkload}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Activity className="w-4 h-4 inline mr-2" />
            Balance Workload
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          icon={Users}
          label="Active Reviewers"
          value={totalReviewers}
          color="bg-blue-500"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Completion Rate"
          value={`${avgCompletionRate.toFixed(0)}%`}
          color="bg-green-500"
        />
        <StatCard
          icon={Clock}
          label="Pending Reviews"
          value={totalPending}
          color="bg-orange-500"
          subtitle="Across all reviewers"
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue Reviews"
          value={totalOverdue}
          color="bg-red-500"
          subtitle={`${escalations.length} escalations active`}
        />
      </div>

      {escalations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-900">Active Escalations</h3>
          </div>

          <div className="space-y-3">
            {escalations.slice(0, 5).map((escalation) => (
              <div
                key={escalation.id}
                className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {escalation.prompt_submissions?.title}
                    </span>
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                      Level {escalation.escalation_level}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Reviewer: {escalation.submission_reviewer_assignments?.reviewer_email} •
                    {Math.round(escalation.hours_overdue)}h overdue
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Reviewer Performance</h3>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {metrics.map((reviewer) => {
            const badge = getPerformanceBadge(reviewer.completionRate);
            const isSelected = selectedReviewer === reviewer.reviewerId;

            return (
              <div
                key={reviewer.reviewerId}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() =>
                  setSelectedReviewer(isSelected ? null : reviewer.reviewerId)
                }
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{reviewer.reviewerEmail}</span>
                      <span className={`text-xs px-2 py-1 rounded ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <p className={`font-bold ${getPerformanceColor(reviewer.completionRate)}`}>
                        {reviewer.completionRate.toFixed(0)}%
                      </p>
                      <p className="text-xs text-gray-600">Completion</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-gray-900">{reviewer.pendingReviews}</p>
                      <p className="text-xs text-gray-600">Pending</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-gray-900">
                        {reviewer.averageCompletionTime.toFixed(0)}h
                      </p>
                      <p className="text-xs text-gray-600">Avg Time</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Total</p>
                    <p className="font-medium">{reviewer.totalAssignments}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Completed</p>
                    <p className="font-medium text-green-600">{reviewer.completedReviews}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Pending</p>
                    <p className="font-medium text-orange-600">{reviewer.pendingReviews}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Response Time</p>
                    <p className="font-medium">{reviewer.averageResponseTime.toFixed(0)}h</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Overdue</p>
                    <p className={`font-medium ${reviewer.overdueCount > 0 ? 'text-red-600' : ''}`}>
                      {reviewer.overdueCount}
                    </p>
                  </div>
                </div>

                {isSelected && workloadHistory.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Workload History (Last 7 Days)</h4>
                    <div className="flex items-end gap-2 h-24">
                      {workloadHistory.slice(0, 7).reverse().map((snapshot, idx) => {
                        const height = (snapshot.active_assignments / 10) * 100;
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center">
                            <div
                              className="w-full bg-blue-500 rounded-t"
                              style={{ height: `${Math.min(height, 100)}%` }}
                            />
                            <p className="text-xs text-gray-600 mt-1">
                              {new Date(snapshot.snapshot_date).toLocaleDateString('en-US', { weekday: 'short' })}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
