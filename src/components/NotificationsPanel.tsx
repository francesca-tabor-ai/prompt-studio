import { Bell, CheckCircle, AlertCircle, Info, TrendingUp } from 'lucide-react';

export default function NotificationsPanel() {
  const notifications = [
    {
      type: 'success',
      title: 'Prompt Approved',
      message: 'Your "Customer Support V2" prompt has been approved',
      time: '5 min ago',
      icon: CheckCircle,
    },
    {
      type: 'info',
      title: 'New Feedback',
      message: 'You have 3 new feedback items on "Sales Outreach"',
      time: '1 hour ago',
      icon: Info,
    },
    {
      type: 'warning',
      title: 'Performance Alert',
      message: 'Prompt "Data Analysis" accuracy dropped to 78%',
      time: '2 hours ago',
      icon: AlertCircle,
    },
    {
      type: 'success',
      title: 'Top Performer',
      message: 'Your prompt "Email Generator" reached 95% relevance',
      time: '1 day ago',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-space-cadet to-yale-blue">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-white" />
            <h2 className="text-xl text-white">NOTIFICATIONS</h2>
          </div>
          <button className="text-xs font-medium text-white/80 hover:text-white transition-colors duration-200">
            Mark all read
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {notifications.map((notification, index) => (
          <NotificationItem key={index} {...notification} />
        ))}
      </div>

      <div className="p-4 bg-gray-50 text-center">
        <button className="text-sm font-medium text-light-sea-green hover:text-jungle-green transition-colors duration-200">
          View All Notifications
        </button>
      </div>
    </div>
  );
}

interface NotificationItemProps {
  type: 'success' | 'info' | 'warning';
  title: string;
  message: string;
  time: string;
  icon: React.ComponentType<{ className?: string }>;
}

function NotificationItem({ type, title, message, time, icon: Icon }: NotificationItemProps) {
  const typeStyles = {
    success: 'bg-green-100 text-green-600',
    info: 'bg-blue-100 text-blue-600',
    warning: 'bg-yellow-100 text-yellow-600',
  };

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer group">
      <div className="flex gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${typeStyles[type]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 mb-1 group-hover:text-light-sea-green transition-colors duration-200">
            {title}
          </h4>
          <p className="text-sm text-gray-600 mb-2">{message}</p>
          <span className="text-xs text-gray-500">{time}</span>
        </div>
      </div>
    </div>
  );
}
