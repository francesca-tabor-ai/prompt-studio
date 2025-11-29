import { TrendingUp, TrendingDown, Target, MessageSquare, Gauge, CheckCircle2 } from 'lucide-react';

interface MetricsDashboardProps {
  metrics: {
    accuracy: number;
    relevance: number;
    tone: number;
    consistency: number;
  };
  previousMetrics?: {
    accuracy: number;
    relevance: number;
    tone: number;
    consistency: number;
  };
}

export default function MetricsDashboard({ metrics, previousMetrics }: MetricsDashboardProps) {
  const getPerformanceLevel = (score: number): { label: string; color: string; bgColor: string } => {
    if (score >= 90) return { label: 'Excellent', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (score >= 75) return { label: 'Good', color: 'text-jungle-green', bgColor: 'bg-jungle-green/10' };
    if (score >= 60) return { label: 'Fair', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    return { label: 'Needs Work', color: 'text-red-600', bgColor: 'bg-red-100' };
  };

  const getChange = (current: number, previous?: number) => {
    if (!previous) return null;
    return current - previous;
  };

  const metricConfigs = [
    {
      key: 'accuracy' as const,
      label: 'Accuracy',
      icon: Target,
      description: 'Correctness of responses',
    },
    {
      key: 'relevance' as const,
      label: 'Relevance',
      icon: CheckCircle2,
      description: 'Alignment with context',
    },
    {
      key: 'tone' as const,
      label: 'Tone',
      icon: MessageSquare,
      description: 'Communication style match',
    },
    {
      key: 'consistency' as const,
      label: 'Consistency',
      icon: Gauge,
      description: 'Output uniformity',
    },
  ];

  const overallScore = Math.round(
    (metrics.accuracy + metrics.relevance + metrics.tone + metrics.consistency) / 4
  );
  const overallPerformance = getPerformanceLevel(overallScore);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-space-cadet to-yale-blue">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl text-white">METRICS DASHBOARD</h3>
            <p className="text-sm text-white/80">Real-time performance analysis</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{overallScore}%</div>
            <div className={`text-xs font-semibold px-3 py-1 rounded-full inline-block mt-1 ${overallPerformance.bgColor} ${overallPerformance.color}`}>
              {overallPerformance.label}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 gap-4">
          {metricConfigs.map((config) => {
            const score = metrics[config.key];
            const change = getChange(score, previousMetrics?.[config.key]);
            const performance = getPerformanceLevel(score);
            const Icon = config.icon;

            return (
              <div
                key={config.key}
                className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-light-sea-green transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-jungle-green to-light-sea-green rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  {change !== null && (
                    <div className={`flex items-center gap-1 text-xs font-semibold ${
                      change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {change > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : change < 0 ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : null}
                      {change > 0 ? '+' : ''}{change}%
                    </div>
                  )}
                </div>

                <h4 className="text-sm font-semibold text-gray-900 mb-1">{config.label}</h4>
                <p className="text-xs text-gray-600 mb-3">{config.description}</p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-gray-900">{score}%</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${performance.bgColor} ${performance.color}`}>
                      {performance.label}
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-jungle-green to-light-sea-green rounded-full transition-all duration-500"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-gradient-to-r from-light-sea-green/10 to-green-yellow/10 rounded-lg border border-light-sea-green/20">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-light-sea-green rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Performance Insights</h4>
              <p className="text-sm text-gray-700">
                {overallScore >= 90 && 'Outstanding performance! Your prompt is delivering excellent results across all metrics.'}
                {overallScore >= 75 && overallScore < 90 && 'Good performance overall. Consider refining areas below 80% for optimal results.'}
                {overallScore >= 60 && overallScore < 75 && 'Fair performance. Focus on improving lower-scoring metrics through prompt refinement.'}
                {overallScore < 60 && 'Performance needs improvement. Review test outputs and adjust prompt structure, tone, or constraints.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
