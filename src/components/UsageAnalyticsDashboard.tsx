import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  Eye,
  MousePointer,
  Clock,
  Zap,
  Filter,
  Calendar,
  Download,
} from 'lucide-react';
import { usageAnalyticsService } from '../services/usageAnalyticsService';

export function UsageAnalyticsDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [deptMetrics, setDeptMetrics] = useState<any[]>([]);
  const [trendingPrompts, setTrendingPrompts] = useState<any[]>([]);
  const [featureUsage, setFeatureUsage] = useState<Record<string, number>>({});
  const [cohortData, setCohortData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [metricsData, deptData, trending, features, cohort] = await Promise.all([
        usageAnalyticsService.getUsageMetrics(startDate, endDate),
        usageAnalyticsService.getDepartmentMetrics(startDate, endDate),
        usageAnalyticsService.getMostUsedPrompts(10, days),
        usageAnalyticsService.getFeatureUsageBreakdown(days),
        usageAnalyticsService.getCohortAnalysis(startDate, endDate),
      ]);

      setMetrics(metricsData);
      setDeptMetrics(deptData);
      setTrendingPrompts(trending);
      setFeatureUsage(features);
      setCohortData(cohort);
    } finally {
      setLoading(false);
    }
  };

  const MetricCard = ({
    icon: Icon,
    label,
    value,
    change,
    color,
  }: {
    icon: any;
    label: string;
    value: string | number;
    change?: string;
    color: string;
  }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {change && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            {change}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Usage Analytics</h2>
          <p className="text-gray-600">Comprehensive tracking and insights</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={() => {}}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={Activity}
          label="Total Events"
          value={metrics?.totalEvents?.toLocaleString() || 0}
          change="+12%"
          color="bg-blue-500"
        />
        <MetricCard
          icon={Users}
          label="Unique Users"
          value={metrics?.uniqueUsers?.toLocaleString() || 0}
          change="+8%"
          color="bg-green-500"
        />
        <MetricCard
          icon={Eye}
          label="Prompt Views"
          value={metrics?.promptViews?.toLocaleString() || 0}
          change="+15%"
          color="bg-purple-500"
        />
        <MetricCard
          icon={MousePointer}
          label="Prompt Uses"
          value={metrics?.promptUses?.toLocaleString() || 0}
          change="+20%"
          color="bg-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Department Usage</h3>
              </div>
            </div>

            <div className="space-y-4">
              {deptMetrics.map((dept, idx) => {
                const maxEvents = Math.max(...deptMetrics.map((d) => d.totalEvents));
                const percentage = (dept.totalEvents / maxEvents) * 100;

                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{dept.department}</span>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{dept.uniqueUsers} users</span>
                        <span className="font-semibold text-gray-900">
                          {dept.totalEvents.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-semibold text-gray-900">Feature Usage</h3>
            </div>

            <div className="space-y-3">
              {Object.entries(featureUsage)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([feature, count]) => (
                  <div key={feature} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 truncate">{feature}</span>
                    <span className="text-sm font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {cohortData && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-semibold text-gray-900">Cohort Analysis</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{cohortData.totalUsers}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Today</p>
                  <p className="text-2xl font-bold text-green-600">{cohortData.activeToday}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Retention Rate</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {cohortData.retentionRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900">Trending Prompts</h3>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {trendingPrompts.map((prompt, idx) => (
            <div key={prompt.promptId} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                  {idx + 1}
                </div>

                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">{prompt.promptTitle}</h4>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {prompt.viewCount} views
                    </span>
                    <span className="flex items-center gap-1">
                      <MousePointer className="w-4 h-4" />
                      {prompt.useCount} uses
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {prompt.growthRate.toFixed(1)}/day
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{prompt.trendingScore}</p>
                  <p className="text-xs text-gray-600">score</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900">Additional Metrics</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Sandbox Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.sandboxSessions || 0}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Reviews Completed</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.reviewsCompleted || 0}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Avg Events/User</p>
              <p className="text-2xl font-bold text-gray-900">
                {cohortData ? cohortData.avgEventsPerUser : 0}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Usage Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {metrics?.promptUses && metrics?.promptViews
                  ? ((metrics.promptUses / metrics.promptViews) * 100).toFixed(1)
                  : 0}
                %
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-900">Quick Filters</h3>
          </div>

          <div className="space-y-2">
            <button className="w-full px-4 py-2 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <span className="text-sm text-gray-700">View by Department</span>
            </button>
            <button className="w-full px-4 py-2 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <span className="text-sm text-gray-700">View by Role</span>
            </button>
            <button className="w-full px-4 py-2 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <span className="text-sm text-gray-700">View by User</span>
            </button>
            <button className="w-full px-4 py-2 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <span className="text-sm text-gray-700">Custom Date Range</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
