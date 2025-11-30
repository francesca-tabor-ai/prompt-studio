import React, { useState, useEffect } from 'react';
import { Bell, Check, X, AlertCircle, MessageCircle, FileText, CheckCircle } from 'lucide-react';
import { peerReviewService } from '../services/peerReviewService';

interface Notification {
  id: string;
  recipient_id: string;
  recipient_email: string;
  submission_id?: string;
  review_id?: string;
  comment_id?: string;
  notification_type: string;
  title: string;
  message: string;
  action_url?: string;
  priority: string;
  sent_at: string;
  read_at?: string;
  is_read: boolean;
  is_acknowledged: boolean;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await peerReviewService.getMyNotifications();
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await peerReviewService.markNotificationRead(notificationId);
      await loadNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    setLoading(true);
    try {
      const unreadNotifications = notifications.filter((n) => !n.is_read);
      await Promise.all(unreadNotifications.map((n) => markAsRead(n.id)));
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, any> = {
      assignment: FileText,
      new_comment: MessageCircle,
      review_complete: CheckCircle,
      changes_requested: AlertCircle,
      approved: CheckCircle,
      rejected: X,
      resubmission: FileText,
      mention: MessageCircle,
      reminder: Bell,
    };
    return icons[type] || Bell;
  };

  const getNotificationColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-700',
      normal: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700',
    };
    return colors[priority] || colors.normal;
  };

  const filteredNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'unread'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  All ({notifications.length})
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    disabled={loading}
                    className="ml-auto text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Bell className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-gray-600 font-medium">No notifications</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {filter === 'unread'
                      ? "You're all caught up!"
                      : 'Check back later for updates'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredNotifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.notification_type);
                    return (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                          !notification.is_read ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => {
                          if (!notification.is_read) {
                            markAsRead(notification.id);
                          }
                        }}
                      >
                        <div className="flex gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg ${getNotificationColor(
                              notification.priority
                            )} flex items-center justify-center flex-shrink-0`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-medium text-gray-900 text-sm">
                                {notification.title}
                              </h4>
                              {!notification.is_read && (
                                <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                {new Date(notification.sent_at).toLocaleString()}
                              </span>
                              {notification.priority !== 'normal' && (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${getNotificationColor(
                                    notification.priority
                                  )}`}
                                >
                                  {notification.priority}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {!notification.is_read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            className="mt-2 ml-13 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Mark as read
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
