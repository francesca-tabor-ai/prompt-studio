import { Lightbulb, CheckCircle, Sparkles } from 'lucide-react';
import { PromptSuggestion } from '../services/collaborationService';

interface AISuggestionPanelProps {
  suggestions: PromptSuggestion[];
  onApplySuggestion: (suggestionId: string) => void;
  onGenerateSuggestions: () => void;
}

export default function AISuggestionPanel({
  suggestions,
  onApplySuggestion,
  onGenerateSuggestions,
}: AISuggestionPanelProps) {
  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'clarity':
        return '💡';
      case 'structure':
        return '📋';
      case 'examples':
        return '📝';
      case 'tone':
        return '🎯';
      default:
        return '✨';
    }
  };

  const getSuggestionColor = (type: string) => {
    switch (type) {
      case 'clarity':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'structure':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'examples':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'tone':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-yellow to-jungle-green">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl text-white">AI SUGGESTIONS</h3>
              <p className="text-sm text-white/80">AI-powered refinement recommendations</p>
            </div>
          </div>
          {suggestions.length === 0 && (
            <button
              onClick={onGenerateSuggestions}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 font-medium flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Generate Suggestions
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {suggestions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-green-yellow/20 to-jungle-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lightbulb className="w-8 h-8 text-jungle-green" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">No Suggestions Yet</h4>
            <p className="text-sm text-gray-600 mb-4">
              Generate AI suggestions to refine and improve this prompt
            </p>
            <button
              onClick={onGenerateSuggestions}
              className="px-6 py-3 bg-gradient-to-r from-jungle-green to-light-sea-green hover:from-light-sea-green hover:to-jungle-green text-white rounded-lg transition-all duration-200 font-semibold flex items-center gap-2 shadow-md hover:shadow-lg mx-auto"
            >
              <Sparkles className="w-5 h-5" />
              Generate Now
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`rounded-lg p-4 border-2 transition-all duration-200 ${
                  suggestion.is_applied
                    ? 'bg-green-50 border-green-300'
                    : 'bg-white border-gray-200 hover:border-light-sea-green'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getSuggestionIcon(suggestion.suggestion_type)}</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold border ${getSuggestionColor(
                        suggestion.suggestion_type
                      )}`}
                    >
                      {suggestion.suggestion_type.toUpperCase()}
                    </span>
                  </div>
                  {suggestion.is_applied ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      Applied
                    </span>
                  ) : (
                    <button
                      onClick={() => onApplySuggestion(suggestion.id)}
                      className="px-3 py-1 bg-light-sea-green hover:bg-jungle-green text-white rounded-lg transition-all duration-200 text-xs font-medium"
                    >
                      Apply
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{suggestion.suggestion_text}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 bg-gradient-to-r from-light-sea-green/10 to-green-yellow/10 rounded-lg p-4 border border-light-sea-green/20">
          <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-jungle-green" />
            Suggestion Types
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
            <div className="flex items-center gap-2">
              <span>💡</span>
              <span>
                <strong>Clarity:</strong> Improve understanding
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>📋</span>
              <span>
                <strong>Structure:</strong> Enhance organization
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>📝</span>
              <span>
                <strong>Examples:</strong> Add use cases
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>🎯</span>
              <span>
                <strong>Tone:</strong> Adjust voice
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
