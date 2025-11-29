import { Filter, ChevronDown, UserCog, Building2, Workflow, FileType, CheckCircle } from 'lucide-react';
import { useState } from 'react';

interface LibrarySidebarProps {
  onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
  role: string;
  department: string;
  workflow: string;
  promptType: string;
  status: string;
}

export default function LibrarySidebar({ onFilterChange }: LibrarySidebarProps) {
  const [filters, setFilters] = useState<FilterState>({
    role: 'All',
    department: 'All',
    workflow: 'All',
    promptType: 'All',
    status: 'All',
  });

  const roles = ['All', 'Admin', 'Manager', 'Developer', 'Analyst', 'Designer', 'Support'];
  const departments = ['All', 'Engineering', 'Marketing', 'Sales', 'Operations', 'HR', 'Finance'];
  const workflows = ['All', 'Customer Support', 'Sales Outreach', 'Data Analysis', 'Content Creation', 'Documentation', 'Code Review'];
  const promptTypes = ['All', 'Template', 'Custom', 'System', 'Workflow'];
  const statuses = ['All', 'Active', 'Draft', 'Under Review', 'Archived'];

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleResetFilters = () => {
    const resetFilters = {
      role: 'All',
      department: 'All',
      workflow: 'All',
      promptType: 'All',
      status: 'All',
    };
    setFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  return (
    <aside className="w-80 bg-white border-r border-gray-200 h-screen sticky top-0 flex flex-col overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2 text-space-cadet">
          <Filter className="w-5 h-5" />
          <h2 className="text-2xl">FILTERS</h2>
        </div>
        <p className="text-sm text-gray-500 mt-1">Refine your prompt search</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <FilterSection
          icon={<UserCog className="w-5 h-5" />}
          title="Role"
          options={roles}
          active={filters.role}
          setActive={(value) => handleFilterChange('role', value)}
        />

        <FilterSection
          icon={<Building2 className="w-5 h-5" />}
          title="Department"
          options={departments}
          active={filters.department}
          setActive={(value) => handleFilterChange('department', value)}
        />

        <FilterSection
          icon={<Workflow className="w-5 h-5" />}
          title="Workflow"
          options={workflows}
          active={filters.workflow}
          setActive={(value) => handleFilterChange('workflow', value)}
        />

        <FilterSection
          icon={<FileType className="w-5 h-5" />}
          title="Prompt Type"
          options={promptTypes}
          active={filters.promptType}
          setActive={(value) => handleFilterChange('promptType', value)}
        />

        <FilterSection
          icon={<CheckCircle className="w-5 h-5" />}
          title="Status"
          options={statuses}
          active={filters.status}
          setActive={(value) => handleFilterChange('status', value)}
        />
      </div>

      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <button
          onClick={handleResetFilters}
          className="w-full py-2.5 px-4 bg-white hover:bg-gray-100 text-gray-700 rounded-lg transition-all duration-200 font-medium text-sm border border-gray-200 hover:border-light-sea-green"
        >
          Reset All Filters
        </button>
      </div>
    </aside>
  );
}

interface FilterSectionProps {
  icon: React.ReactNode;
  title: string;
  options: string[];
  active: string;
  setActive: (value: string) => void;
}

function FilterSection({ icon, title, options, active, setActive }: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-2 text-gray-700">
          {icon}
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="space-y-1 pl-7 max-h-64 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => setActive(option)}
              className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all duration-200 ${
                active === option
                  ? 'bg-light-sea-green text-white font-medium shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
