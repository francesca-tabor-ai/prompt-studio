import React, { useState } from 'react';
import { Clock, GitCommit, RotateCcw, GitCompare } from 'lucide-react';
import type { PromptVersion } from '../api/types';

interface VersionHistoryProps {
  versions: PromptVersion[];
  currentVersionId?: string;
  onRevert?: (versionId: string) => void;
  onCompare?: (versionAId: string, versionBId: string) => void;
}

export function VersionHistory({
  versions,
  currentVersionId,
  onRevert,
  onCompare,
}: VersionHistoryProps) {
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);

  const handleSelectForComparison = (versionId: string) => {
    if (selectedForComparison.includes(versionId)) {
      setSelectedForComparison(selectedForComparison.filter((id) => id !== versionId));
    } else if (selectedForComparison.length < 2) {
      setSelectedForComparison([...selectedForComparison, versionId]);
    }
  };

  const handleCompare = () => {
    if (selectedForComparison.length === 2 && onCompare) {
      onCompare(selectedForComparison[0], selectedForComparison[1]);
      setSelectedForComparison([]);
    }
  };

  const getChangeTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      major: 'bg-red-100 text-red-700',
      minor: 'bg-yellow-100 text-yellow-700',
      patch: 'bg-green-100 text-green-700',
      rollback: 'bg-purple-100 text-purple-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="version-history bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Version History</h2>
          </div>

          {selectedForComparison.length === 2 && (
            <button
              onClick={handleCompare}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <GitCompare className="w-4 h-4" />
              Compare Selected
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {versions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No version history available</div>
        ) : (
          <div className="space-y-4">
            {versions.map((version) => (
              <div
                key={version.id}
                className={`border rounded-lg p-4 transition-all ${
                  selectedForComparison.includes(version.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${currentVersionId === version.id ? 'ring-2 ring-green-500' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <GitCommit className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-gray-900">
                        Version {version.version_number}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${getChangeTypeColor(version.change_type)}`}>
                        {version.change_type}
                      </span>
                      {currentVersionId === version.id && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          Current
                        </span>
                      )}
                    </div>

                    <h3 className="font-medium text-gray-900 mb-1">{version.title}</h3>

                    {version.change_summary && (
                      <p className="text-sm text-gray-600 mb-2">{version.change_summary}</p>
                    )}

                    <div className="text-xs text-gray-500">
                      {new Date(version.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleSelectForComparison(version.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        selectedForComparison.includes(version.id)
                          ? 'bg-blue-100 text-blue-600'
                          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                      }`}
                      title="Select for comparison"
                      disabled={
                        selectedForComparison.length >= 2 &&
                        !selectedForComparison.includes(version.id)
                      }
                    >
                      <GitCompare className="w-4 h-4" />
                    </button>

                    {currentVersionId !== version.id && onRevert && (
                      <button
                        onClick={() => onRevert(version.id)}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Revert to this version"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {version.metadata && Object.keys(version.metadata).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                        Additional Details
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto">
                        {JSON.stringify(version.metadata, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
