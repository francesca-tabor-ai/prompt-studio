import React, { useState, useEffect } from 'react';
import { Users, UserPlus, RefreshCw, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { reviewerAssignmentService } from '../services/reviewerAssignmentService';
import { reminderEscalationService } from '../services/reminderEscalationService';
import { supabase } from '../lib/supabase';

interface ReviewerAssignmentPanelProps {
  submissionId: string;
  onAssignmentComplete?: () => void;
}

export function ReviewerAssignmentPanel({ submissionId, onAssignmentComplete }: ReviewerAssignmentPanelProps) {
  const [availableReviewers, setAvailableReviewers] = useState<any[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<any[]>([]);
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [reviewerMetrics, setReviewerMetrics] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    loadData();
  }, [submissionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAvailableReviewers(),
        loadCurrentAssignments(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableReviewers = async () => {
    const { data } = await supabase
      .from('submission_reviewer_expertise')
      .select('*')
      .eq('is_active', true)
      .eq('is_available', true)
      .order('current_review_count', { ascending: true });

    if (data) {
      setAvailableReviewers(data);

      for (const reviewer of data) {
        const metrics = await reviewerAssignmentService.getReviewerMetrics(reviewer.reviewer_id);
        if (metrics) {
          setReviewerMetrics(prev => new Map(prev.set(reviewer.reviewer_id, metrics)));
        }
      }
    }
  };

  const loadCurrentAssignments = async () => {
    const { data } = await supabase
      .from('submission_reviewer_assignments')
      .select('*')
      .eq('submission_id', submissionId)
      .neq('status', 'removed');

    setCurrentAssignments(data || []);
  };

  const handleAutoAssign = async () => {
    setAutoAssigning(true);
    try {
      const { data: submission } = await supabase
        .from('prompt_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

      if (!submission) return;

      const result = await reviewerAssignmentService.autoAssignReviewers({
        submissionId,
        expertiseArea: submission.role,
        requiredLevel: submission.reviewer_level || 'senior',
        minReviewers: submission.required_approvals || 2,
        maxReviewers: 3,
        method: 'load_balanced',
      });

      if (result.success) {
        await loadData();
        onAssignmentComplete?.();
      }
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleManualAssign = async () => {
    if (selectedReviewers.length === 0) return;

    setLoading(true);
    try {
      const user = await supabase.auth.getUser();

      const result = await reviewerAssignmentService.manualAssignReviewers({
        submissionId,
        reviewerIds: selectedReviewers,
        assignedBy: user.data.user?.id || '',
        reason: 'manual_assignment',
      });

      if (result.success) {
        setSelectedReviewers([]);
        await loadData();
        onAssignmentComplete?.();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string, reviewerId: string) => {
    if (!confirm('Are you sure you want to remove this reviewer assignment?')) return;

    try {
      await supabase
        .from('submission_reviewer_assignments')
        .update({ status: 'removed' })
        .eq('id', assignmentId);

      await supabase
        .from('submission_reviewer_expertise')
        .update({
          current_review_count: supabase.rpc('greatest', {
            a: 0,
            b: supabase.rpc('decrement', { x: 1 })
          })
        })
        .eq('reviewer_id', reviewerId);

      await loadData();
    } catch (error) {
      console.error('Error removing assignment:', error);
    }
  };

  const handleSendReminder = async (assignmentId: string) => {
    try {
      const assignment = currentAssignments.find(a => a.id === assignmentId);
      if (!assignment) return;

      const hoursOverdue = (Date.now() - new Date(assignment.assigned_at).getTime()) / (1000 * 60 * 60);

      await reminderEscalationService.sendReminder({
        assignmentId,
        hoursOverdue,
        reminderType: hoursOverdue > 48 ? 'urgent' : 'gentle',
      });

      alert('Reminder sent successfully');
    } catch (error) {
      console.error('Error sending reminder:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      assigned: 'bg-blue-100 text-blue-700',
      acknowledged: 'bg-indigo-100 text-indigo-700',
      in_progress: 'bg-purple-100 text-purple-700',
      completed: 'bg-green-100 text-green-700',
      declined: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getWorkloadColor = (workload: number, max: number) => {
    const percentage = (workload / max) * 100;
    if (percentage >= 80) return 'text-red-600';
    if (percentage >= 60) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Reviewer Assignment</h3>
              <p className="text-sm text-gray-600">
                {currentAssignments.length} reviewer(s) assigned
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAutoAssign}
              disabled={autoAssigning || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${autoAssigning ? 'animate-spin' : ''}`} />
              Auto Assign
            </button>
            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              {showMetrics ? 'Hide' : 'Show'} Metrics
            </button>
          </div>
        </div>

        {currentAssignments.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Current Assignments</h4>
            {currentAssignments.map((assignment) => {
              const hoursAge = (Date.now() - new Date(assignment.assigned_at).getTime()) / (1000 * 60 * 60);
              const isOverdue = hoursAge > 72;

              return (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{assignment.reviewer_email}</span>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(assignment.status)}`}>
                        {assignment.status}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${assignment.reviewer_level === 'expert' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                        {assignment.reviewer_level}
                      </span>
                      {isOverdue && (
                        <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {Math.round(hoursAge)}h overdue
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600">
                      Assigned {new Date(assignment.assigned_at).toLocaleString()}
                      {assignment.completed_at && (
                        <span className="ml-2">
                          • Completed {new Date(assignment.completed_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {assignment.status !== 'completed' && (
                      <button
                        onClick={() => handleSendReminder(assignment.id)}
                        className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveAssignment(assignment.id, assignment.reviewer_id)}
                      className="px-3 py-1 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Available Reviewers</h4>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {availableReviewers.map((reviewer) => {
              const isSelected = selectedReviewers.includes(reviewer.reviewer_id);
              const isAssigned = currentAssignments.some(a => a.reviewer_id === reviewer.reviewer_id && a.status !== 'removed');
              const metrics = reviewerMetrics.get(reviewer.reviewer_id);

              return (
                <div
                  key={reviewer.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : isAssigned
                      ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    if (isAssigned) return;
                    setSelectedReviewers(prev =>
                      isSelected
                        ? prev.filter(id => id !== reviewer.reviewer_id)
                        : [...prev, reviewer.reviewer_id]
                    );
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-gray-900">{reviewer.reviewer_email}</span>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          {reviewer.expertise_level}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {reviewer.expertise_area}
                        </span>
                        {isAssigned && (
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                            Already Assigned
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className={getWorkloadColor(reviewer.current_review_count, reviewer.max_concurrent_reviews)}>
                          Workload: {reviewer.current_review_count}/{reviewer.max_concurrent_reviews}
                        </span>
                        {showMetrics && metrics && (
                          <>
                            <span>
                              Completion: {metrics.completionRate.toFixed(0)}%
                            </span>
                            <span>
                              Avg Time: {metrics.averageCompletionTime.toFixed(0)}h
                            </span>
                            {metrics.overdueCount > 0 && (
                              <span className="text-red-600">
                                Overdue: {metrics.overdueCount}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {isSelected && !isAssigned && (
                      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedReviewers.length > 0 && (
          <button
            onClick={handleManualAssign}
            disabled={loading}
            className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            Assign {selectedReviewers.length} Reviewer(s)
          </button>
        )}
      </div>
    </div>
  );
}
