import { Eye, FlaskConical, MessageSquare, MoreVertical, Clock, Target, TrendingUp } from 'lucide-react';

export interface Prompt {
  id: string;
  title: string;
  description: string;
  role: string;
  department: string;
  workflow: string;
  prompt_type: string;
  status: string;
  accuracy_score: number;
  relevance_score: number;
  usage_count: number;
  updated_at: string;
  tags: string[];
}

interface PromptListItemProps {
  prompt: Prompt;
  onView: () => void;
  onTest: () => void;
  onFeedback: () => void;
}

export default function PromptListItem({ prompt, onView, onTest, onFeedback }: PromptListItemProps) {
  const statusColors: Record<string, string> = {
    Active: 'bg-green-100 text-green-700 border-green-200',
    Draft: 'bg-gray-100 text-gray-700 border-gray-200',
    'Under Review': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Archived: 'bg-red-100 text-red-700 border-red-200',
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-light-sea-green transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-light-sea-green transition-colors duration-200">
              {prompt.title}
            </h3>
            <span className={`text-xs font-medium px-2 py-1 rounded-full border ${statusColors[prompt.status]}`}>
              {prompt.status}
            </span>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{prompt.description}</p>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2.5 py-1 bg-space-cadet/10 text-space-cadet rounded-full font-medium">
              {prompt.role}
            </span>
            <span className="text-xs px-2.5 py-1 bg-jungle-green/10 text-jungle-green rounded-full font-medium">
              {prompt.department}
            </span>
            <span className="text-xs px-2.5 py-1 bg-light-sea-green/10 text-light-sea-green rounded-full font-medium">
              {prompt.workflow}
            </span>
            <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">
              {prompt.prompt_type}
            </span>
          </div>
        </div>

        <button className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100">
          <MoreVertical className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="flex items-center justify-between py-4 border-t border-b border-gray-100">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">Accuracy</span>
            <span className={`text-sm font-bold ${getPerformanceColor(prompt.accuracy_score)}`}>
              {prompt.accuracy_score}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">Relevance</span>
            <span className={`text-sm font-bold ${getPerformanceColor(prompt.relevance_score)}`}>
              {prompt.relevance_score}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">Usage</span>
            <span className="text-sm font-bold text-gray-900">{prompt.usage_count}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{formatDate(prompt.updated_at)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={onView}
          className="flex-1 py-2.5 px-4 bg-light-sea-green hover:bg-jungle-green text-white rounded-lg transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2"
        >
          <Eye className="w-4 h-4" />
          View/Edit
        </button>
        <button
          onClick={onTest}
          className="flex-1 py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-light-sea-green rounded-lg transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2"
        >
          <FlaskConical className="w-4 h-4" />
          Test
        </button>
        <button
          onClick={onFeedback}
          className="flex-1 py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-light-sea-green rounded-lg transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          Feedback
        </button>
      </div>
    </div>
  );
}
