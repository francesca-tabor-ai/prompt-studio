import React, { useState, useEffect } from 'react';
import {
  Shield,
  Search,
  Download,
  Filter,
  Calendar,
  User,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  BarChart3,
} from 'lucide-react';
import { auditTrailService } from '../services/auditTrailService';

export function ComplianceAuditPanel() {
  const [events, setEvents] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'events' | 'reports'>('events');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    eventType: '',
    resourceType: '',
    severity: '',
  });
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeView]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeView === 'events') {
        await loadAuditEvents();
      } else {
        await loadReports();
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAuditEvents = async () => {
    const filterParams: any = { limit: 200 };

    if (filters.startDate) {
      filterParams.startDate = new Date(filters.startDate);
    }

    if (filters.endDate) {
      filterParams.endDate = new Date(filters.endDate);
    }

    if (filters.eventType) {
      filterParams.eventType = filters.eventType;
    }

    if (filters.resourceType) {
      filterParams.resourceType = filters.resourceType;
    }

    if (filters.severity) {
      filterParams.severity = filters.severity;
    }

    const data = await auditTrailService.getAuditEvents(filterParams);
    setEvents(data);
  };

  const loadReports = async () => {
    const data = await auditTrailService.getComplianceReports({ limit: 50 });
    setReports(data);
  };

  const handleSearch = () => {
    loadAuditEvents();
  };

  const handleExport = async () => {
    try {
      const csv = await auditTrailService.exportAuditLog(filters, 'csv');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_log_${new Date().toISOString()}.csv`;
      a.click();
    } catch (error) {
      alert('Failed to export audit log');
    }
  };

  const handleGenerateReport = async () => {
    const startDate = prompt('Enter start date (YYYY-MM-DD):');
    const endDate = prompt('Enter end date (YYYY-MM-DD):');

    if (!startDate || !endDate) return;

    try {
      await auditTrailService.generateComplianceReport(
        'activity_summary',
        `Activity Report ${new Date().toISOString()}`,
        new Date(startDate),
        new Date(endDate),
        'SOX'
      );
      alert('Report generated successfully');
      await loadReports();
    } catch (error) {
      alert('Failed to generate report');
    }
  };

  const getSeverityBadge = (severity: string) => {
    const badges: Record<string, { color: string; icon: any }> = {
      critical: { color: 'bg-red-100 text-red-700', icon: AlertTriangle },
      high: { color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
      warning: { color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
      info: { color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
    };

    const badge = badges[severity] || badges.info;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {severity}
      </span>
    );
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      content: 'bg-blue-100 text-blue-700',
      workflow: 'bg-green-100 text-green-700',
      user_management: 'bg-purple-100 text-purple-700',
      security: 'bg-red-100 text-red-700',
      data: 'bg-orange-100 text-orange-700',
      system: 'bg-gray-100 text-gray-700',
      compliance: 'bg-pink-100 text-pink-700',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[category] || colors.system}`}>
        {category.replace(/_/g, ' ')}
      </span>
    );
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
            <Shield className="w-7 h-7 text-blue-600" />
            Compliance & Audit Trail
          </h2>
          <p className="text-gray-600">Immutable log of all system activities and compliance reports</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>

          {activeView === 'events' && (
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}

          {activeView === 'reports' && (
            <button
              onClick={handleGenerateReport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              Generate Report
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: events.length, icon: FileText, color: 'bg-blue-500' },
          {
            label: 'Critical',
            value: events.filter((e) => e.eventSeverity === 'critical').length,
            icon: AlertTriangle,
            color: 'bg-red-500',
          },
          {
            label: 'Failed Actions',
            value: events.filter((e) => !e.success).length,
            icon: XCircle,
            color: 'bg-orange-500',
          },
          {
            label: 'Compliance Reports',
            value: reports.length,
            icon: BarChart3,
            color: 'bg-green-500',
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-600">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border-b border-gray-200">
        <div className="flex gap-4 px-6">
          {[
            { id: 'events', label: 'Audit Events', icon: Shield },
            { id: 'reports', label: 'Compliance Reports', icon: BarChart3 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                activeView === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeView === 'events' && (
        <>
          {showFilters && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter Audit Log</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
                  <select
                    value={filters.severity}
                    onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Severities</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  Search
                </button>

                <button
                  onClick={() => {
                    setFilters({
                      startDate: '',
                      endDate: '',
                      eventType: '',
                      resourceType: '',
                      severity: '',
                    });
                    setTimeout(loadAuditEvents, 100);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Timestamp</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Event</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Category</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actor</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Resource</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Severity</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {events.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          {new Date(event.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {event.eventType.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-gray-500">{event.action}</div>
                      </td>
                      <td className="px-6 py-4">{getCategoryBadge(event.eventCategory)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="w-4 h-4" />
                          {event.actorEmail || event.actorId.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{event.resourceType}</div>
                        {event.resourceId && (
                          <div className="text-xs text-gray-500">{event.resourceId.slice(0, 8)}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">{getSeverityBadge(event.eventSeverity)}</td>
                      <td className="px-6 py-4">
                        {event.success ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedEvent(event)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {events.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No audit events found</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeView === 'reports' && (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{report.reportName}</h3>
                  <p className="text-sm text-gray-600 mb-3">{report.summary}</p>

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(report.timePeriodStart).toLocaleDateString()} -{' '}
                      {new Date(report.timePeriodEnd).toLocaleDateString()}
                    </span>

                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      {report.eventCount} events
                    </span>

                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                      {report.userCount} users
                    </span>

                    {report.complianceFramework && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                        {report.complianceFramework}
                      </span>
                    )}
                  </div>
                </div>

                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>
          ))}

          {reports.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports Generated</h3>
              <p className="text-gray-600 mb-4">
                Generate compliance reports to track system activity
              </p>
              <button
                onClick={handleGenerateReport}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Generate Report
              </button>
            </div>
          )}
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Event Details</h3>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Event ID</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedEvent.eventId}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Timestamp</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {new Date(selectedEvent.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Event Type</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedEvent.eventType}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Category</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedEvent.eventCategory}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Actor</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedEvent.actorId}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Resource</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {selectedEvent.resourceType}{' '}
                      {selectedEvent.resourceId && `(${selectedEvent.resourceId})`}
                    </p>
                  </div>
                </div>

                {selectedEvent.changesSummary && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Changes Summary</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedEvent.changesSummary}</p>
                  </div>
                )}

                {selectedEvent.beforeState && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Before State</label>
                    <pre className="text-xs text-gray-900 mt-1 bg-gray-50 p-3 rounded overflow-auto max-h-64">
                      {JSON.stringify(selectedEvent.beforeState, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedEvent.afterState && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">After State</label>
                    <pre className="text-xs text-gray-900 mt-1 bg-gray-50 p-3 rounded overflow-auto max-h-64">
                      {JSON.stringify(selectedEvent.afterState, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
