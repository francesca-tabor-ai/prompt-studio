import { Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';

interface PromptInputPanelProps {
  onGenerate: (config: PromptConfig) => void;
  isGenerating: boolean;
}

export interface PromptConfig {
  workflow: string;
  tone: string;
  style: string;
  length: string;
  constraints: string;
}

export default function PromptInputPanel({ onGenerate, isGenerating }: PromptInputPanelProps) {
  const [config, setConfig] = useState<PromptConfig>({
    workflow: '',
    tone: 'Professional',
    style: 'Conversational',
    length: 'Medium',
    constraints: '',
  });

  const tones = ['Formal', 'Professional', 'Casual', 'Friendly', 'Technical'];
  const styles = ['Conversational', 'Instructional', 'Analytical', 'Creative', 'Direct'];
  const lengths = ['Short', 'Medium', 'Long', 'Very Long'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (config.workflow.trim()) {
      onGenerate(config);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-space-cadet to-yale-blue">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-green-yellow" />
          </div>
          <div>
            <h2 className="text-xl text-white">PROMPT INPUT</h2>
            <p className="text-sm text-white/80">Describe what you need</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Workflow Description *
          </label>
          <textarea
            value={config.workflow}
            onChange={(e) => setConfig({ ...config, workflow: e.target.value })}
            placeholder="Describe the workflow, task, or use case for this prompt. Example: 'Create a prompt to help customer support agents handle billing inquiries with empathy and efficiency'"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 resize-none text-sm"
            rows={4}
            required
          />
          <p className="text-xs text-gray-500 mt-1">Be specific about the goal and context</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tone
            </label>
            <select
              value={config.tone}
              onChange={(e) => setConfig({ ...config, tone: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 text-sm"
            >
              {tones.map((tone) => (
                <option key={tone} value={tone}>
                  {tone}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Style
            </label>
            <select
              value={config.style}
              onChange={(e) => setConfig({ ...config, style: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 text-sm"
            >
              {styles.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Length
          </label>
          <div className="flex gap-2">
            {lengths.map((length) => (
              <button
                key={length}
                type="button"
                onClick={() => setConfig({ ...config, length })}
                className={`flex-1 py-2.5 px-4 rounded-lg border-2 transition-all duration-200 text-sm font-medium ${
                  config.length === length
                    ? 'bg-light-sea-green text-white border-light-sea-green'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-light-sea-green'
                }`}
              >
                {length}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Constraints (Optional)
          </label>
          <textarea
            value={config.constraints}
            onChange={(e) => setConfig({ ...config, constraints: e.target.value })}
            placeholder="Any specific requirements, limitations, or rules to follow. Example: 'Must include greeting, keep under 500 characters, avoid technical jargon'"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 resize-none text-sm"
            rows={3}
          />
        </div>

        <button
          type="submit"
          disabled={!config.workflow.trim() || isGenerating}
          className="w-full py-3.5 px-6 bg-gradient-to-r from-jungle-green to-light-sea-green hover:from-light-sea-green hover:to-jungle-green text-white rounded-lg transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating Prompts...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Generate AI Prompts
            </>
          )}
        </button>
      </form>
    </div>
  );
}
