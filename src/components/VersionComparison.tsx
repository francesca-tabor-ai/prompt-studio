import React, { useState, useEffect } from 'react';
import { versionControlApi, type VersionComparison as VersionComparisonType } from '../api/versionControlApi';

interface VersionComparisonProps {
  versionAId: string;
  versionBId: string;
  onClose?: () => void;
}

export function VersionComparison({ versionAId, versionBId, onClose }: VersionComparisonProps) {
  const [comparison, setComparison] = useState<VersionComparisonType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'unified' | 'side-by-side'>('unified');

  useEffect(() => {
    loadComparison();
  }, [versionAId, versionBId]);

  const loadComparison = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await versionControlApi.compareVersions(versionAId, versionBId);
      setComparison(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load comparison');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="version-comparison">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading comparison...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="version-comparison">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return null;
  }

  return (
    <div className="version-comparison bg-white rounded-lg shadow-lg">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Version Comparison</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Version A</h3>
            <p className="text-sm text-blue-700">{comparison.versionA.title}</p>
            <p className="text-xs text-blue-600 mt-1">
              {new Date(comparison.versionA.created_at).toLocaleString()}
            </p>
            <div className="mt-2 text-xs text-blue-600">
              <span className="mr-3">{comparison.versionA.lineCount} lines</span>
              <span>{comparison.versionA.characterCount} characters</span>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-2">Version B</h3>
            <p className="text-sm text-green-700">{comparison.versionB.title}</p>
            <p className="text-xs text-green-600 mt-1">
              {new Date(comparison.versionB.created_at).toLocaleString()}
            </p>
            <div className="mt-2 text-xs text-green-600">
              <span className="mr-3">{comparison.versionB.lineCount} lines</span>
              <span>{comparison.versionB.characterCount} characters</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-green-100 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-700">{comparison.changes.additions}</div>
            <div className="text-xs text-green-600">Additions</div>
          </div>
          <div className="bg-red-100 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-red-700">{comparison.changes.deletions}</div>
            <div className="text-xs text-red-600">Deletions</div>
          </div>
          <div className="bg-yellow-100 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-yellow-700">{comparison.changes.modifications}</div>
            <div className="text-xs text-yellow-600">Modifications</div>
          </div>
          <div className="bg-gray-100 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-700">{comparison.similarity}%</div>
            <div className="text-xs text-gray-600">Similarity</div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('unified')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'unified'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Unified View
          </button>
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'side-by-side'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Side-by-Side
          </button>
        </div>
      </div>

      <div className="p-6 overflow-auto max-h-96">
        {viewMode === 'unified' ? (
          <div
            className="diff-view font-mono text-sm"
            dangerouslySetInnerHTML={{ __html: comparison.html.unified }}
          />
        ) : (
          <div
            className="diff-side-by-side font-mono text-sm"
            dangerouslySetInnerHTML={{ __html: comparison.html.sideBySide }}
          />
        )}
      </div>

      <style>{`
        .diff-view {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 1rem;
        }

        .diff-line {
          padding: 2px 8px;
          margin: 1px 0;
          display: flex;
          gap: 12px;
        }

        .diff-line.diff-add {
          background-color: #d4edda;
          color: #155724;
        }

        .diff-line.diff-delete {
          background-color: #f8d7da;
          color: #721c24;
        }

        .diff-line.diff-modify {
          background-color: #fff3cd;
          color: #856404;
        }

        .line-number {
          color: #6c757d;
          min-width: 40px;
          text-align: right;
          user-select: none;
        }

        .line-content {
          flex: 1;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .diff-side-by-side table {
          width: 100%;
          border-collapse: collapse;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .diff-side-by-side td {
          padding: 2px 8px;
          border: 1px solid #dee2e6;
          vertical-align: top;
        }

        .diff-side-by-side .line-number {
          background: #e9ecef;
          color: #6c757d;
          width: 40px;
          text-align: center;
        }

        .diff-side-by-side .old-content {
          background: #fff;
          width: 48%;
        }

        .diff-side-by-side .new-content {
          background: #fff;
          width: 48%;
        }

        .diff-side-by-side tr.diff-add .new-content {
          background-color: #d4edda;
        }

        .diff-side-by-side tr.diff-delete .old-content {
          background-color: #f8d7da;
        }

        .diff-side-by-side tr.diff-modify .old-content,
        .diff-side-by-side tr.diff-modify .new-content {
          background-color: #fff3cd;
        }
      `}</style>
    </div>
  );
}

export function VersionComparisonModal({
  versionAId,
  versionBId,
  isOpen,
  onClose,
}: VersionComparisonProps & { isOpen: boolean }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="w-full max-w-6xl max-h-[90vh] overflow-auto">
        <VersionComparison versionAId={versionAId} versionBId={versionBId} onClose={onClose} />
      </div>
    </div>
  );
}
