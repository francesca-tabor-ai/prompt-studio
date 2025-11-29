import { useState } from 'react';
import { FlaskConical, FileText, Users, ArrowLeft, CheckCircle } from 'lucide-react';
import PromptInputPanel, { PromptConfig } from '../components/PromptInputPanel';
import CandidatePromptCard, { CandidatePrompt } from '../components/CandidatePromptCard';
import RefinementTools, { RefinementConfig } from '../components/RefinementTools';

export default function PromptGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [candidatePrompts, setCandidatePrompts] = useState<CandidatePrompt[]>([]);
  const [refinementConfig, setRefinementConfig] = useState<RefinementConfig>({
    toneLevel: 50,
    complexity: 'intermediate',
    includeKeywords: [],
    excludeKeywords: [],
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const generatePrompts = (config: PromptConfig) => {
    setIsGenerating(true);

    setTimeout(() => {
      const prompts: CandidatePrompt[] = [
        {
          id: '1',
          title: 'Detailed Workflow Assistant',
          content: `You are a ${config.tone.toLowerCase()} assistant specialized in ${config.workflow.substring(0, 50)}...\n\nYour primary responsibilities include:\n1. Understanding user context and requirements\n2. Providing clear, actionable guidance\n3. Maintaining a ${config.style.toLowerCase()} communication style\n\nConstraints: ${config.constraints || 'None specified'}\n\nPlease assist users by...`,
          estimatedTokens: config.length === 'Short' ? 150 : config.length === 'Medium' ? 250 : config.length === 'Long' ? 400 : 600,
          isSelected: false,
        },
        {
          id: '2',
          title: 'Concise Task Handler',
          content: `Task: ${config.workflow}\n\nApproach:\n- ${config.style} methodology\n- ${config.tone} tone throughout\n- Focus on efficiency and clarity\n\nKey guidelines:\n• Understand the request context\n• Deliver actionable responses\n• Follow constraints: ${config.constraints || 'Standard best practices'}\n\nBegin by...`,
          estimatedTokens: config.length === 'Short' ? 120 : config.length === 'Medium' ? 200 : config.length === 'Long' ? 350 : 500,
          isSelected: false,
        },
        {
          id: '3',
          title: 'Context-Aware Assistant',
          content: `Role: Specialist in ${config.workflow.substring(0, 40)}...\n\nCommunication Style:\n- Tone: ${config.tone}\n- Approach: ${config.style}\n- Format: ${config.length} responses\n\nOperating Parameters:\n${config.constraints ? `• ${config.constraints}` : '• Flexible within best practices'}\n• Prioritize user needs\n• Ensure clarity and accuracy\n\nWhen assisting...`,
          estimatedTokens: config.length === 'Short' ? 140 : config.length === 'Medium' ? 230 : config.length === 'Long' ? 380 : 550,
          isSelected: false,
        },
      ];

      setCandidatePrompts(prompts);
      setIsGenerating(false);
    }, 2000);
  };

  const applyRefinements = () => {
    setIsGenerating(true);

    setTimeout(() => {
      const refinedPrompts = candidatePrompts.map((prompt) => ({
        ...prompt,
        content: prompt.content + `\n\n[Refined with ${refinementConfig.complexity} complexity and ${getRefinedToneLabel(refinementConfig.toneLevel)} tone]`,
      }));

      setCandidatePrompts(refinedPrompts);
      setIsGenerating(false);
    }, 1500);
  };

  const getRefinedToneLabel = (level: number) => {
    if (level <= 20) return 'very formal';
    if (level <= 40) return 'formal';
    if (level <= 60) return 'balanced';
    if (level <= 80) return 'casual';
    return 'very casual';
  };

  const toggleSelection = (id: string) => {
    setCandidatePrompts(
      candidatePrompts.map((p) =>
        p.id === id ? { ...p, isSelected: !p.isSelected } : p
      )
    );
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const regeneratePrompt = (id: string) => {
    setIsGenerating(true);
    setTimeout(() => {
      setCandidatePrompts(
        candidatePrompts.map((p) =>
          p.id === id
            ? { ...p, content: p.content + '\n\n[Regenerated with variations]' }
            : p
        )
      );
      setIsGenerating(false);
    }, 1000);
  };

  const deletePrompt = (id: string) => {
    setCandidatePrompts(candidatePrompts.filter((p) => p.id !== id));
  };

  const handleAction = (action: string) => {
    const selectedCount = candidatePrompts.filter((p) => p.isSelected).length;

    if (selectedCount === 0) {
      alert('Please select at least one prompt');
      return;
    }

    setSuccessMessage(`${selectedCount} prompt${selectedCount > 1 ? 's' : ''} ${action}`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const selectedCount = candidatePrompts.filter((p) => p.isSelected).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl text-space-cadet font-bebas tracking-wide">AI PROMPT GENERATOR</h1>
                <p className="text-sm text-gray-600">Create and refine AI prompts with intelligent assistance</p>
              </div>
            </div>

            {candidatePrompts.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  {selectedCount} of {candidatePrompts.length} selected
                </span>
                <button
                  onClick={() => handleAction('saved to sandbox')}
                  disabled={selectedCount === 0}
                  className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-light-sea-green rounded-lg transition-all duration-200 font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FlaskConical className="w-4 h-4" />
                  Save to Sandbox
                </button>
                <button
                  onClick={() => handleAction('added to library draft')}
                  disabled={selectedCount === 0}
                  className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-light-sea-green rounded-lg transition-all duration-200 font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileText className="w-4 h-4" />
                  Add to Library Draft
                </button>
                <button
                  onClick={() => handleAction('submitted for peer review')}
                  disabled={selectedCount === 0}
                  className="px-4 py-2.5 bg-gradient-to-r from-jungle-green to-light-sea-green hover:from-light-sea-green hover:to-jungle-green text-white rounded-lg transition-all duration-200 font-medium text-sm flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Users className="w-4 h-4" />
                  Submit for Review
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showSuccess && (
        <div className="fixed top-20 right-8 z-50 animate-in slide-in-from-top">
          <div className="bg-green-50 border-2 border-green-200 rounded-xl px-6 py-4 shadow-xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-semibold text-green-800">{successMessage}</span>
          </div>
        </div>
      )}

      <main className="p-8">
        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2 space-y-6">
            <PromptInputPanel onGenerate={generatePrompts} isGenerating={isGenerating} />

            {candidatePrompts.length > 0 && (
              <div>
                <div className="mb-4">
                  <h2 className="text-2xl text-space-cadet font-bebas tracking-wide">CANDIDATE PROMPTS</h2>
                  <p className="text-sm text-gray-600">Select and refine generated prompts</p>
                </div>
                <div className="space-y-4">
                  {candidatePrompts.map((prompt) => (
                    <CandidatePromptCard
                      key={prompt.id}
                      prompt={prompt}
                      onSelect={() => toggleSelection(prompt.id)}
                      onCopy={() => copyToClipboard(prompt.content)}
                      onRegenerate={() => regeneratePrompt(prompt.id)}
                      onDelete={() => deletePrompt(prompt.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {candidatePrompts.length === 0 && !isGenerating && (
              <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FlaskConical className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No prompts generated yet</h3>
                <p className="text-gray-600 mb-6">
                  Fill in the prompt input form and click "Generate AI Prompts" to get started
                </p>
              </div>
            )}
          </div>

          <div>
            <RefinementTools
              config={refinementConfig}
              onChange={setRefinementConfig}
              onApply={applyRefinements}
              disabled={candidatePrompts.length === 0 || isGenerating}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
