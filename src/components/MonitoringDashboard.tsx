import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  HardDrive,
  TrendingUp,
  Zap,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<any>({
    errorRate: 0,
    avgResponseTime: 0,
    requestsPerMinute: 0,
    activeIncidents: 0,
  });
  const [healthStatus, setHealthStatus] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<any[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<any>({
    cpu: 0,
    memory: 0,
    disk: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadMetrics(),
        loadHealthStatus(),
        loadRecentLogs(),
        loadActiveIncidents(),
        loadSystemMetrics(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const { data: logs } = await supabase
      .from('application_logs')
      .select('level')
      .gte('timestamp', fiveMinutesAgo.toISOString());

    const totalLogs = logs?.length || 0;
    const errorLogs = logs?.filter((l) => l.level === 'error' || l.level === 'fatal').length || 0;
    const errorRate = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;

    const { data: responseMetrics } = await supabase
      .from('application_metrics')
      .select('value')
      .eq('metric_name', 'api.response_time')
      .gte('timestamp', fiveMinutesAgo.toISOString());

    const avgResponseTime =
      responseMetrics && responseMetrics.length > 0
        ? responseMetrics.reduce((sum, m) => sum + parseFloat(m.value), 0) / responseMetrics.length
        : 0;

    const { data: incidents } = await supabase
      .from('alert_incidents')
      .select('id')
      .in('status', ['firing', 'acknowledged']);

    setMetrics({
      errorRate: Math.round(errorRate * 100) / 100,
      avgResponseTime: Math.round(avgResponseTime),
      requestsPerMinute: Math.round((totalLogs / 5) * 60),
      activeIncidents: incidents?.length || 0,
    });
  };

  const loadHealthStatus = async () => {
    const { data } = await supabase.rpc('get_service_health_summary');
    setHealthStatus(data || []);
  };

  const loadRecentLogs = async () => {
    const { data } = await supabase
      .from('application_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    setRecentLogs(data || []);
  };

  const loadActiveIncidents = async () => {
    const { data } = await supabase
      .from('alert_incidents')
      .select('*, alerts(alert_name)')
      .in('status', ['firing', 'acknowledged'])
      .order('triggered_at', { ascending: false });

    setActiveIncidents(data || []);
  };

  const loadSystemMetrics = async () => {
    const { data } = await supabase
      .from('system_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setSystemMetrics({
        cpu: data.cpu_usage_percent || 0,
        memory: data.memory_usage_percent || 0,
        disk: data.disk_usage_percent || 0,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5" />;
      case 'unhealthy':
        return <XCircle className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error':
      case 'fatal':
        return 'bg-red-100 text-red-700';
      case 'warn':
        return 'bg-yellow-100 text-yellow-700';
      case 'info':
        return 'bg-blue-100 text-blue-700';
      case 'debug':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-blue-600" />
            System Monitoring
          </h2>
          <p className="text-gray-600">Real-time system health and performance metrics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Error Rate',
            value: `${metrics.errorRate}%`,
            icon: AlertTriangle,
            color: metrics.errorRate > 5 ? 'bg-red-500' : 'bg-green-500',
          },
          {
            label: 'Avg Response Time',
            value: `${metrics.avgResponseTime}ms`,
            icon: Clock,
            color: metrics.avgResponseTime > 1000 ? 'bg-yellow-500' : 'bg-green-500',
          },
          {
            label: 'Requests/min',
            value: metrics.requestsPerMinute,
            icon: TrendingUp,
            color: 'bg-blue-500',
          },
          {
            label: 'Active Incidents',
            value: metrics.activeIncidents,
            icon: Zap,
            color: metrics.activeIncidents > 0 ? 'bg-red-500' : 'bg-green-500',
          },
        ].map((metric) => (
          <div key={metric.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-10 h-10 rounded-lg ${metric.color} flex items-center justify-center`}>
                <metric.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
            <p className="text-sm text-gray-600">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'CPU Usage', value: systemMetrics.cpu, icon: Cpu },
          { label: 'Memory Usage', value: systemMetrics.memory, icon: Database },
          { label: 'Disk Usage', value: systemMetrics.disk, icon: HardDrive },
        ].map((metric) => (
          <div key={metric.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <metric.icon className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">{metric.label}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  metric.value > 80 ? 'bg-red-500' : metric.value > 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${metric.value}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-2">{Math.round(metric.value)}%</p>
          </div>
        ))}
      </div>

      {activeIncidents.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-red-50">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Active Incidents ({activeIncidents.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {activeIncidents.map((incident) => (
              <div key={incident.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          incident.severity === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : incident.severity === 'warning'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {incident.severity}
                      </span>
                      <span className="font-medium text-gray-900">{incident.alerts?.alert_name}</span>
                    </div>
                    <p className="text-sm text-gray-600">{incident.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Triggered {new Date(incident.triggered_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      incident.status === 'firing'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {incident.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Service Health</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {healthStatus.map((service) => (
            <div key={service.service_name} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStatusColor(service.status)}`}>
                    {getStatusIcon(service.status)}
                    <span className="text-sm font-medium">{service.status}</span>
                  </div>
                  <span className="font-medium text-gray-900">{service.service_name}</span>
                </div>
                <span className="text-xs text-gray-500">
                  Last check: {new Date(service.last_check).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Logs</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Time</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Level</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Service</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentLogs.slice(0, 50).map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getLogLevelColor(log.level)}`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900">{log.service_name}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
