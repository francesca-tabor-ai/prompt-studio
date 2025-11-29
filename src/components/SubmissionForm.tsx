import { Send, FileText } from 'lucide-react';
import { useState } from 'react';

interface SubmissionFormProps {
  onSubmit: (submission: {
    title: string;
    workflow: string;
    role: string;
    prompt_content: string;
    sample_output: string;
    submitter_name: string;
  }) => void;
}

export default function SubmissionForm({ onSubmit }: SubmissionFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    workflow: '',
    role: '',
    prompt_content: '',
    sample_output: '',
    submitter_name: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      formData.title &&
      formData.workflow &&
      formData.role &&
      formData.prompt_content &&
      formData.sample_output &&
      formData.submitter_name
    ) {
      onSubmit(formData);
      setFormData({
        title: '',
        workflow: '',
        role: '',
        prompt_content: '',
        sample_output: '',
        submitter_name: '',
      });
    }
  };

  const workflows = [
    'Customer Support',
    'Sales & Marketing',
    'Content Creation',
    'Data Analysis',
    'Code Development',
    'Project Management',
    'HR & Recruitment',
    'Other',
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-light-sea-green to-jungle-green">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl text-white">SUBMIT NEW PROMPT</h3>
            <p className="text-sm text-white/80">Share your prompt with the community for review</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Prompt Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Customer Support Response Template"
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Your Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.submitter_name}
              onChange={(e) => setFormData({ ...formData, submitter_name: e.target.value })}
              placeholder="e.g., John Doe"
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 text-sm"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Workflow Category <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.workflow}
              onChange={(e) => setFormData({ ...formData, workflow: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 text-sm"
              required
            >
              <option value="">Select workflow...</option>
              {workflows.map((workflow) => (
                <option key={workflow} value={workflow}>
                  {workflow}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Target Role <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              placeholder="e.g., Customer Service Agent"
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 text-sm"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Prompt Content <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.prompt_content}
            onChange={(e) => setFormData({ ...formData, prompt_content: e.target.value })}
            placeholder="Enter your prompt here...&#10;&#10;Example:&#10;You are a helpful customer service agent. When responding to customer inquiries:&#10;1. Be empathetic and professional&#10;2. Address their concern directly&#10;3. Provide clear next steps"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 resize-none text-sm font-mono"
            rows={8}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Sample Output <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.sample_output}
            onChange={(e) => setFormData({ ...formData, sample_output: e.target.value })}
            placeholder="Provide an example of expected output from this prompt...&#10;&#10;Example:&#10;Thank you for contacting us about your billing concern. I understand your frustration, and I'm here to help. Let me review your account and get back to you within 24 hours with a resolution."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 resize-none text-sm"
            rows={6}
            required
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <span className="text-red-500">*</span> Required fields
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-jungle-green to-light-sea-green hover:from-light-sea-green hover:to-jungle-green text-white rounded-lg transition-all duration-200 font-semibold flex items-center gap-2 shadow-md hover:shadow-lg"
          >
            <Send className="w-5 h-5" />
            Submit for Review
          </button>
        </div>
      </form>
    </div>
  );
}
