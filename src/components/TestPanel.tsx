import { Play, Copy, Check, Sparkles } from 'lucide-react';
import { useState } from 'react';

export interface TestResult {
  id: string;
  input: string;
  output: string;
  timestamp: Date;
  metrics: {
    accuracy: number;
    relevance: number;
    tone: number;
    consistency: number;
  };
}

interface TestPanelProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onRunTest: (testInput: string) => void;
  testResults: TestResult[];
  isRunning: boolean;
}

export default function TestPanel({ prompt, onPromptChange, onRunTest, testResults, isRunning }: TestPanelProps) {
  const [testInput, setTestInput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleRunTest = () => {
    if (testInput.trim() && prompt.trim()) {
      onRunTest(testInput);
      setTestInput('');
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const latestResult = testResults[0];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-jungle-green to-light-sea-green">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl text-white">TEST PROMPT</h3>
                <p className="text-sm text-white/80">Configure and test your prompt</p>
              </div>
            </div>
            <button
              onClick={handleCopyPrompt}
              className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium ${
                copied
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Prompt Template
            </label>
            <textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="Enter your prompt template here..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 resize-none text-sm font-mono"
              rows={6}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Test Input
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunTest()}
                placeholder="Enter test input or scenario..."
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 text-sm"
              />
              <button
                onClick={handleRunTest}
                disabled={!testInput.trim() || !prompt.trim() || isRunning}
                className="px-6 py-3 bg-gradient-to-r from-jungle-green to-light-sea-green hover:from-light-sea-green hover:to-jungle-green text-white rounded-lg transition-all duration-200 font-semibold flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunning ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Run Test
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {latestResult && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">AI-Generated Output</h3>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(latestResult.timestamp).toLocaleString()}
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">Input</p>
              <p className="text-sm text-gray-700">{latestResult.input}</p>
            </div>

            <div className="bg-gradient-to-r from-light-sea-green/5 to-jungle-green/5 rounded-lg p-4 border border-light-sea-green/20">
              <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">Output</p>
              <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                {latestResult.output}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
