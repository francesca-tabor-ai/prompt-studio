import React, { useState, useEffect } from 'react';
import { History, User, Calendar, FileText, Filter, Download } from 'lucide-react';
import { peerReviewService } from '../services/peerReviewService';

interface AuditEntry {
  id: string;
  submission_id: string;
  actor_id?: string;
  actor_email: string;
  actor_role?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_value?: any;
  new_value?: any;
  changes?: any;
  reason?: string;
  metadata?: any;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
}

interface AuditTrailViewerProps {
  submissionId: string;
}

export function AuditTrailViewer({ submissionId }: AuditTrailViewerProps) {
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  useEffect(() => {
    loadAuditLog();
  }, [submissionId]);

  const loadAuditLog = async () => {
    try {
      const data = await peerReviewService.getSubmissionAuditLog(submissionId);
      setAuditLog(data || []);
    } catch (error) {
      console.error('Error loading audit log:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    const icons: Record<string, string> = {
      created: '📝',
      updated: '✏️',
      deleted: '🗑️',
      submitted: '📤',
      assigned: '👥',
      reviewed: '✅',
      commented: '💬',
      approved: '✓',
      rejected: '✗',
      resubmitted: '🔄',
      published: '🚀',
      withdrawn: '⏸️',
    };
    return icons[action] || '•';
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      created: 'bg-blue-100 text-blue-700',
      updated: 'bg-indigo-100 text-indigo-700',
      deleted: 'bg-red-100 text-red-700',
      submitted: 'bg-purple-100 text-purple-700',
      assigned: 'bg-cyan-100 text-cyan-700',
      reviewed: 'bg-green-100 text-green-700',
      commented: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-rose-100 text-rose-700',
      resubmitted: 'bg-orange-100 text-orange-700',
      published: 'bg-violet-100 text-violet-700',
      withdrawn: 'bg-gray-100 text-gray-700',
    };
    return colors[action] || 'bg-gray-100 text-gray-700';
  };

  const getEntityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      submission: 'Submission',
      review: 'Review',
      comment: 'Comment',
      approval: 'Approval',
      assignment: 'Assignment',
      notification: 'Notification',
    };
    return labels[type] || type;
  };

  const exportAuditLog = () => {
    const csv = [
      ['Timestamp', 'Actor', 'Action', 'Entity Type', 'Details'].join(','),
      ...auditLog.map((entry) =>
        [
          new Date(entry.created_at).toISOString(),
          entry.actor_email,
          entry.action,
          entry.entity_type,
          entry.reason || '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${submissionId}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLog =
    filter === 'all' ? auditLog : auditLog.filter((entry) => entry.action === filter);

  const uniqueActions = Array.from(new Set(auditLog.map((e) => e.action)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <History className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Audit Trail</h3>
              <p className="text-sm text-gray-600">
                Complete history of all actions ({filteredLog.length} entries)
              </p>
            </div>
          </div>

          <button
            onClick={exportAuditLog}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-500" />
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All
          </button>
          {uniqueActions.map((action) => (
            <button
              key={action}
              onClick={() => setFilter(action)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                filter === action
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {getActionIcon(action)} {action}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {filteredLog.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-600">No audit entries found</p>
          </div>
        ) : (
          filteredLog.map((entry) => (
            <div key={entry.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div
                    className={`w-10 h-10 rounded-lg ${getActionColor(
                      entry.action
                    )} flex items-center justify-center text-lg font-semibold`}
                  >
                    {getActionIcon(entry.action)}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(entry.action)}`}>
                      {entry.action}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {getEntityTypeLabel(entry.entity_type)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {entry.actor_email}
                      {entry.actor_role && (
                        <span className="text-xs text-gray-500">({entry.actor_role})</span>
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>

                  {entry.reason && (
                    <p className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">Reason:</span> {entry.reason}
                    </p>
                  )}

                  {(entry.changes || entry.old_value || entry.new_value) && (
                    <button
                      onClick={() =>
                        setExpandedEntry(expandedEntry === entry.id ? null : entry.id)
                      }
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      {expandedEntry === entry.id ? 'Hide details' : 'View details'}
                    </button>
                  )}

                  {expandedEntry === entry.id && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs">
                      {entry.changes && Object.keys(entry.changes).length > 0 && (
                        <div className="mb-2">
                          <span className="font-medium text-gray-700">Changes:</span>
                          <pre className="mt-1 text-gray-600 whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(entry.changes, null, 2)}
                          </pre>
                        </div>
                      )}

                      {entry.old_value && (
                        <div className="mb-2">
                          <span className="font-medium text-gray-700">Previous Value:</span>
                          <pre className="mt-1 text-gray-600 whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(entry.old_value, null, 2)}
                          </pre>
                        </div>
                      )}

                      {entry.new_value && (
                        <div>
                          <span className="font-medium text-gray-700">New Value:</span>
                          <pre className="mt-1 text-gray-600 whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(entry.new_value, null, 2)}
                          </pre>
                        </div>
                      )}

                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <span className="font-medium text-gray-700">Metadata:</span>
                          <pre className="mt-1 text-gray-600 whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </div>
                      )}

                      {entry.ip_address && (
                        <div className="mt-2 pt-2 border-t border-gray-200 text-gray-600">
                          <span className="font-medium">IP:</span> {entry.ip_address}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
