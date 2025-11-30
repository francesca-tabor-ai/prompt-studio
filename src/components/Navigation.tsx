import { LayoutDashboard, Library, Sparkles, FlaskConical, Building2, Users, Shield, LogOut, FileCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export type PageType = 'dashboard' | 'library' | 'generator' | 'sandbox' | 'enterprise' | 'collaborate' | 'admin' | 'peer-review';

interface NavigationProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
}

export default function Navigation({ currentPage, onNavigate }: NavigationProps) {
  const { profile, hasPermission, logout } = useAuth();

  const navItems = [
    {
      id: 'dashboard' as PageType,
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Analytics & Insights',
      permission: 'analytics.read',
    },
    {
      id: 'library' as PageType,
      label: 'Library',
      icon: Library,
      description: 'Prompt Collection',
      permission: 'library.access',
    },
    {
      id: 'generator' as PageType,
      label: 'Generator',
      icon: Sparkles,
      description: 'Create Prompts',
      permission: 'prompts.create',
    },
    {
      id: 'sandbox' as PageType,
      label: 'Sandbox',
      icon: FlaskConical,
      description: 'Test & Refine',
      permission: 'sandbox.access',
    },
    {
      id: 'enterprise' as PageType,
      label: 'Enterprise',
      icon: Building2,
      description: 'Org Mapping',
      permission: 'enterprise.access',
    },
    {
      id: 'collaborate' as PageType,
      label: 'Collaborate',
      icon: Users,
      description: 'Peer Review',
      permission: 'collaborate.submit',
    },
    {
      id: 'peer-review' as PageType,
      label: 'Peer Review',
      icon: FileCheck,
      description: 'Review Workflow',
      permission: 'collaborate.submit',
    },
    {
      id: 'admin' as PageType,
      label: 'Admin',
      icon: Shield,
      description: 'User Management',
      permission: 'roles.manage',
    },
  ];

  const visibleNavItems = navItems.filter((item) => hasPermission(item.permission));

  return (
    <nav className="fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-space-cadet to-yale-blue border-r border-white/10 z-50">
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bebas tracking-wide text-white">PROMPT STUDIO</h1>
          <p className="text-sm text-white/60">AI Prompt Engineering</p>
        </div>

        <div className="space-y-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-light-sea-green text-white shadow-lg'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-semibold text-sm">{item.label}</div>
                  <div className="text-xs opacity-75">{item.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-sm font-semibold text-white mb-2">Quick Start</h3>
          <ul className="space-y-2 text-xs text-white/70">
            <li className="flex items-start gap-2">
              <span className="text-green-yellow">•</span>
              <span>Generate prompts with AI assistance</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-yellow">•</span>
              <span>Test prompts in real-time sandbox</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-yellow">•</span>
              <span>Save and organize in library</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 border-t border-white/10">
        <button
          onClick={() => logout()}
          className="w-full px-6 py-4 flex items-center gap-3 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-semibold text-sm">Logout</span>
        </button>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-yellow to-jungle-green rounded-lg flex items-center justify-center">
            <span className="text-sm font-bold text-white">
              {profile?.full_name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">
              {profile?.full_name || 'User'}
            </div>
            <div className="text-xs text-white/60 truncate">{profile?.email}</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
