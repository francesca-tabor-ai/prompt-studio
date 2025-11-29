import { useState, useEffect } from 'react';
import { CheckCircle, FileText, Users, Eye } from 'lucide-react';
import SubmissionForm from '../components/SubmissionForm';
import ReviewPanel from '../components/ReviewPanel';
import AISuggestionPanel from '../components/AISuggestionPanel';
import ContributorLeaderboard from '../components/ContributorLeaderboard';
import {
  collaborationService,
  PromptSubmission,
  PromptReview,
  PromptSuggestion,
  ContributorStats,
} from '../services/collaborationService';

export default function Collaborate() {
  const [submissions, setSubmissions] = useState<PromptSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<PromptSubmission | null>(null);
  const [reviews, setReviews] = useState<PromptReview[]>([]);
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);
  const [contributors, setContributors] = useState<ContributorStats[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'submit' | 'review'>('submit');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const submissionsData = await collaborationService.getSubmissions();
    const leaderboardData = await collaborationService.getLeaderboard();
    setSubmissions(submissionsData);
    setContributors(leaderboardData);

    if (submissionsData.length > 0 && !selectedSubmission) {
      setSelectedSubmission(submissionsData[0]);
    }
  };

  useEffect(() => {
    if (selectedSubmission) {
      loadSubmissionDetails(selectedSubmission.id);
    }
  }, [selectedSubmission]);

  const loadSubmissionDetails = async (submissionId: string) => {
    const reviewsData = await collaborationService.getReviews(submissionId);
    const suggestionsData = await collaborationService.getSuggestions(submissionId);
    setReviews(reviewsData);
    setSuggestions(suggestionsData);
  };

  const handleSubmit = async (submission: any) => {
    const result = await collaborationService.submitPrompt(submission);
    if (result) {
      await loadData();
      setSuccessMessage('Prompt submitted successfully for peer review');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const handleSubmitReview = async (review: any) => {
    if (selectedSubmission) {
      const result = await collaborationService.addReview({
        ...review,
        submission_id: selectedSubmission.id,
      });
      if (result) {
        await loadSubmissionDetails(selectedSubmission.id);
        await loadData();
        setSuccessMessage('Review submitted successfully');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!selectedSubmission) return;

    const aiSuggestions = generateAISuggestions(selectedSubmission);
    const result = await collaborationService.addSuggestions(selectedSubmission.id, aiSuggestions);

    if (result.length > 0) {
      setSuggestions(result);
      setSuccessMessage(`Generated ${result.length} AI suggestions`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const generateAISuggestions = (
    submission: PromptSubmission
  ): { text: string; type: PromptSuggestion['suggestion_type'] }[] => {
    const suggestions: { text: string; type: PromptSuggestion['suggestion_type'] }[] = [];

    if (!submission.prompt_content.includes('example') && !submission.prompt_content.includes('Example')) {
      suggestions.push({
        text: 'Consider adding specific examples to illustrate the expected behavior. This helps users understand how to apply the prompt in real scenarios.',
        type: 'examples',
      });
    }

    if (submission.prompt_content.length < 200) {
      suggestions.push({
        text: 'The prompt could benefit from more detailed instructions. Expand on the context, constraints, and expected outcomes to improve clarity.',
        type: 'clarity',
      });
    }

    if (!submission.prompt_content.includes('1.') && !submission.prompt_content.includes('-')) {
      suggestions.push({
        text: 'Structure the prompt with numbered steps or bullet points to improve readability and make it easier for users to follow.',
        type: 'structure',
      });
    }

    if (!submission.prompt_content.toLowerCase().includes('tone') && !submission.prompt_content.toLowerCase().includes('style')) {
      suggestions.push({
        text: 'Specify the desired tone and style (e.g., professional, friendly, concise) to ensure consistent outputs across different use cases.',
        type: 'tone',
      });
    }

    return suggestions;
  };

  const handleApplySuggestion = async (suggestionId: string) => {
    const success = await collaborationService.applySuggestion(suggestionId);
    if (success && selectedSubmission) {
      await loadSubmissionDetails(selectedSubmission.id);
      setSuccessMessage('Suggestion applied successfully');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const handleApprove = async () => {
    if (selectedSubmission) {
      await collaborationService.updateSubmissionStatus(selectedSubmission.id, 'approved');
      await loadData();
      setSuccessMessage('Prompt approved successfully');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const handleRequestChanges = async () => {
    if (selectedSubmission) {
      await collaborationService.updateSubmissionStatus(selectedSubmission.id, 'changes_requested');
      await loadData();
      setSuccessMessage('Changes requested');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const handleSendToSandbox = () => {
    setSuccessMessage('Prompt sent to testing sandbox');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'changes_requested':
        return 'bg-yellow-100 text-yellow-700';
      case 'pending':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-8 py-4">
          <div>
            <h1 className="text-2xl text-space-cadet font-bebas tracking-wide">
              COLLABORATIVE REVIEW
            </h1>
            <p className="text-sm text-gray-600">Submit prompts and participate in peer reviews</p>
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
        <div className="grid grid-cols-3 gap-8 mb-8">
          <button
            onClick={() => setActiveTab('submit')}
            className={`p-6 rounded-xl border-2 transition-all duration-200 ${
              activeTab === 'submit'
                ? 'bg-gradient-to-br from-light-sea-green to-jungle-green text-white border-light-sea-green shadow-lg'
                : 'bg-white text-gray-700 border-gray-200 hover:border-light-sea-green'
            }`}
          >
            <FileText className="w-8 h-8 mb-2 mx-auto" />
            <div className="text-center">
              <div className="font-bold text-lg">Submit Prompt</div>
              <div className="text-sm opacity-80">Share your work</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className={`p-6 rounded-xl border-2 transition-all duration-200 ${
              activeTab === 'review'
                ? 'bg-gradient-to-br from-light-sea-green to-jungle-green text-white border-light-sea-green shadow-lg'
                : 'bg-white text-gray-700 border-gray-200 hover:border-light-sea-green'
            }`}
          >
            <Users className="w-8 h-8 mb-2 mx-auto" />
            <div className="text-center">
              <div className="font-bold text-lg">Review Prompts</div>
              <div className="text-sm opacity-80">Help the community</div>
            </div>
          </button>

          <div className="p-6 rounded-xl border-2 bg-gradient-to-br from-green-yellow/10 to-jungle-green/10 border-green-yellow/30">
            <Eye className="w-8 h-8 mb-2 mx-auto text-jungle-green" />
            <div className="text-center">
              <div className="font-bold text-lg text-gray-900">{submissions.length}</div>
              <div className="text-sm text-gray-600">Total Submissions</div>
            </div>
          </div>
        </div>

        {activeTab === 'submit' ? (
          <div className="grid grid-cols-3 gap-8">
            <div className="col-span-2">
              <SubmissionForm onSubmit={handleSubmit} />
            </div>
            <div>
              <ContributorLeaderboard contributors={contributors} />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">All Submissions</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {submissions.map((submission) => (
                    <button
                      key={submission.id}
                      onClick={() => setSelectedSubmission(submission)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                        selectedSubmission?.id === submission.id
                          ? 'bg-light-sea-green/10 border-light-sea-green'
                          : 'bg-white border-gray-200 hover:border-light-sea-green/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{submission.title}</h4>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(
                            submission.status
                          )}`}
                        >
                          {submission.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span>{submission.workflow}</span>
                        <span>•</span>
                        <span>{submission.role}</span>
                        <span>•</span>
                        <span>by {submission.submitter_name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {selectedSubmission && (
              <>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">{selectedSubmission.title}</h3>
                  <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-gray-600">Workflow:</span>{' '}
                      <span className="font-semibold text-gray-900">{selectedSubmission.workflow}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Role:</span>{' '}
                      <span className="font-semibold text-gray-900">{selectedSubmission.role}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Submitted by:</span>{' '}
                      <span className="font-semibold text-gray-900">
                        {selectedSubmission.submitter_name}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Prompt Content</h4>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <pre className="text-sm text-gray-900 whitespace-pre-wrap font-mono">
                          {selectedSubmission.prompt_content}
                        </pre>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Sample Output</h4>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-sm text-gray-900">{selectedSubmission.sample_output}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <ReviewPanel
                    submission={selectedSubmission}
                    existingReviews={reviews}
                    onSubmitReview={handleSubmitReview}
                    onApprove={handleApprove}
                    onRequestChanges={handleRequestChanges}
                    onSendToSandbox={handleSendToSandbox}
                  />
                  <div className="space-y-8">
                    <AISuggestionPanel
                      suggestions={suggestions}
                      onApplySuggestion={handleApplySuggestion}
                      onGenerateSuggestions={handleGenerateSuggestions}
                    />
                    <ContributorLeaderboard contributors={contributors} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
