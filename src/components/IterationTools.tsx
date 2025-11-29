import { RefreshCw, Save, Send, History, Lightbulb } from 'lucide-react';
import { useState } from 'react';

interface IterationToolsProps {
  onTweakPrompt: (suggestion: string) => void;
  onRerunTests: () => void;
  onSaveVersion: () => void;
  onSubmitRefined: () => void;
  hasTests: boolean;
  isRunning: boolean;
  versionCount: number;
}

export default function IterationTools({
  onTweakPrompt,
  onRerunTests,
  onSaveVersion,
  onSubmitRefined,
  hasTests,
  isRunning,
  versionCount,
}: IterationToolsProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = [
    'Add more specific context about the target audience',
    'Include examples of desired output format',
    'Specify tone more explicitly (e.g., professional, friendly)',
    'Add constraints for response length',
    'Include error handling instructions',
    'Request step-by-step reasoning in outputs',
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Iteration Tools</h3>
              <p className="text-sm text-gray-600">Refine and optimize your prompt</p>
            </div>
            {versionCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <History className="w-4 h-4" />
                <span className="font-medium">{versionCount} version{versionCount !== 1 ? 's' : ''} saved</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 space-y-3">
          <button
            onClick={onRerunTests}
            disabled={!hasTests || isRunning}
            className="w-full py-3 px-4 bg-gradient-to-r from-jungle-green to-light-sea-green hover:from-light-sea-green hover:to-jungle-green text-white rounded-lg transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Rerun All Tests
              </>
            )}
          </button>

          <button
            onClick={onSaveVersion}
            disabled={!hasTests}
            className="w-full py-3 px-4 bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-200 hover:border-light-sea-green rounded-lg transition-all duration-200 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            Save Version
          </button>

          <button
            onClick={onSubmitRefined}
            disabled={!hasTests}
            className="w-full py-3 px-4 bg-gradient-to-r from-space-cadet to-yale-blue hover:from-yale-blue hover:to-space-cadet text-white rounded-lg transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
            Submit Refined Prompt
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button
          onClick={() => setShowSuggestions(!showSuggestions)}
          className="w-full p-6 flex items-center justify-between text-left hover:bg-gray-50 transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-yellow to-jungle-green rounded-lg flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">AI Suggestions</h3>
              <p className="text-sm text-gray-600">Get tips to improve your prompt</p>
            </div>
          </div>
          <div className={`transform transition-transform duration-200 ${showSuggestions ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {showSuggestions && (
          <div className="px-6 pb-6 space-y-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onTweakPrompt(suggestion)}
                className="w-full text-left p-4 bg-gradient-to-r from-light-sea-green/5 to-green-yellow/5 hover:from-light-sea-green/10 hover:to-green-yellow/10 border border-gray-200 hover:border-light-sea-green rounded-lg transition-all duration-200 group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-light-sea-green rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-white">{index + 1}</span>
                  </div>
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium">
                    {suggestion}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-space-cadet/5 to-yale-blue/5 rounded-xl border border-space-cadet/20 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Quick Tips</h4>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-light-sea-green font-bold">•</span>
            <span>Test with diverse inputs to ensure consistency</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-light-sea-green font-bold">•</span>
            <span>Save versions before major changes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-light-sea-green font-bold">•</span>
            <span>Focus on metrics below 75% first</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
