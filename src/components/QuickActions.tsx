import { Plus, FlaskConical, Send } from 'lucide-react';

export default function QuickActions() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <ActionButton
        icon={<Plus className="w-5 h-5" />}
        label="Create Prompt"
        description="Start from scratch"
        color="jungle-green"
        primary
      />
      <ActionButton
        icon={<FlaskConical className="w-5 h-5" />}
        label="Test Prompt"
        description="Validate performance"
        color="light-sea-green"
      />
      <ActionButton
        icon={<Send className="w-5 h-5" />}
        label="Submit New Prompt"
        description="Share with team"
        color="space-cadet"
      />
    </div>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  primary?: boolean;
}

function ActionButton({ icon, label, description, color, primary }: ActionButtonProps) {
  return (
    <button
      className={`p-6 rounded-xl border-2 text-left group transition-all duration-300 hover:scale-105 hover:shadow-xl ${
        primary
          ? `bg-${color} border-${color} text-white`
          : `bg-white border-gray-200 hover:border-${color}`
      }`}
    >
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-all duration-300 ${
        primary
          ? 'bg-white/20 group-hover:bg-white/30'
          : `bg-${color}/10 group-hover:bg-${color}/20`
      }`}>
        <div className={primary ? 'text-white' : `text-${color}`}>
          {icon}
        </div>
      </div>
      <h3 className={`text-lg font-bold mb-1 ${primary ? 'text-white' : 'text-gray-900'}`}>
        {label}
      </h3>
      <p className={`text-sm ${primary ? 'text-white/80' : 'text-gray-600'}`}>
        {description}
      </p>
    </button>
  );
}
