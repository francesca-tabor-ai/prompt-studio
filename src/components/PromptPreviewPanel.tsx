import { Sparkles, Copy, Check, Save } from 'lucide-react';
import { useState } from 'react';
import { Task } from '../services/enterpriseService';

interface GeneratedPrompt {
  taskId: string;
  department: string;
  team: string;
  role: string;
  taskName: string;
  prompt: string;
}

interface PromptPreviewPanelProps {
  tasks: Task[];
  generatedPrompts: GeneratedPrompt[];
  onGeneratePrompts: () => void;
  onSaveToLibrary: () => void;
}

export default function PromptPreviewPanel({
  tasks,
  generatedPrompts,
  onGeneratePrompts,
  onSaveToLibrary,
}: PromptPreviewPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (prompt: string, id: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-yale-blue to-space-cadet">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl text-white">PROMPT PREVIEW</h3>
              <p className="text-sm text-white/80">
                {generatedPrompts.length} prompts generated from {tasks.length} tasks
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {tasks.length > 0 && generatedPrompts.length === 0 && (
              <button
                onClick={onGeneratePrompts}
                className="px-4 py-2 bg-gradient-to-r from-green-yellow to-jungle-green hover:from-jungle-green hover:to-light-sea-green text-white rounded-lg transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                Generate All Prompts
              </button>
            )}
            {generatedPrompts.length > 0 && (
              <button
                onClick={onSaveToLibrary}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 font-medium flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save All to Library
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {generatedPrompts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-green-yellow/20 to-jungle-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-jungle-green" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">No Prompts Generated</h4>
            <p className="text-sm text-gray-600 mb-4">
              Generate AI prompts from your defined tasks to get started
            </p>
            {tasks.length > 0 && (
              <button
                onClick={onGeneratePrompts}
                className="px-6 py-3 bg-gradient-to-r from-jungle-green to-light-sea-green hover:from-light-sea-green hover:to-jungle-green text-white rounded-lg transition-all duration-200 font-semibold flex items-center gap-2 shadow-md hover:shadow-lg mx-auto"
              >
                <Sparkles className="w-5 h-5" />
                Generate Prompts Now
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {generatedPrompts.map((prompt) => (
              <div
                key={prompt.taskId}
                className="border border-gray-200 rounded-lg overflow-hidden hover:border-light-sea-green transition-all duration-200"
              >
                <div className="bg-gradient-to-r from-light-sea-green/10 to-green-yellow/10 p-4 border-b border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{prompt.taskName}</h4>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>{prompt.department}</span>
                        <span>→</span>
                        <span>{prompt.team}</span>
                        <span>→</span>
                        <span>{prompt.role}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopy(prompt.prompt, prompt.taskId)}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        copiedId === prompt.taskId
                          ? 'bg-green-100 text-green-600'
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      {copiedId === prompt.taskId ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-white">
                  <pre className="text-sm text-gray-900 whitespace-pre-wrap font-mono leading-relaxed">
                    {prompt.prompt}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
