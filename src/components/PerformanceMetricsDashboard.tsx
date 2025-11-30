import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Star,
  CheckCircle,
  Clock,
  DollarSign,
  AlertTriangle,
  Target,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import { performanceMetricsService } from '../services/performanceMetricsService';

export function PerformanceMetricsDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [accuracyByPrompt, setAccuracyByPrompt] = useState<any[]>([]);
  const [satisfactionTrend, setSatisfactionTrend] = useState<any[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadMetrics();
  }, [period]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const currentEnd = new Date();
      const currentStart = new Date();
      currentStart.setDate(currentStart.getDate() - days);

      const previousEnd = new Date(currentStart);
      const previousStart = new Date(previousEnd);
      previousStart.setDate(previousStart.getDate() - days);

      const [metricsData, comparisonData, accuracy, satisfaction, cost] = await Promise.all([
        performanceMetricsService.getPerformanceMetrics(currentStart, currentEnd),
        performanceMetricsService.compareTimePeriods(
          currentStart,
          currentEnd,
          previousStart,
          previousEnd
        ),
        performanceMetricsService.getAccuracyByPrompt(10),
        performanceMetricsService.getSatisfactionTrend(days),
        performanceMetricsService.getCostBreakdown(currentStart, currentEnd),
      ]);

      setMetrics(metricsData);
      setComparison(comparisonData);
      setAccuracyByPrompt(accuracy);
      setSatisfactionTrend(satisfaction);
      setCostBreakdown(cost);
    } finally {
      setLoading(false);
    }
  };

  const MetricCard = ({
    icon: Icon,
    label,
    value,
    change,
    unit,
    color,
  }: {
    icon: any;
    label: string;
    value: number;
    change?: number;
    unit?: string;
    color: string;
  }) => {
    const isPositive = change && change > 0;
    const isNegative = change && change < 0;

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {change !== undefined && (
            <div
              className={`flex items-center gap-1 text-sm font-medium ${
                isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : isNegative ? (
                <TrendingDown className="w-4 h-4" />
              ) : null}
              {Math.abs(change).toFixed(1)}%
            </div>
          )}
        </div>
        <p className="text-3xl font-bold text-gray-900 mb-1">
          {value.toFixed(1)}
          {unit && <span className="text-lg text-gray-600 ml-1">{unit}</span>}
        </p>
        <p className="text-sm text-gray-600">{label}</p>
      </div>
    );
  };

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
          <h2 className="text-2xl font-bold text-gray-900">Performance Metrics</h2>
          <p className="text-gray-600">Real-time tracking and analysis</p>
        </div>

        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                period === p ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={Target}
          label="AI Accuracy Score"
          value={metrics?.avgAiAccuracy || 0}
          change={comparison?.percentChange.avgAiAccuracy}
          unit="/5"
          color="bg-blue-500"
        />
        <MetricCard
          icon={Star}
          label="User Satisfaction"
          value={metrics?.avgSatisfactionRating || 0}
          change={comparison?.percentChange.avgSatisfactionRating}
          unit="/5"
          color="bg-yellow-500"
        />
        <MetricCard
          icon={CheckCircle}
          label="Sandbox Success Rate"
          value={metrics?.sandboxSuccessRate || 0}
          change={comparison?.percentChange.sandboxSuccessRate}
          unit="%"
          color="bg-green-500"
        />
        <MetricCard
          icon={Clock}
          label="Avg Time to Approval"
          value={metrics?.avgTimeToApprovalHours || 0}
          change={comparison?.percentChange.avgTimeToApprovalHours}
          unit="hrs"
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={TrendingUp}
          label="Utilization Rate"
          value={metrics?.utilizationRate || 0}
          change={comparison?.percentChange.utilizationRate}
          unit="%"
          color="bg-indigo-500"
        />
        <MetricCard
          icon={DollarSign}
          label="Total Cost"
          value={metrics?.totalCostUsd || 0}
          change={comparison?.percentChange.totalCostUsd}
          unit="USD"
          color="bg-orange-500"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Revision Frequency"
          value={metrics?.revisionFrequency || 0}
          change={comparison?.percentChange.revisionFrequency}
          color="bg-red-500"
        />
        <MetricCard
          icon={Star}
          label="Quality Score"
          value={metrics?.avgClarityScore || 0}
          change={comparison?.percentChange.avgClarityScore}
          unit="/5"
          color="bg-teal-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Top Performing Prompts</h3>
          </div>

          <div className="space-y-4">
            {accuracyByPrompt.slice(0, 5).map((prompt, idx) => (
              <div key={prompt.promptId} className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      Prompt #{prompt.promptId.slice(0, 8)}
                    </p>
                    <span className="text-sm font-bold text-blue-600">
                      {prompt.accuracyScore.toFixed(2)}/5
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>Clarity: {prompt.clarityScore.toFixed(1)}</span>
                    <span>Usefulness: {prompt.usefulnessScore.toFixed(1)}</span>
                    <span>{prompt.sampleSize} tests</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-5 h-5 text-yellow-500" />
            <h3 className="text-lg font-semibold text-gray-900">Satisfaction Trend</h3>
          </div>

          <div className="space-y-3">
            {satisfactionTrend.slice(-7).map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-20">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>

                <div className="flex-1">
                  <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 flex items-center justify-end pr-2"
                      style={{ width: `${(day.avgRating / 5) * 100}%` }}
                    >
                      <span className="text-xs font-medium text-white">
                        {day.avgRating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                <span className="text-xs text-gray-600 w-16 text-right">
                  {day.totalRatings} ratings
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {costBreakdown && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-orange-500" />
              <h3 className="text-lg font-semibold text-gray-900">Cost Overview</h3>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Spend</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${costBreakdown.totalCost.toFixed(2)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Calls</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {costBreakdown.totalCalls.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Tokens</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {(costBreakdown.totalTokens / 1000000).toFixed(2)}M
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Cost by Department</h3>
            </div>

            <div className="space-y-3">
              {Object.entries(costBreakdown.costByDepartment)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 5)
                .map(([dept, cost]) => (
                  <div key={dept} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{dept}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      ${(cost as number).toFixed(2)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Cost by Model</h3>
            </div>

            <div className="space-y-3">
              {Object.entries(costBreakdown.costByModel)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([model, cost]) => (
                  <div key={model} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{model}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      ${(cost as number).toFixed(2)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Period Comparison</h3>
            <p className="text-sm text-gray-600">
              Comparing current {period} to previous {period}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <ArrowRight className="w-5 h-5 text-blue-600" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {comparison && (
            <>
              <div className="bg-white rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">Accuracy</p>
                <p className="text-lg font-bold text-gray-900">
                  {comparison.current.avgAiAccuracy.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">
                  vs {comparison.previous.avgAiAccuracy.toFixed(2)}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">Satisfaction</p>
                <p className="text-lg font-bold text-gray-900">
                  {comparison.current.avgSatisfactionRating.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">
                  vs {comparison.previous.avgSatisfactionRating.toFixed(2)}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">Success Rate</p>
                <p className="text-lg font-bold text-gray-900">
                  {comparison.current.sandboxSuccessRate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">
                  vs {comparison.previous.sandboxSuccessRate.toFixed(1)}%
                </p>
              </div>

              <div className="bg-white rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">Approval Time</p>
                <p className="text-lg font-bold text-gray-900">
                  {comparison.current.avgTimeToApprovalHours.toFixed(1)}h
                </p>
                <p className="text-xs text-gray-500">
                  vs {comparison.previous.avgTimeToApprovalHours.toFixed(1)}h
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
