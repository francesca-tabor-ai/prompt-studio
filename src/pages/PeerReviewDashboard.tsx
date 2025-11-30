import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  Clock,
  FileText,
  Send,
  Eye,
  AlertCircle,
  TrendingUp,
  Users,
  Filter,
} from 'lucide-react';
import { peerReviewService } from '../services/peerReviewService';
import { SubmissionFormModal } from '../components/SubmissionFormModal';
import { ReviewInterfaceModal } from '../components/ReviewInterfaceModal';
import { ThreadedComments } from '../components/ThreadedComments';

export function PeerReviewDashboard() {
  const [activeTab, setActiveTab] = useState<'my-submissions' | 'review-assignments' | 'all-submissions'>('my-submissions');
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'my-submissions') {
        const submissions = await peerReviewService.getMySubmissions();
        setMySubmissions(submissions);
      } else if (activeTab === 'review-assignments') {
        const assignments = await peerReviewService.getMyAssignments();
        setMyAssignments(assignments);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      under_review: 'bg-blue-100 text-blue-700',
      changes_requested: 'bg-orange-100 text-orange-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      published: 'bg-purple-100 text-purple-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getAssignmentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      assigned: 'bg-blue-100 text-blue-700',
      acknowledged: 'bg-indigo-100 text-indigo-700',
      in_progress: 'bg-purple-100 text-purple-700',
      completed: 'bg-green-100 text-green-700',
      declined: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const StatCard = ({
    icon: Icon,
    label,
    value,
    color,
  }: {
    icon: any;
    label: string;
    value: number;
    color: string;
  }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-600">{label}</p>
        </div>
      </div>
    </div>
  );

  const SubmissionCard = ({ submission }: { submission: any }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{submission.title}</h3>
          <div className="flex gap-2 mb-3">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
              {submission.workflow}
            </span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
              {submission.role}
            </span>
            <span className={`text-xs px-2 py-1 rounded ${getStatusColor(submission.status)}`}>
              {submission.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">{submission.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {new Date(submission.created_at).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            Version {submission.submission_version || 1}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSelectedSubmission(submission);
              setShowComments(true);
            }}
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-4 h-4 inline mr-1" />
            View
          </button>
          {submission.status === 'changes_requested' && (
            <button
              onClick={() => {
                setSelectedSubmission(submission);
                setShowSubmissionForm(true);
              }}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Resubmit
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const AssignmentCard = ({ assignment }: { assignment: any }) => {
    const submission = assignment.prompt_submissions;

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{submission.title}</h3>
              <span
                className={`text-xs px-2 py-1 rounded ${getAssignmentStatusColor(
                  assignment.status
                )}`}
              >
                {assignment.status.replace('_', ' ')}
              </span>
            </div>
            <div className="flex gap-2 mb-3">
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {submission.workflow}
              </span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                {submission.role}
              </span>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                {assignment.reviewer_level} reviewer
              </span>
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">{submission.description}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedSubmission(submission);
                setShowComments(true);
              }}
              className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Eye className="w-4 h-4 inline mr-1" />
              View
            </button>
            {assignment.status !== 'completed' && (
              <button
                onClick={() => {
                  setSelectedSubmission(submission);
                  setShowReviewModal(true);
                }}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FileText className="w-4 h-4 inline mr-1" />
                Review
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Peer Review Dashboard</h1>
          <p className="text-gray-600">
            Submit prompts for review and collaborate with your team
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            icon={FileText}
            label="My Submissions"
            value={mySubmissions.length}
            color="bg-blue-500"
          />
          <StatCard
            icon={CheckCircle}
            label="Review Assignments"
            value={myAssignments.length}
            color="bg-green-500"
          />
          <StatCard
            icon={TrendingUp}
            label="Approved"
            value={mySubmissions.filter((s) => s.status === 'approved').length}
            color="bg-purple-500"
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-lg mb-6">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('my-submissions')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'my-submissions'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                My Submissions
              </button>
              <button
                onClick={() => setActiveTab('review-assignments')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'review-assignments'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Review Assignments
              </button>
            </div>

            <button
              onClick={() => setShowSubmissionForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              New Submission
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {activeTab === 'my-submissions' && (
                  <>
                    {mySubmissions.length === 0 ? (
                      <div className="text-center py-12">
                        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          No submissions yet
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Submit your first prompt for peer review
                        </p>
                        <button
                          onClick={() => setShowSubmissionForm(true)}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Create Submission
                        </button>
                      </div>
                    ) : (
                      mySubmissions.map((submission) => (
                        <SubmissionCard key={submission.id} submission={submission} />
                      ))
                    )}
                  </>
                )}

                {activeTab === 'review-assignments' && (
                  <>
                    {myAssignments.length === 0 ? (
                      <div className="text-center py-12">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          No review assignments
                        </h3>
                        <p className="text-gray-600">
                          You don't have any prompts to review at the moment
                        </p>
                      </div>
                    ) : (
                      myAssignments.map((assignment) => (
                        <AssignmentCard key={assignment.id} assignment={assignment} />
                      ))
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <SubmissionFormModal
        isOpen={showSubmissionForm}
        onClose={() => {
          setShowSubmissionForm(false);
          setSelectedSubmission(null);
        }}
        onSuccess={() => loadData()}
        parentSubmissionId={selectedSubmission?.id}
        isResubmission={!!selectedSubmission}
      />

      <ReviewInterfaceModal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setSelectedSubmission(null);
        }}
        submission={selectedSubmission}
        onSuccess={() => loadData()}
      />

      {showComments && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedSubmission.title}
              </h2>
              <button
                onClick={() => {
                  setShowComments(false);
                  setSelectedSubmission(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <ThreadedComments submissionId={selectedSubmission.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
