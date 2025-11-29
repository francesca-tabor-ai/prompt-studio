import { Filter, ChevronDown, LayoutDashboard, Users, Building2, UserCog } from 'lucide-react';
import { useState } from 'react';

export default function Sidebar() {
  const [activeDept, setActiveDept] = useState('All');
  const [activeTeam, setActiveTeam] = useState('All');
  const [activeRole, setActiveRole] = useState('All');

  const departments = ['All', 'Engineering', 'Marketing', 'Sales', 'Operations'];
  const teams = ['All', 'Frontend', 'Backend', 'Data Science', 'DevOps'];
  const roles = ['All', 'Admin', 'Manager', 'Developer', 'Analyst'];

  return (
    <aside className="w-80 bg-white border-r border-gray-200 h-screen sticky top-0 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-jungle-green to-light-sea-green rounded-lg flex items-center justify-center">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl text-space-cadet">PROMPT HUB</h1>
            <p className="text-xs text-gray-500 font-rubik">Management Platform</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center gap-2 text-space-cadet mb-4">
          <Filter className="w-5 h-5" />
          <h2 className="text-xl">FILTERS</h2>
        </div>

        <FilterSection
          icon={<Building2 className="w-5 h-5" />}
          title="Department"
          options={departments}
          active={activeDept}
          setActive={setActiveDept}
        />

        <FilterSection
          icon={<Users className="w-5 h-5" />}
          title="Team"
          options={teams}
          active={activeTeam}
          setActive={setActiveTeam}
        />

        <FilterSection
          icon={<UserCog className="w-5 h-5" />}
          title="Role"
          options={roles}
          active={activeRole}
          setActive={setActiveRole}
        />
      </div>

      <div className="p-6 border-t border-gray-200">
        <button className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all duration-200 font-medium text-sm">
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
          <h3 className="text-lg font-medium">{title}</h3>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="space-y-1 pl-7">
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
