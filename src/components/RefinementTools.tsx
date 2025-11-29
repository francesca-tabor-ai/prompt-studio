import { Settings2, Plus, X } from 'lucide-react';
import { useState } from 'react';

export interface RefinementConfig {
  toneLevel: number;
  complexity: 'basic' | 'intermediate' | 'advanced';
  includeKeywords: string[];
  excludeKeywords: string[];
}

interface RefinementToolsProps {
  config: RefinementConfig;
  onChange: (config: RefinementConfig) => void;
  onApply: () => void;
  disabled: boolean;
}

export default function RefinementTools({ config, onChange, onApply, disabled }: RefinementToolsProps) {
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');

  const getToneLabel = (level: number) => {
    if (level <= 20) return 'Very Formal';
    if (level <= 40) return 'Formal';
    if (level <= 60) return 'Balanced';
    if (level <= 80) return 'Casual';
    return 'Very Casual';
  };

  const addKeyword = (type: 'include' | 'exclude') => {
    const input = type === 'include' ? includeInput : excludeInput;
    const trimmed = input.trim();

    if (!trimmed) return;

    if (type === 'include') {
      if (!config.includeKeywords.includes(trimmed)) {
        onChange({ ...config, includeKeywords: [...config.includeKeywords, trimmed] });
      }
      setIncludeInput('');
    } else {
      if (!config.excludeKeywords.includes(trimmed)) {
        onChange({ ...config, excludeKeywords: [...config.excludeKeywords, trimmed] });
      }
      setExcludeInput('');
    }
  };

  const removeKeyword = (type: 'include' | 'exclude', keyword: string) => {
    if (type === 'include') {
      onChange({ ...config, includeKeywords: config.includeKeywords.filter(k => k !== keyword) });
    } else {
      onChange({ ...config, excludeKeywords: config.excludeKeywords.filter(k => k !== keyword) });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-light-sea-green to-jungle-green">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl text-white">REFINEMENT TOOLS</h2>
            <p className="text-sm text-white/80">Fine-tune your prompts</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-gray-700">
              Tone
            </label>
            <span className="text-sm font-bold text-light-sea-green">
              {getToneLabel(config.toneLevel)}
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="100"
              value={config.toneLevel}
              onChange={(e) => onChange({ ...config, toneLevel: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-light-sea-green"
              disabled={disabled}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>Formal</span>
              <span>Casual</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Complexity
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['basic', 'intermediate', 'advanced'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onChange({ ...config, complexity: level })}
                disabled={disabled}
                className={`py-2.5 px-4 rounded-lg border-2 transition-all duration-200 text-sm font-medium capitalize ${
                  config.complexity === level
                    ? 'bg-light-sea-green text-white border-light-sea-green'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-light-sea-green disabled:opacity-50'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Include Keywords
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={includeInput}
              onChange={(e) => setIncludeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword('include'))}
              placeholder="Add keyword to include..."
              disabled={disabled}
              className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 text-sm disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => addKeyword('include')}
              disabled={disabled || !includeInput.trim()}
              className="py-2 px-4 bg-light-sea-green hover:bg-jungle-green text-white rounded-lg transition-all duration-200 font-medium text-sm flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.includeKeywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium"
              >
                {keyword}
                <button
                  onClick={() => removeKeyword('include', keyword)}
                  disabled={disabled}
                  className="hover:text-green-900 disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {config.includeKeywords.length === 0 && (
              <span className="text-xs text-gray-400 italic">No keywords added</span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Exclude Keywords
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={excludeInput}
              onChange={(e) => setExcludeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword('exclude'))}
              placeholder="Add keyword to exclude..."
              disabled={disabled}
              className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 text-sm disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => addKeyword('exclude')}
              disabled={disabled || !excludeInput.trim()}
              className="py-2 px-4 bg-light-sea-green hover:bg-jungle-green text-white rounded-lg transition-all duration-200 font-medium text-sm flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.excludeKeywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium"
              >
                {keyword}
                <button
                  onClick={() => removeKeyword('exclude', keyword)}
                  disabled={disabled}
                  className="hover:text-red-900 disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {config.excludeKeywords.length === 0 && (
              <span className="text-xs text-gray-400 italic">No keywords added</span>
            )}
          </div>
        </div>

        <button
          onClick={onApply}
          disabled={disabled}
          className="w-full py-3 px-6 bg-gradient-to-r from-light-sea-green to-jungle-green hover:from-jungle-green hover:to-light-sea-green text-white rounded-lg transition-all duration-200 font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply Refinements
        </button>
      </div>
    </div>
  );
}
