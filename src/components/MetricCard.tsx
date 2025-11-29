import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: LucideIcon;
  color: 'green' | 'blue' | 'yellow';
}

export default function MetricCard({ title, value, change, isPositive, icon: Icon, color }: MetricCardProps) {
  const colorClasses = {
    green: 'from-jungle-green to-light-sea-green',
    blue: 'from-space-cadet to-yale-blue',
    yellow: 'from-light-sea-green to-green-yellow',
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 bg-gradient-to-br ${colorClasses[color]} rounded-lg flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {change}
        </span>
      </div>

      <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
