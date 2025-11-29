import React, { useState, useEffect } from 'react';
import { GitBranch, Plus, Trash2, GitMerge } from 'lucide-react';
import { versionControlApi, type PromptBranch } from '../api/versionControlApi';

interface BranchManagerProps {
  promptId: string;
  currentVersionId?: string;
}

export function BranchManager({ promptId, currentVersionId }: BranchManagerProps) {
  const [branches, setBranches] = useState<PromptBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchDescription, setNewBranchDescription] = useState('');

  useEffect(() => {
    loadBranches();
  }, [promptId]);

  const loadBranches = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await versionControlApi.listBranches(promptId);
      setBranches(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newBranchName.trim() || !currentVersionId) {
      return;
    }

    try {
      await versionControlApi.createBranch({
        prompt_id: promptId,
        branch_name: newBranchName.trim(),
        description: newBranchDescription.trim(),
        base_version_id: currentVersionId,
      });

      setNewBranchName('');
      setNewBranchDescription('');
      setShowCreateForm(false);
      loadBranches();
    } catch (err: any) {
      setError(err.message || 'Failed to create branch');
    }
  };

  const handleMergeBranch = async (branchId: string) => {
    if (!confirm('Are you sure you want to merge this branch?')) {
      return;
    }

    try {
      await versionControlApi.mergeBranch(branchId);
      loadBranches();
    } catch (err: any) {
      setError(err.message || 'Failed to merge branch');
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!confirm('Are you sure you want to delete this branch?')) {
      return;
    }

    try {
      await versionControlApi.deleteBranch(branchId);
      loadBranches();
    } catch (err: any) {
      setError(err.message || 'Failed to delete branch');
    }
  };

  return (
    <div className="branch-manager bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Branches</h2>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Branch
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreateBranch} className="mb-6 bg-gray-50 rounded-lg p-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Branch Name
            </label>
            <input
              type="text"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="feature/new-variation"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={newBranchDescription}
              onChange={(e) => setNewBranchDescription(e.target.value)}
              placeholder="Describe the purpose of this branch..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Branch
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setNewBranchName('');
                setNewBranchDescription('');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading branches...</div>
      ) : branches.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No branches yet. Create your first branch to experiment with variations.
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <GitBranch className="w-4 h-4 text-gray-400" />
                    <h3 className="font-semibold text-gray-900">{branch.branch_name}</h3>
                    {branch.is_merged && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                        Merged
                      </span>
                    )}
                    {branch.is_active && !branch.is_merged && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                        Active
                      </span>
                    )}
                  </div>

                  {branch.description && (
                    <p className="text-sm text-gray-600 mb-2">{branch.description}</p>
                  )}

                  <div className="text-xs text-gray-500">
                    Created {new Date(branch.created_at).toLocaleDateString()}
                    {branch.merged_at && (
                      <span className="ml-2">
                        • Merged {new Date(branch.merged_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {branch.is_active && !branch.is_merged && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMergeBranch(branch.id)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Merge branch"
                    >
                      <GitMerge className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBranch(branch.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete branch"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
