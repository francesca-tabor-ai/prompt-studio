import React, { useState, useEffect } from 'react';
import { MessageCircle, Reply, CheckCircle, MoreVertical } from 'lucide-react';
import { peerReviewService } from '../services/peerReviewService';
import { supabase } from '../lib/supabase';

interface Comment {
  id: string;
  submission_id: string;
  review_id?: string;
  parent_comment_id?: string;
  commenter_id: string;
  commenter_name: string;
  commenter_role?: string;
  comment_text: string;
  comment_type: string;
  is_resolved: boolean;
  thread_depth: number;
  created_at: string;
  updated_at: string;
  replies?: Comment[];
}

interface ThreadedCommentsProps {
  submissionId: string;
  reviewId?: string;
}

export function ThreadedComments({ submissionId, reviewId }: ThreadedCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commentType, setCommentType] = useState<'general' | 'question' | 'suggestion' | 'concern' | 'praise'>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComments();
  }, [submissionId]);

  const loadComments = async () => {
    try {
      const { data } = await supabase
        .from('submission_comments')
        .select('*')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: true });

      if (data) {
        const threaded = buildCommentTree(data);
        setComments(threaded);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildCommentTree = (flatComments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    flatComments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    flatComments.forEach((comment) => {
      const commentNode = commentMap.get(comment.id)!;
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id);
        if (parent) {
          parent.replies!.push(commentNode);
        }
      } else {
        rootComments.push(commentNode);
      }
    });

    return rootComments;
  };

  const handleSubmitComment = async (parentId?: string) => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await peerReviewService.addComment({
        submissionId,
        reviewId,
        parentCommentId: parentId,
        commentText: newComment,
        commentType,
      });

      if (result.id) {
        setNewComment('');
        setReplyingTo(null);
        setCommentType('general');
        await loadComments();
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const CommentTypeIcon = ({ type }: { type: string }) => {
    const icons = {
      question: '❓',
      suggestion: '💡',
      concern: '⚠️',
      praise: '👍',
      general: '💬',
    };
    return <span className="text-lg">{icons[type as keyof typeof icons] || icons.general}</span>;
  };

  const CommentNode = ({ comment, depth = 0 }: { comment: Comment; depth?: number }) => {
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyText, setReplyText] = useState('');
    const canReply = depth < 5;

    const handleReply = async () => {
      if (!replyText.trim()) return;

      setIsSubmitting(true);
      try {
        const result = await peerReviewService.addComment({
          submissionId,
          reviewId,
          parentCommentId: comment.id,
          commentText: replyText,
          commentType: 'general',
        });

        if (result.id) {
          setReplyText('');
          setShowReplyForm(false);
          await loadComments();
        }
      } catch (error) {
        console.error('Error submitting reply:', error);
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div
        className={`${depth > 0 ? 'ml-8 mt-4 border-l-2 border-gray-200 pl-4' : 'mb-4'}`}
      >
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
              {comment.commenter_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-900">{comment.commenter_name}</span>
                <CommentTypeIcon type={comment.comment_type} />
                {comment.commenter_role && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {comment.commenter_role}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {new Date(comment.created_at).toLocaleString()}
                </span>
                {comment.is_resolved && (
                  <div className="flex items-center gap-1 text-green-600 text-xs">
                    <CheckCircle className="w-3 h-3" />
                    <span>Resolved</span>
                  </div>
                )}
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{comment.comment_text}</p>
              {canReply && (
                <div className="flex items-center gap-4 mt-2">
                  <button
                    onClick={() => setShowReplyForm(!showReplyForm)}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Reply className="w-4 h-4" />
                    Reply
                  </button>
                </div>
              )}
            </div>
          </div>

          {showReplyForm && (
            <div className="mt-4 ml-13">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                rows={3}
                placeholder="Write a reply..."
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleReply}
                  disabled={isSubmitting || !replyText.trim()}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Posting...' : 'Post Reply'}
                </button>
                <button
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyText('');
                  }}
                  className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map((reply) => (
              <CommentNode key={reply.id} comment={reply} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Discussion ({comments.length})
        </h3>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comment Type
            </label>
            <select
              value={commentType}
              onChange={(e) => setCommentType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="general">💬 General Comment</option>
              <option value="question">❓ Question</option>
              <option value="suggestion">💡 Suggestion</option>
              <option value="concern">⚠️ Concern</option>
              <option value="praise">👍 Praise</option>
            </select>
          </div>

          <div>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              placeholder="Share your thoughts, ask questions, or provide feedback..."
            />
          </div>

          <button
            onClick={() => handleSubmitComment()}
            disabled={isSubmitting || !newComment.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>

        <div className="border-t pt-6">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No comments yet. Be the first to share your thoughts!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <CommentNode key={comment.id} comment={comment} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
