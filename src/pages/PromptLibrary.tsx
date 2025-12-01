import { useState, useEffect } from 'react';
import { LayoutGrid, List, Plus, SlidersHorizontal, Search } from 'lucide-react';
import LibrarySidebar, { FilterState } from '../components/LibrarySidebar';
import AISearchBar from '../components/AISearchBar';
import PromptListItem, { Prompt } from '../components/PromptListItem';
import PromptCardView from '../components/PromptCardView';

export default function PromptLibrary() {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [filters, setFilters] = useState<FilterState>({
    role: 'All',
    department: 'All',
    workflow: 'All',
    promptType: 'All',
    status: 'All',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [prompts, setPrompts] = useState<Prompt[]>([]);

  useEffect(() => {
    const mockPrompts: Prompt[] = [
      {
        id: '1',
        title: 'Customer Support Automation',
        description: 'Automated response system for common customer inquiries with context-aware answers and sentiment analysis',
        role: 'Support',
        department: 'Operations',
        workflow: 'Customer Support',
        prompt_type: 'Template',
        status: 'Active',
        accuracy_score: 92,
        relevance_score: 88,
        usage_count: 245,
        updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        tags: ['customer-service', 'automation'],
      },
      {
        id: '2',
        title: 'Sales Email Generator',
        description: 'Generate personalized outreach emails based on prospect data, industry trends, and previous interactions',
        role: 'Manager',
        department: 'Sales',
        workflow: 'Sales Outreach',
        prompt_type: 'Custom',
        status: 'Active',
        accuracy_score: 95,
        relevance_score: 91,
        usage_count: 189,
        updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        tags: ['sales', 'email', 'outreach'],
      },
      {
        id: '3',
        title: 'Data Analysis Assistant',
        description: 'Analyze datasets and provide insights with natural language queries, supporting multiple data formats',
        role: 'Analyst',
        department: 'Engineering',
        workflow: 'Data Analysis',
        prompt_type: 'System',
        status: 'Active',
        accuracy_score: 78,
        relevance_score: 82,
        usage_count: 156,
        updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        tags: ['analytics', 'data'],
      },
      {
        id: '4',
        title: 'Technical Documentation Writer',
        description: 'Create comprehensive technical documentation from code and specifications with proper formatting',
        role: 'Developer',
        department: 'Engineering',
        workflow: 'Documentation',
        prompt_type: 'Template',
        status: 'Active',
        accuracy_score: 96,
        relevance_score: 94,
        usage_count: 312,
        updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['documentation', 'technical'],
      },
      {
        id: '5',
        title: 'Meeting Summary Generator',
        description: 'Generate structured summaries from meeting transcripts with action items and key decisions',
        role: 'Manager',
        department: 'Operations',
        workflow: 'Documentation',
        prompt_type: 'Template',
        status: 'Active',
        accuracy_score: 89,
        relevance_score: 87,
        usage_count: 278,
        updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['meetings', 'summary'],
      },
      {
        id: '6',
        title: 'Content Optimizer',
        description: 'Improve content readability and SEO performance for blog posts, articles, and web copy',
        role: 'Designer',
        department: 'Marketing',
        workflow: 'Content Creation',
        prompt_type: 'Custom',
        status: 'Under Review',
        accuracy_score: 85,
        relevance_score: 79,
        usage_count: 134,
        updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['content', 'seo', 'marketing'],
      },
      {
        id: '7',
        title: 'Code Review Assistant',
        description: 'Review pull requests and provide constructive feedback on code quality, security, and best practices',
        role: 'Developer',
        department: 'Engineering',
        workflow: 'Code Review',
        prompt_type: 'System',
        status: 'Active',
        accuracy_score: 93,
        relevance_score: 90,
        usage_count: 421,
        updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        tags: ['code-review', 'development'],
      },
      {
        id: '8',
        title: 'Product Description Generator',
        description: 'Create compelling product descriptions that highlight features, benefits, and unique selling points',
        role: 'Manager',
        department: 'Marketing',
        workflow: 'Content Creation',
        prompt_type: 'Template',
        status: 'Draft',
        accuracy_score: 81,
        relevance_score: 76,
        usage_count: 67,
        updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['product', 'marketing', 'ecommerce'],
      },
    ];

    setPrompts(mockPrompts);
  }, []);

  const filteredPrompts = prompts.filter((prompt) => {
    const matchesSearch = searchQuery === '' ||
      prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = filters.role === 'All' || prompt.role === filters.role;
    const matchesDept = filters.department === 'All' || prompt.department === filters.department;
    const matchesWorkflow = filters.workflow === 'All' || prompt.workflow === filters.workflow;
    const matchesType = filters.promptType === 'All' || prompt.prompt_type === filters.promptType;
    const matchesStatus = filters.status === 'All' || prompt.status === filters.status;

    return matchesSearch && matchesRole && matchesDept && matchesWorkflow && matchesType && matchesStatus;
  });

  const handleView = (id: string) => {
    console.log('View prompt:', id);
  };

  const handleTest = (id: string) => {
    console.log('Test prompt:', id);
  };

  const handleFeedback = (id: string) => {
    console.log('Submit feedback for prompt:', id);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <LibrarySidebar onFilterChange={setFilters} />

      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between gap-6">
              <AISearchBar onSearch={setSearchQuery} />

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded transition-all duration-200 ${
                      viewMode === 'list'
                        ? 'bg-white text-light-sea-green shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <List className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded transition-all duration-200 ${
                      viewMode === 'grid'
                        ? 'bg-white text-light-sea-green shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <LayoutGrid className="w-5 h-5" />
                  </button>
                </div>

                <button className="px-4 py-2.5 bg-gradient-to-r from-jungle-green to-light-sea-green hover:from-light-sea-green hover:to-jungle-green text-white rounded-lg transition-all duration-200 font-medium text-sm flex items-center gap-2 shadow-md hover:shadow-lg">
                  <Plus className="w-5 h-5" />
                  New Prompt
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-8">
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl text-space-cadet mb-2">PROMPT LIBRARY</h1>
                  <p className="text-gray-600">
                    {filteredPrompts.length} {filteredPrompts.length === 1 ? 'prompt' : 'prompts'} found
                  </p>
                </div>

                <button className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200">
                  <SlidersHorizontal className="w-4 h-4" />
                  Sort by: Most Recent
                </button>
              </div>
            </div>

            {filteredPrompts.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No prompts found</h3>
                <p className="text-gray-600 mb-6">Try adjusting your filters or search query</p>
                <button className="px-6 py-2.5 bg-light-sea-green hover:bg-jungle-green text-white rounded-lg transition-all duration-200 font-medium">
                  Clear All Filters
                </button>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-4">
                {filteredPrompts.map((prompt) => (
                  <PromptListItem
                    key={prompt.id}
                    prompt={prompt}
                    onView={() => handleView(prompt.id)}
                    onTest={() => handleTest(prompt.id)}
                    onFeedback={() => handleFeedback(prompt.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPrompts.map((prompt) => (
                  <PromptCardView
                    key={prompt.id}
                    prompt={prompt}
                    onView={() => handleView(prompt.id)}
                    onTest={() => handleTest(prompt.id)}
                    onFeedback={() => handleFeedback(prompt.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
