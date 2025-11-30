import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Filter,
  Search,
  Users,
  FileText,
  MoreVertical,
  Eye,
  MessageSquare,
} from 'lucide-react';
import { approvalWorkflowService } from '../services/approvalWorkflowService';

export function AdminApprovalPanel() {
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: 'pending', slaBreach: false });
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [activeReview, setActiveReview] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(() => {
      approvalWorkflowService.checkSLACompliance();
    }, 60000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const items = await approvalWorkflowService.getApprovalQueue(filter);
      setQueueItems(items);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === queueItems.length) {
      setSelectedItems(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedItems(new Set(queueItems.map((item) => item.id)));
      setShowBulkActions(true);
    }
  };

  const handleBulkApprove = async () => {
    if (!confirm(`Approve ${selectedItems.size} prompts?`)) return;

    const result = await approvalWorkflowService.bulkApprove(Array.from(selectedItems));
    alert(`Approved: ${result.succeeded}, Failed: ${result.failed}`);
    setSelectedItems(new Set());
    setShowBulkActions(false);
    await loadQueue();
  };

  const handleBulkReject = async () => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    const result = await approvalWorkflowService.bulkReject(Array.from(selectedItems), reason);
    alert(`Rejected: ${result.succeeded}, Failed: ${result.failed}`);
    setSelectedItems(new Set());
    setShowBulkActions(false);
    await loadQueue();
  };

  const handleApprove = async (queueId: string) => {
    try {
      await approvalWorkflowService.processApprovalAction(queueId, {
        actionType: 'approve',
        decision: 'approved',
        approvalScope: 'full',
      });
      alert('Prompt approved successfully');
      await loadQueue();
    } catch (error) {
      alert('Failed to approve prompt');
    }
  };

  const handleReject = async (queueId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      await approvalWorkflowService.processApprovalAction(queueId, {
        actionType: 'reject',
        decision: 'rejected',
        reason,
      });
      alert('Prompt rejected');
      await loadQueue();
    } catch (error) {
      alert('Failed to reject prompt');
    }
  };

  const handleRequestRevision = async (queueId: string) => {
    const changes = prompt('Enter requested changes (comma-separated):');
    if (!changes) return;

    const feedback = prompt('Detailed feedback (optional):');

    try {
      await approvalWorkflowService.requestRevision(
        queueId,
        'content',
        changes.split(',').map((c) => c.trim()),
        feedback || undefined,
        'normal'
      );
      alert('Revision requested');
      await loadQueue();
    } catch (error) {
      alert('Failed to request revision');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string; icon: any }> = {
      pending: { color: 'bg-yellow-100 text-yellow-700', label: 'Pending', icon: Clock },
      in_review: { color: 'bg-blue-100 text-blue-700', label: 'In Review', icon: Eye },
      revision_requested: { color: 'bg-orange-100 text-orange-700', label: 'Revision Needed', icon: MessageSquare },
      approved: { color: 'bg-green-100 text-green-700', label: 'Approved', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-700', label: 'Rejected', icon: XCircle },
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'text-red-600 font-bold';
    if (priority >= 6) return 'text-orange-600 font-semibold';
    return 'text-gray-600';
  };

  const getTimeRemaining = (deadline?: string) => {
    if (!deadline) return null;

    const now = new Date();
    const deadlineDate = new Date(deadline);
    const hoursRemaining = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursRemaining < 0) {
      return (
        <span className="text-red-600 font-semibold flex items-center gap-1">
          <AlertTriangle className="w-4 h-4" />
          {Math.abs(hoursRemaining).toFixed(0)}h overdue
        </span>
      );
    }

    if (hoursRemaining < 6) {
      return <span className="text-orange-600 font-semibold">{hoursRemaining.toFixed(0)}h remaining</span>;
    }

    return <span className="text-gray-600">{hoursRemaining.toFixed(0)}h remaining</span>;
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Approval Queue</h2>
          <p className="text-gray-600">Review and manage prompt submissions</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">{queueItems.length} items</span>
          {filter.slaBreach && (
            <span className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded-full">
              {queueItems.filter((i) => i.isSlaBreach).length} SLA breaches
            </span>
          )}
        </div>
      </div>

      {showBulkActions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedItems.size} item(s) selected
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Approve All
              </button>

              <button
                onClick={handleBulkReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Reject All
              </button>

              <button
                onClick={() => {
                  setSelectedItems(new Set());
                  setShowBulkActions(false);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-400" />

          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="pending">Pending</option>
            <option value="in_review">In Review</option>
            <option value="revision_requested">Revision Requested</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filter.slaBreach}
              onChange={(e) => setFilter({ ...filter, slaBreach: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span className="text-gray-700">Show SLA Breaches Only</span>
          </label>

          <button
            onClick={loadQueue}
            className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedItems.size === queueItems.length && queueItems.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Priority</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Prompt</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Department</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">SLA</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Submitted</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {queueItems.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => handleSelectItem(item.id)}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm ${getPriorityColor(item.priority)}`}>P{item.priority}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">Prompt #{item.promptId.slice(0, 8)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                    {item.requiresTesting && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Testing</span>}
                    {item.requiresPeerReview && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">Peer Review</span>}
                  </div>
                </td>
                <td className="px-4 py-3">{getStatusBadge(item.queueStatus)}</td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">{item.department || 'N/A'}</span>
                </td>
                <td className="px-4 py-3">
                  {item.isSlaBreach ? (
                    <span className="text-red-600 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Breached
                    </span>
                  ) : (
                    getTimeRemaining(item.slaDeadline)
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600">
                    {new Date(item.submittedAt).toLocaleDateString()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {item.queueStatus === 'pending' || item.queueStatus === 'in_review' ? (
                      <>
                        <button
                          onClick={() => handleApprove(item.id)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Approve"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => handleReject(item.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Reject"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => handleRequestRevision(item.id)}
                          className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                          title="Request Revision"
                        >
                          <MessageSquare className="w-5 h-5" />
                        </button>
                      </>
                    ) : (
                      <button className="p-1 text-gray-400 hover:bg-gray-50 rounded" title="View Details">
                        <Eye className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {queueItems.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No items in the approval queue</p>
          </div>
        )}
      </div>
    </div>
  );
}
