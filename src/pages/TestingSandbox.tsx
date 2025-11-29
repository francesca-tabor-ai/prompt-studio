import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import ScenarioSelector, { Scenario } from '../components/ScenarioSelector';
import TestPanel, { TestResult } from '../components/TestPanel';
import MetricsDashboard from '../components/MetricsDashboard';
import IterationTools from '../components/IterationTools';
import { sandboxService } from '../services/sandboxService';

export default function TestingSandbox() {
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [prompt, setPrompt] = useState('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [versionCount, setVersionCount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [currentPromptVersionId, setCurrentPromptVersionId] = useState<string | null>(null);
  const [previousMetrics, setPreviousMetrics] = useState<{
    accuracy: number;
    relevance: number;
    tone: number;
    consistency: number;
  } | undefined>();

  const scenarios: Scenario[] = [
    {
      id: '1',
      name: 'Customer Support Inquiry',
      description: 'Handle customer questions about billing, account issues, and general support',
      category: 'Support',
      testCases: [
        'Customer asking about refund policy',
        'Technical issue with login',
        'Billing discrepancy complaint',
      ],
    },
    {
      id: '2',
      name: 'Sales Outreach',
      description: 'Generate personalized sales emails for B2B prospects',
      category: 'Sales',
      testCases: [
        'Initial outreach to tech startup CEO',
        'Follow-up after demo call',
        'Re-engagement for cold lead',
      ],
    },
    {
      id: '3',
      name: 'Content Creation',
      description: 'Create blog posts, social media content, and marketing copy',
      category: 'Marketing',
      testCases: [
        'Blog post about industry trends',
        'Social media announcement',
        'Product feature highlight',
      ],
    },
    {
      id: '4',
      name: 'Data Analysis',
      description: 'Analyze datasets and provide insights with recommendations',
      category: 'Analytics',
      testCases: [
        'Quarterly sales performance analysis',
        'Customer behavior patterns',
        'Market trend identification',
      ],
    },
    {
      id: '5',
      name: 'Code Review',
      description: 'Review code submissions and provide constructive feedback',
      category: 'Engineering',
      testCases: [
        'React component optimization',
        'API endpoint security review',
        'Database query performance',
      ],
    },
  ];

  useEffect(() => {
    if (selectedScenario) {
      loadScenarioData(selectedScenario);
    }
  }, [selectedScenario]);

  const loadScenarioData = async (scenario: Scenario) => {
    const versions = await sandboxService.getPromptVersions(scenario.id);
    setVersionCount(versions.length);

    const latestVersion = await sandboxService.getLatestPromptVersion(scenario.id);
    if (latestVersion) {
      setPrompt(latestVersion.prompt_text);
      setCurrentPromptVersionId(latestVersion.id);

      const results = await sandboxService.getTestResults(latestVersion.id);
      if (results.length > 0) {
        const formattedResults = results.map((r) => ({
          id: r.id,
          input: r.test_input,
          output: r.test_output,
          timestamp: new Date(r.created_at),
          metrics: {
            accuracy: r.accuracy,
            relevance: r.relevance,
            tone: r.tone,
            consistency: r.consistency,
          },
        }));
        setTestResults(formattedResults);
      }
    } else {
      setPrompt(generateDefaultPrompt(scenario));
      setCurrentPromptVersionId(null);
      setTestResults([]);
    }
  };

  const generateDefaultPrompt = (scenario: Scenario): string => {
    return `You are an AI assistant specializing in ${scenario.category.toLowerCase()} tasks.\n\nYour role: ${scenario.description}\n\nGuidelines:\n- Maintain a professional yet approachable tone\n- Provide clear, actionable responses\n- Consider context and user intent\n- Ensure accuracy and relevance\n\nWhen responding to queries, follow these principles:\n1. Understand the specific need\n2. Provide comprehensive answers\n3. Be concise but thorough\n4. Maintain consistency across responses`;
  };

  const generateMetrics = (input: string, output: string) => {
    const baseAccuracy = 70 + Math.random() * 25;
    const baseRelevance = 65 + Math.random() * 30;
    const baseTone = 75 + Math.random() * 20;
    const baseConsistency = 70 + Math.random() * 25;

    const inputLength = input.length;
    const outputLength = output.length;
    const lengthBonus = outputLength > 100 && outputLength < 500 ? 5 : 0;

    return {
      accuracy: Math.min(100, Math.round(baseAccuracy + lengthBonus)),
      relevance: Math.min(100, Math.round(baseRelevance + lengthBonus)),
      tone: Math.min(100, Math.round(baseTone)),
      consistency: Math.min(100, Math.round(baseConsistency)),
    };
  };

  const handleRunTest = async (testInput: string) => {
    setIsRunning(true);

    setTimeout(async () => {
      const mockOutput = `Based on your query regarding "${testInput}", here's a comprehensive response:\n\n${testInput.includes('billing') || testInput.includes('refund')
        ? 'I understand your concern about billing. Let me help you resolve this issue. Our refund policy allows for full refunds within 30 days of purchase. I\'ll process this for you right away and you should see the credit within 3-5 business days.'
        : testInput.includes('sales') || testInput.includes('outreach')
        ? 'Thank you for your interest in our solution. Based on your company\'s profile, I believe our enterprise platform would be an excellent fit. Would you be available for a brief 15-minute call next week to discuss how we can help streamline your operations?'
        : testInput.includes('content') || testInput.includes('blog')
        ? 'Here\'s a compelling piece of content that addresses your topic: Industry trends are shifting rapidly, and businesses that adapt quickly will gain a competitive advantage. Our latest research shows that companies implementing AI-driven solutions see 40% improvement in efficiency.'
        : testInput.includes('data') || testInput.includes('analysis')
        ? 'After analyzing the dataset, I\'ve identified three key insights: 1) Sales increased 25% quarter-over-quarter, 2) Customer retention improved by 15%, 3) Geographic expansion into the midwest market shows strong potential. Recommendations: Focus on customer success initiatives and consider strategic partnerships in high-growth regions.'
        : 'I\'ve reviewed your submission and here\'s my feedback: The code structure is solid and follows best practices. Consider optimizing the database queries using indexing and caching strategies. The API endpoints are secure, but adding rate limiting would enhance protection. Overall, this is well-written code with minor areas for improvement.'
      }`;

      const metrics = generateMetrics(testInput, mockOutput);

      const savedResult = await sandboxService.saveTestResult(
        currentPromptVersionId,
        testInput,
        mockOutput,
        metrics
      );

      if (savedResult) {
        const newResult: TestResult = {
          id: savedResult.id,
          input: testInput,
          output: mockOutput,
          timestamp: new Date(savedResult.created_at),
          metrics,
        };

        if (testResults.length > 0) {
          setPreviousMetrics(testResults[0].metrics);
        }

        setTestResults([newResult, ...testResults]);
      }

      setIsRunning(false);
    }, 2000);
  };

  const handleRerunTests = () => {
    if (testResults.length === 0) return;

    setIsRunning(true);

    setTimeout(() => {
      const rerunResults = testResults.map((result) => ({
        ...result,
        timestamp: new Date(),
        metrics: generateMetrics(result.input, result.output),
      }));

      setPreviousMetrics(testResults[0].metrics);
      setTestResults(rerunResults);
      setIsRunning(false);

      setSuccessMessage('All tests rerun successfully');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 2000);
  };

  const handleSaveVersion = async () => {
    if (!selectedScenario) return;

    const savedVersion = await sandboxService.savePromptVersion(
      prompt,
      selectedScenario.id,
      selectedScenario.name
    );

    if (savedVersion) {
      setCurrentPromptVersionId(savedVersion.id);
      setVersionCount(savedVersion.version_number);
      setSuccessMessage(`Version ${savedVersion.version_number} saved successfully`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const handleSubmitRefined = () => {
    setSuccessMessage('Refined prompt submitted for review');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleTweakPrompt = (suggestion: string) => {
    setPrompt(prompt + `\n\nAdditional guidance: ${suggestion}`);
    setSuccessMessage('Suggestion applied to prompt');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const currentMetrics = testResults.length > 0 ? testResults[0].metrics : {
    accuracy: 0,
    relevance: 0,
    tone: 0,
    consistency: 0,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-8 py-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl text-space-cadet font-bebas tracking-wide">TESTING SANDBOX</h1>
              <p className="text-sm text-gray-600">Test and refine prompts with real-time metrics</p>
            </div>
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
            <ScenarioSelector
              scenarios={scenarios}
              selectedScenario={selectedScenario}
              onSelect={setSelectedScenario}
            />

            <TestPanel
              prompt={prompt}
              onPromptChange={setPrompt}
              onRunTest={handleRunTest}
              testResults={testResults}
              isRunning={isRunning}
            />
          </div>

          <div className="space-y-6">
            <MetricsDashboard
              metrics={currentMetrics}
              previousMetrics={previousMetrics}
            />

            <IterationTools
              onTweakPrompt={handleTweakPrompt}
              onRerunTests={handleRerunTests}
              onSaveVersion={handleSaveVersion}
              onSubmitRefined={handleSubmitRefined}
              hasTests={testResults.length > 0}
              isRunning={isRunning}
              versionCount={versionCount}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
