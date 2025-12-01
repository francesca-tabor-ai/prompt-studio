import { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PromptFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PromptFormModal({
  isOpen,
  onClose,
  onSuccess,
}: PromptFormModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    role: '',
    department: '',
    workflow: 'Standard',
    prompt_type: 'instruction',
    tags: [] as string[],
  });

  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles = [
    'Customer Support',
    'Sales',
    'Marketing',
    'Technical Support',
    'Product Management',
    'Content Creation',
    'Data Analysis',
    'Engineering',
    'HR',
    'Finance',
    'Legal',
    'Other',
  ];

  const departments = [
    'Customer Success',
    'Sales',
    'Marketing',
    'Engineering',
    'Product',
    'Operations',
    'Finance',
    'HR',
    'Legal',
    'IT',
    'Other',
  ];

  const workflows = [
    'Standard',
    'Expedited',
    'Enterprise',
    'Collaborative',
  ];

  const promptTypes = [
    'instruction',
    'question',
    'completion',
    'chat',
    'classification',
    'extraction',
    'summarization',
    'translation',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('You must be logged in to create a prompt');
      }

      const { error: insertError } = await supabase
        .from('prompts')
        .insert({
          title: formData.title,
          description: formData.description,
          content: formData.content,
          role: formData.role,
          department: formData.department,
          workflow: formData.workflow,
          prompt_type: formData.prompt_type,
          status: 'draft',
          created_by: user.id,
          author_id: user.id,
          tags: formData.tags,
          visibility: 'private',
          is_archived: false,
          usage_count: 0,
          rating_count: 0,
        });

      if (insertError) throw insertError;

      onSuccess?.();
      onClose();

      setFormData({
        title: '',
        description: '',
        content: '',
        role: '',
        department: '',
        workflow: 'Standard',
        prompt_type: 'instruction',
        tags: [],
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create prompt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!formData.tags.includes(tagInput.trim())) {
        setFormData(prev => ({
          ...prev,
          tags: [...prev.tags, tagInput.trim()],
        }));
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-jungle-green to-light-sea-green">
          <h2 className="text-xl font-semibold text-white">Create New Prompt</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-light-sea-green focus:border-transparent"
                placeholder="Enter prompt title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-light-sea-green focus:border-transparent"
                placeholder="Brief description of what this prompt does"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prompt Content *
              </label>
              <textarea
                required
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-light-sea-green focus:border-transparent font-mono text-sm"
                placeholder="Enter your prompt text here..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-light-sea-green focus:border-transparent"
                >
                  <option value="">Select role</option>
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department *
                </label>
                <select
                  required
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-light-sea-green focus:border-transparent"
                >
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workflow
                </label>
                <select
                  value={formData.workflow}
                  onChange={(e) => setFormData({ ...formData, workflow: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-light-sea-green focus:border-transparent"
                >
                  {workflows.map((workflow) => (
                    <option key={workflow} value={workflow}>
                      {workflow}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prompt Type
                </label>
                <select
                  value={formData.prompt_type}
                  onChange={(e) => setFormData({ ...formData, prompt_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-light-sea-green focus:border-transparent"
                >
                  {promptTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags
              </label>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-light-sea-green focus:border-transparent"
                placeholder="Type a tag and press Enter"
              />
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-light-sea-green bg-opacity-10 text-light-sea-green rounded-full text-sm flex items-center gap-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-jungle-green"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-gradient-to-r from-jungle-green to-light-sea-green hover:from-light-sea-green hover:to-jungle-green text-white rounded-lg transition-all duration-200 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Create Prompt
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
