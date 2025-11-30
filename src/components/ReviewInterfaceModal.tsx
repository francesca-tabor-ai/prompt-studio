import React, { useState } from 'react';
import { X, Star, ThumbsUp, ThumbsDown, AlertTriangle, Send } from 'lucide-react';
import { peerReviewService } from '../services/peerReviewService';

interface ReviewInterfaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: any;
  onSuccess?: () => void;
}

export function ReviewInterfaceModal({
  isOpen,
  onClose,
  submission,
  onSuccess,
}: ReviewInterfaceModalProps) {
  const [ratings, setRatings] = useState({
    accuracy: 0,
    clarity: 0,
    usefulness: 0,
    completeness: 0,
    overall: 0,
  });

  const [feedback, setFeedback] = useState({
    strengths: '',
    weaknesses: '',
    suggestions: '',
    detailedFeedback: '',
  });

  const [recommendation, setRecommendation] = useState<'approve' | 'request_changes' | 'reject'>(
    'approve'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRatingChange = (category: keyof typeof ratings, value: number) => {
    setRatings({ ...ratings, [category]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      !ratings.accuracy ||
      !ratings.clarity ||
      !ratings.usefulness ||
      !ratings.completeness ||
      !ratings.overall
    ) {
      setError('Please provide all ratings');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await peerReviewService.submitReview({
        submissionId: submission.id,
        accuracyRating: ratings.accuracy,
        clarityRating: ratings.clarity,
        usefulnessRating: ratings.usefulness,
        completenessRating: ratings.completeness,
        overallRating: ratings.overall,
        strengths: feedback.strengths,
        weaknesses: feedback.weaknesses,
        suggestions: feedback.suggestions,
        detailedFeedback: feedback.detailedFeedback,
        recommendation,
      });

      if (result.error) {
        setError(result.error.message);
      } else {
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const RatingStars = ({
    value,
    onChange,
    label,
  }: {
    value: number;
    onChange: (value: number) => void;
    label: string;
  }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            <Star
              className={`w-6 h-6 ${
                star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );

  if (!isOpen || !submission) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Review Submission</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{submission.title}</h3>
            <div className="flex gap-4 text-sm text-gray-600 mb-4">
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                {submission.workflow}
              </span>
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full">
                {submission.role}
              </span>
            </div>
            <p className="text-gray-700 mb-4">{submission.description}</p>
            <div className="bg-white rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Prompt Text:</h4>
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                {submission.prompt_content}
              </pre>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Sample Output:</h4>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{submission.sample_output}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate the Prompt</h3>
              <RatingStars
                label="Accuracy"
                value={ratings.accuracy}
                onChange={(v) => handleRatingChange('accuracy', v)}
              />
              <RatingStars
                label="Clarity"
                value={ratings.clarity}
                onChange={(v) => handleRatingChange('clarity', v)}
              />
              <RatingStars
                label="Usefulness"
                value={ratings.usefulness}
                onChange={(v) => handleRatingChange('usefulness', v)}
              />
              <RatingStars
                label="Completeness"
                value={ratings.completeness}
                onChange={(v) => handleRatingChange('completeness', v)}
              />
              <div className="border-t pt-4 mt-4">
                <RatingStars
                  label="Overall Rating"
                  value={ratings.overall}
                  onChange={(v) => handleRatingChange('overall', v)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Strengths
              </label>
              <textarea
                value={feedback.strengths}
                onChange={(e) => setFeedback({ ...feedback, strengths: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="What works well in this prompt?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weaknesses
              </label>
              <textarea
                value={feedback.weaknesses}
                onChange={(e) => setFeedback({ ...feedback, weaknesses: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="What could be improved?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Suggestions for Improvement
              </label>
              <textarea
                value={feedback.suggestions}
                onChange={(e) => setFeedback({ ...feedback, suggestions: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Specific recommendations for improvement"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Detailed Feedback
              </label>
              <textarea
                value={feedback.detailedFeedback}
                onChange={(e) => setFeedback({ ...feedback, detailedFeedback: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={5}
                placeholder="Provide comprehensive feedback and context for your review"
              />
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendation</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-white transition-colors">
                  <input
                    type="radio"
                    name="recommendation"
                    value="approve"
                    checked={recommendation === 'approve'}
                    onChange={(e) =>
                      setRecommendation(e.target.value as 'approve' | 'request_changes' | 'reject')
                    }
                    className="w-4 h-4 text-blue-600"
                  />
                  <ThumbsUp className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="font-medium text-gray-900">Approve</div>
                    <div className="text-sm text-gray-600">
                      This prompt meets quality standards and is ready for use
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-white transition-colors">
                  <input
                    type="radio"
                    name="recommendation"
                    value="request_changes"
                    checked={recommendation === 'request_changes'}
                    onChange={(e) =>
                      setRecommendation(e.target.value as 'approve' | 'request_changes' | 'reject')
                    }
                    className="w-4 h-4 text-blue-600"
                  />
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <div>
                    <div className="font-medium text-gray-900">Request Changes</div>
                    <div className="text-sm text-gray-600">
                      This prompt needs revisions before approval
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-white transition-colors">
                  <input
                    type="radio"
                    name="recommendation"
                    value="reject"
                    checked={recommendation === 'reject'}
                    onChange={(e) =>
                      setRecommendation(e.target.value as 'approve' | 'request_changes' | 'reject')
                    }
                    className="w-4 h-4 text-blue-600"
                  />
                  <ThumbsDown className="w-5 h-5 text-red-600" />
                  <div>
                    <div className="font-medium text-gray-900">Reject</div>
                    <div className="text-sm text-gray-600">
                      This prompt does not meet quality standards
                    </div>
                  </div>
                </label>
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
                {isSubmitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
