import React, { useState, useEffect } from 'react';
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Info,
  Zap,
  Target,
  Users,
  Copy,
  Lightbulb,
  RefreshCw,
} from 'lucide-react';
import { aiInsightsService } from '../services/aiInsightsService';

export function AIInsightsDashboard() {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [filter, setFilter] = useState<{ category?: string; severity?: string }>({});

  useEffect(() => {
    loadInsights();
  }, [filter]);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const data = await aiInsightsService.getInsights(filter);
      setInsights(data);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await aiInsightsService.analyzeAndGenerateInsights();
      await loadInsights();
    } finally {
      setAnalyzing(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'medium':
        return <Info className="w-5 h-5 text-yellow-600" />;
      case 'low':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-50 border-red-200',
      high: 'bg-orange-50 border-orange-200',
      medium: 'bg-yellow-50 border-yellow-200',
      low: 'bg-blue-50 border-blue-200',
      info: 'bg-gray-50 border-gray-200',
    };

    return colors[severity] || colors.info;
  };

  const getInsightIcon = (type: string) => {
    const icons: Record<string, any> = {
      anomaly: AlertTriangle,
      pattern: TrendingUp,
      performance_alert: Target,
      gap_analysis: Zap,
      recommendation: Lightbulb,
      duplicate: Copy,
      optimization: TrendingUp,
      adoption: Users,
    };

    const Icon = icons[type] || Info;
    return <Icon className="w-5 h-5" />;
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      quality: 'bg-purple-100 text-purple-700',
      performance: 'bg-blue-100 text-blue-700',
      usage: 'bg-green-100 text-green-700',
      coverage: 'bg-orange-100 text-orange-700',
      efficiency: 'bg-indigo-100 text-indigo-700',
      engagement: 'bg-pink-100 text-pink-700',
    };

    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  const groupedInsights = insights.reduce((acc, insight) => {
    const category = insight.insightCategory;
    if (!acc[category]) acc[category] = [];
    acc[category].push(insight);
    return acc;
  }, {} as Record<string, any[]>);

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
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-7 h-7 text-blue-600" />
            AI Insights Engine
          </h2>
          <p className="text-gray-600">Intelligent analysis and actionable recommendations</p>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Insights', value: insights.length, icon: Brain, color: 'bg-blue-500' },
          {
            label: 'Critical',
            value: insights.filter((i) => i.severity === 'critical').length,
            icon: AlertTriangle,
            color: 'bg-red-500',
          },
          {
            label: 'High Priority',
            value: insights.filter((i) => i.priority >= 7).length,
            icon: Zap,
            color: 'bg-orange-500',
          },
          {
            label: 'Actionable',
            value: insights.filter((i) => i.recommendedAction).length,
            icon: CheckCircle,
            color: 'bg-green-500',
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-600">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Filter by:</span>

          <select
            value={filter.category || ''}
            onChange={(e) => setFilter({ ...filter, category: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            <option value="quality">Quality</option>
            <option value="performance">Performance</option>
            <option value="usage">Usage</option>
            <option value="coverage">Coverage</option>
            <option value="efficiency">Efficiency</option>
            <option value="engagement">Engagement</option>
          </select>

          <select
            value={filter.severity || ''}
            onChange={(e) => setFilter({ ...filter, severity: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>

          {(filter.category || filter.severity) && (
            <button
              onClick={() => setFilter({})}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {Object.entries(groupedInsights).map(([category, categoryInsights]) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 capitalize">{category} Insights</h3>
            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
              {categoryInsights.length}
            </span>
          </div>

          <div className="space-y-3">
            {categoryInsights.map((insight) => (
              <div
                key={insight.id}
                className={`border rounded-lg p-5 ${getSeverityColor(insight.severity)}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getSeverityIcon(insight.severity)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getInsightIcon(insight.insightType)}
                        <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${getCategoryBadgeColor(
                            insight.insightCategory
                          )}`}
                        >
                          {insight.insightCategory}
                        </span>
                        <span className="text-xs text-gray-600">P{insight.priority}</span>
                      </div>
                    </div>

                    <p className="text-gray-700 mb-3">{insight.description}</p>

                    {insight.recommendedAction && (
                      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          Recommended Action:
                        </p>
                        <p className="text-sm text-gray-700">{insight.recommendedAction}</p>

                        {insight.actionSteps && insight.actionSteps.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-gray-700 mb-1">Action Steps:</p>
                            <ul className="space-y-1">
                              {insight.actionSteps.map((step: string, idx: number) => (
                                <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                                  <span className="text-blue-600">•</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        Impact: {insight.impactScore}/100
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Confidence: {insight.confidenceScore}%
                      </span>
                      {insight.affectedPrompts && insight.affectedPrompts.length > 0 && (
                        <span>Affects {insight.affectedPrompts.length} prompt(s)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {insights.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Insights Available</h3>
          <p className="text-gray-600 mb-4">
            Run an analysis to generate AI-powered insights and recommendations
          </p>
          <button
            onClick={handleAnalyze}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Generate Insights
          </button>
        </div>
      )}
    </div>
  );
}
