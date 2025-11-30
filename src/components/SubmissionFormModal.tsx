import React, { useState } from 'react';
import { X, Send, AlertCircle } from 'lucide-react';
import { peerReviewService } from '../services/peerReviewService';

interface SubmissionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (submissionId: string) => void;
  parentSubmissionId?: string;
  isResubmission?: boolean;
}

export function SubmissionFormModal({
  isOpen,
  onClose,
  onSuccess,
  parentSubmissionId,
  isResubmission = false,
}: SubmissionFormModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    workflow: 'Standard Review',
    role: '',
    description: '',
    promptText: '',
    sampleOutput: '',
    requiredApprovals: 2,
    reviewerLevel: 'senior' as 'junior' | 'senior' | 'expert' | 'any',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workflows = ['Standard Review', 'Expedited Review', 'Thorough Review'];
  const roles = [
    'Customer Support',
    'Sales',
    'Marketing',
    'Technical Support',
    'Product Management',
    'Content Creation',
    'Data Analysis',
    'Other',
  ];
  const reviewerLevels = ['any', 'junior', 'senior', 'expert'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      let result;
      if (isResubmission && parentSubmissionId) {
        result = await peerReviewService.resubmitPrompt(parentSubmissionId, {
          title: formData.title,
          workflow: formData.workflow,
          role: formData.role,
          description: formData.description,
          promptText: formData.promptText,
          sampleOutput: formData.sampleOutput,
          requiredApprovals: formData.requiredApprovals,
          reviewerLevel: formData.reviewerLevel,
        });
      } else {
        result = await peerReviewService.submitPrompt({
          title: formData.title,
          workflow: formData.workflow,
          role: formData.role,
          description: formData.description,
          promptText: formData.promptText,
          sampleOutput: formData.sampleOutput,
          requiredApprovals: formData.requiredApprovals,
          reviewerLevel: formData.reviewerLevel,
        });
      }

      if (result.error) {
        setError(result.error.message);
      } else if (result.id) {
        onSuccess?.(result.id);
        onClose();
        setFormData({
          title: '',
          workflow: 'Standard Review',
          role: '',
          description: '',
          promptText: '',
          sampleOutput: '',
          requiredApprovals: 2,
          reviewerLevel: 'senior',
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {isResubmission ? 'Resubmit Prompt' : 'Submit New Prompt for Review'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prompt Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Customer Support Email Template"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Workflow Type *
              </label>
              <select
                value={formData.workflow}
                onChange={(e) => setFormData({ ...formData, workflow: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {workflows.map((workflow) => (
                  <option key={workflow} value={workflow}>
                    {workflow}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select a role</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Brief description of the prompt's purpose and use case"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prompt Text *
            </label>
            <textarea
              value={formData.promptText}
              onChange={(e) => setFormData({ ...formData, promptText: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              rows={8}
              placeholder="Enter the complete prompt text here..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sample Output *
            </label>
            <textarea
              value={formData.sampleOutput}
              onChange={(e) => setFormData({ ...formData, sampleOutput: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={5}
              placeholder="Provide an example of expected output from this prompt"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Required Approvals
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={formData.requiredApprovals}
                onChange={(e) =>
                  setFormData({ ...formData, requiredApprovals: parseInt(e.target.value) })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reviewer Level
              </label>
              <select
                value={formData.reviewerLevel}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    reviewerLevel: e.target.value as 'junior' | 'senior' | 'expert' | 'any',
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {reviewerLevels.map((level) => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {isSubmitting
                ? 'Submitting...'
                : isResubmission
                ? 'Resubmit for Review'
                : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
