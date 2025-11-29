import { Star, MessageSquare, ThumbsUp, AlertCircle, Send, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { PromptReview, PromptSubmission } from '../services/collaborationService';

interface ReviewPanelProps {
  submission: PromptSubmission;
  existingReviews: PromptReview[];
  onSubmitReview: (review: {
    reviewer_name: string;
    accuracy_rating: number;
    clarity_rating: number;
    usefulness_rating: number;
    comment: string;
    action: 'approve' | 'request_changes' | 'none';
  }) => void;
  onApprove: () => void;
  onRequestChanges: () => void;
  onSendToSandbox: () => void;
}

export default function ReviewPanel({
  submission,
  existingReviews,
  onSubmitReview,
  onApprove,
  onRequestChanges,
  onSendToSandbox,
}: ReviewPanelProps) {
  const [reviewerName, setReviewerName] = useState('');
  const [accuracyRating, setAccuracyRating] = useState(0);
  const [clarityRating, setClarityRating] = useState(0);
  const [usefulnessRating, setUsefulnessRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedAction, setSelectedAction] = useState<'approve' | 'request_changes' | 'none'>('none');

  const handleSubmit = () => {
    if (reviewerName && accuracyRating && clarityRating && usefulnessRating && comment) {
      onSubmitReview({
        reviewer_name: reviewerName,
        accuracy_rating: accuracyRating,
        clarity_rating: clarityRating,
        usefulness_rating: usefulnessRating,
        comment,
        action: selectedAction,
      });
      setReviewerName('');
      setAccuracyRating(0);
      setClarityRating(0);
      setUsefulnessRating(0);
      setComment('');
      setSelectedAction('none');
    }
  };

  const renderStars = (
    rating: number,
    setRating: (rating: number) => void,
    readonly = false
  ) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => !readonly && setRating(star)}
            className={`transition-all duration-200 ${
              readonly ? 'cursor-default' : 'hover:scale-110'
            }`}
            disabled={readonly}
          >
            <Star
              className={`w-5 h-5 ${
                star <= rating
                  ? 'fill-green-yellow text-green-yellow'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const averageRatings = existingReviews.length
    ? {
        accuracy:
          existingReviews.reduce((sum, r) => sum + r.accuracy_rating, 0) /
          existingReviews.length,
        clarity:
          existingReviews.reduce((sum, r) => sum + r.clarity_rating, 0) /
          existingReviews.length,
        usefulness:
          existingReviews.reduce((sum, r) => sum + r.usefulness_rating, 0) /
          existingReviews.length,
      }
    : null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'changes_requested':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'pending':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-yale-blue to-space-cadet">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl text-white">PEER REVIEW</h3>
                <p className="text-sm text-white/80">
                  {existingReviews.length} review{existingReviews.length !== 1 ? 's' : ''} submitted
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-lg text-sm font-semibold border ${getStatusColor(
                submission.status
              )}`}
            >
              {submission.status.toUpperCase().replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {averageRatings && (
            <div className="bg-gradient-to-r from-green-yellow/10 to-jungle-green/10 rounded-lg p-4 border border-green-yellow/20">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Average Ratings</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-gray-600 mb-1">Accuracy</div>
                  {renderStars(Math.round(averageRatings.accuracy), () => {}, true)}
                  <div className="text-xs text-gray-500 mt-1">
                    {averageRatings.accuracy.toFixed(1)} / 5
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">Clarity</div>
                  {renderStars(Math.round(averageRatings.clarity), () => {}, true)}
                  <div className="text-xs text-gray-500 mt-1">
                    {averageRatings.clarity.toFixed(1)} / 5
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">Usefulness</div>
                  {renderStars(Math.round(averageRatings.usefulness), () => {}, true)}
                  <div className="text-xs text-gray-500 mt-1">
                    {averageRatings.usefulness.toFixed(1)} / 5
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">Add Your Review</h4>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Your Name</label>
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Accuracy</label>
                {renderStars(accuracyRating, setAccuracyRating)}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Clarity</label>
                {renderStars(clarityRating, setClarityRating)}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Usefulness
                </label>
                {renderStars(usefulnessRating, setUsefulnessRating)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Comment</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your feedback on this prompt..."
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent text-sm resize-none"
                rows={4}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Recommendation
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAction('approve')}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all duration-200 text-sm font-medium ${
                    selectedAction === 'approve'
                      ? 'bg-green-100 border-green-500 text-green-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-green-300'
                  }`}
                >
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAction('request_changes')}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all duration-200 text-sm font-medium ${
                    selectedAction === 'request_changes'
                      ? 'bg-yellow-100 border-yellow-500 text-yellow-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-yellow-300'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  Request Changes
                </button>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={
                !reviewerName || !accuracyRating || !clarityRating || !usefulnessRating || !comment
              }
              className="w-full px-4 py-3 bg-gradient-to-r from-jungle-green to-light-sea-green hover:from-light-sea-green hover:to-jungle-green text-white rounded-lg transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Submit Review
            </button>
          </div>

          {existingReviews.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Previous Reviews</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {existingReviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-sm text-gray-900">
                          {review.reviewer_name}
                        </div>
                        <div className="text-xs text-gray-600">
                          {new Date(review.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {review.action !== 'none' && (
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            review.action === 'approve'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {review.action === 'approve' ? 'Approved' : 'Changes Requested'}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div className="text-xs">
                        <span className="text-gray-600">Accuracy:</span>{' '}
                        <span className="font-semibold">{review.accuracy_rating}/5</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-600">Clarity:</span>{' '}
                        <span className="font-semibold">{review.clarity_rating}/5</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-600">Usefulness:</span>{' '}
                        <span className="font-semibold">{review.usefulness_rating}/5</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{review.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Actions</h4>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={onApprove}
            className="px-4 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-600 text-white rounded-lg transition-all duration-200 font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            <ThumbsUp className="w-4 h-4" />
            Approve
          </button>
          <button
            onClick={onRequestChanges}
            className="px-4 py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white rounded-lg transition-all duration-200 font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            <AlertCircle className="w-4 h-4" />
            Request Changes
          </button>
          <button
            onClick={onSendToSandbox}
            className="px-4 py-3 bg-gradient-to-r from-space-cadet to-yale-blue hover:from-yale-blue hover:to-space-cadet text-white rounded-lg transition-all duration-200 font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            <CheckCircle className="w-4 h-4" />
            Send to Sandbox
          </button>
        </div>
      </div>
    </div>
  );
}
