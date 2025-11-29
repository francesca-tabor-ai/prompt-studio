import { Check, Copy, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

export interface CandidatePrompt {
  id: string;
  content: string;
  title: string;
  estimatedTokens: number;
  isSelected: boolean;
}

interface CandidatePromptCardProps {
  prompt: CandidatePrompt;
  onSelect: () => void;
  onCopy: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}

export default function CandidatePromptCard({
  prompt,
  onSelect,
  onCopy,
  onRegenerate,
  onDelete,
}: CandidatePromptCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`bg-white rounded-xl border-2 transition-all duration-300 ${
        prompt.isSelected
          ? 'border-light-sea-green shadow-lg shadow-light-sea-green/20'
          : 'border-gray-200 hover:border-light-sea-green/50 shadow-sm hover:shadow-md'
      }`}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-bold text-gray-900">{prompt.title}</h3>
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                ~{prompt.estimatedTokens} tokens
              </span>
            </div>
          </div>
          <button
            onClick={onSelect}
            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
              prompt.isSelected
                ? 'bg-light-sea-green border-light-sea-green'
                : 'border-gray-300 hover:border-light-sea-green'
            }`}
          >
            {prompt.isSelected && <Check className="w-4 h-4 text-white" />}
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-mono">
            {prompt.content}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={`flex-1 py-2.5 px-4 rounded-lg border-2 transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2 ${
              copied
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-white border-gray-200 text-gray-700 hover:border-light-sea-green hover:text-light-sea-green'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>
          <button
            onClick={onRegenerate}
            className="py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-200 hover:border-light-sea-green rounded-lg transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refine
          </button>
          <button
            onClick={onDelete}
            className="py-2.5 px-4 bg-white hover:bg-red-50 text-gray-700 hover:text-red-600 border-2 border-gray-200 hover:border-red-200 rounded-lg transition-all duration-200 font-medium text-sm flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
