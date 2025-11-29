import { TrendingUp, Clock, Eye, MoreVertical } from 'lucide-react';

interface PromptCardProps {
  title: string;
  description: string;
  category: string;
  accuracy: number;
  relevance: number;
  usage: number;
  lastUpdated: string;
  status: 'high' | 'medium' | 'low';
}

export default function PromptCard({
  title,
  description,
  category,
  accuracy,
  relevance,
  usage,
  lastUpdated,
  status,
}: PromptCardProps) {
  const statusColors = {
    high: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-red-100 text-red-700 border-red-200',
  };

  const statusDots = {
    high: 'bg-green-500',
    medium: 'bg-yellow-500',
    low: 'bg-red-500',
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg hover:border-light-sea-green transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <span className={`w-2 h-2 rounded-full ${statusDots[status]}`}></span>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">{description}</p>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200">
          <MoreVertical className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-medium px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
          {category}
        </span>
        <span className={`text-xs font-medium px-3 py-1 rounded-full border ${statusColors[status]}`}>
          {status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-100">
        <MetricBadge label="Accuracy" value={accuracy} />
        <MetricBadge label="Relevance" value={relevance} />
        <MetricBadge label="Usage" value={usage} icon={<TrendingUp className="w-3 h-3" />} />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Updated {lastUpdated}</span>
        </div>
        <button className="flex items-center gap-1 text-light-sea-green hover:text-jungle-green font-medium transition-colors duration-200">
          <Eye className="w-3 h-3" />
          <span>View Details</span>
        </button>
      </div>
    </div>
  );
}

interface MetricBadgeProps {
  label: string;
  value: number;
  icon?: React.ReactNode;
}

function MetricBadge({ label, value, icon }: MetricBadgeProps) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 mb-1">
        <span className="text-2xl font-bold text-gray-900">{value}%</span>
        {icon && <span className="text-jungle-green">{icon}</span>}
      </div>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}
