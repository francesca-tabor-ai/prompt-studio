import React, { useState, useEffect } from 'react';
import {
  Shield,
  Database,
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Archive,
  Trash2,
  BarChart3,
  Lock,
  Eye,
  GitBranch,
} from 'lucide-react';
import { dataGovernanceService } from '../services/dataGovernanceService';

export function DataGovernancePanel() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [privacyRequests, setPrivacyRequests] = useState<any[]>([]);
  const [lifecycleEvents, setLifecycleEvents] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any>(null);
  const [complianceScore, setComplianceScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'policies' | 'requests' | 'lifecycle' | 'reports'>('policies');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        policiesData,
        requestsData,
        eventsData,
        reportsData,
        inventoryData,
        scoreData,
      ] = await Promise.all([
        dataGovernanceService.getRetentionPolicies(),
        dataGovernanceService.getPrivacyRequests(),
        dataGovernanceService.getLifecycleEvents({ limit: 100 }),
        dataGovernanceService.getGovernanceReports({ limit: 20 }),
        dataGovernanceService.getDataInventory(),
        dataGovernanceService.getComplianceScore(),
      ]);

      setPolicies(policiesData);
      setPrivacyRequests(requestsData);
      setLifecycleEvents(eventsData);
      setReports(reportsData);
      setInventory(inventoryData);
      setComplianceScore(scoreData);
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePolicy = async (policyId: string) => {
    if (!confirm('Execute this retention policy now?')) return;

    try {
      const result = await dataGovernanceService.executeRetentionPolicy(policyId);
      alert(`Policy executed: ${result.records_affected} records affected`);
      await loadData();
    } catch (error) {
      alert('Failed to execute policy');
    }
  };

  const handleProcessRequest = async (requestId: string) => {
    if (!confirm('Process this privacy request?')) return;

    try {
      const result = await dataGovernanceService.processPrivacyRequest(requestId);
      alert(`Request processed: ${result.records_processed} records processed`);
      await loadData();
    } catch (error) {
      alert('Failed to process request');
    }
  };

  const handleGenerateReport = async () => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();

      await dataGovernanceService.generateGovernanceReport(
        'retention_compliance',
        startDate,
        endDate
      );
      alert('Report generated successfully');
      await loadData();
    } catch (error) {
      alert('Failed to generate report');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: any }> = {
      pending: { color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
      in_progress: { color: 'bg-blue-100 text-blue-700', icon: Database },
      completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-700', icon: AlertTriangle },
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  const getComplianceColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
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
            Data Governance
          </h2>
          <p className="text-gray-600">Manage data lifecycle, retention, and compliance</p>
        </div>

        <div className="flex items-center gap-2">
          <div className={`text-3xl font-bold ${getComplianceColor(complianceScore)}`}>
            {complianceScore}%
          </div>
          <div className="text-sm text-gray-600">
            Compliance
            <br />
            Score
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Policies', value: policies.filter((p) => p.isActive).length, icon: Database, color: 'bg-blue-500' },
          { label: 'Privacy Requests', value: privacyRequests.length, icon: Lock, color: 'bg-purple-500' },
          { label: 'Lifecycle Events', value: lifecycleEvents.length, icon: Archive, color: 'bg-orange-500' },
          { label: 'Data Categories', value: Object.keys(inventory?.byResourceType || {}).length, icon: GitBranch, color: 'bg-green-500' },
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
            { id: 'policies', label: 'Retention Policies', icon: Database },
            { id: 'requests', label: 'Privacy Requests', icon: Lock },
            { id: 'lifecycle', label: 'Lifecycle Events', icon: Archive },
            { id: 'reports', label: 'Reports', icon: BarChart3 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                activeTab === tab.id
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

      {activeTab === 'policies' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Data Retention Policies</h3>
                <p className="text-sm text-gray-600">Automatic data lifecycle management</p>
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                Create Policy
              </button>
            </div>
          </div>

          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Policy Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Data Type</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Retention</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Framework</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Last Run</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {policies.map((policy) => (
                <tr key={policy.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{policy.policyName}</div>
                    <div className="text-xs text-gray-500">{policy.legalBasis}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                      {policy.dataType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{policy.retentionDays} days</div>
                    <div className="text-xs text-gray-500">
                      {policy.softDelete ? 'Soft delete' : 'Hard delete'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {policy.regulatoryFramework?.map((f: string) => (
                        <span key={f} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">
                      {policy.lastExecutedAt
                        ? new Date(policy.lastExecutedAt).toLocaleDateString()
                        : 'Never'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {policy.isActive ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-gray-400" />
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleExecutePolicy(policy.id)}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Execute Now
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Privacy Requests</h3>
                <p className="text-sm text-gray-600">GDPR, CCPA, and other privacy rights</p>
              </div>
            </div>
          </div>

          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Request #</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Subject</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Records</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Deadline</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {privacyRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-mono text-sm text-gray-900">{request.requestNumber}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                      {request.requestType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{request.subjectEmail}</div>
                    <div className="text-xs text-gray-500">{request.subjectUserId.slice(0, 8)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{request.recordsFound || 0}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">
                      {new Date(request.completionDeadline).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(request.status)}</td>
                  <td className="px-6 py-4">
                    {request.status === 'pending' && (
                      <button
                        onClick={() => handleProcessRequest(request.id)}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        Process
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {privacyRequests.length === 0 && (
            <div className="text-center py-12">
              <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No privacy requests</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'lifecycle' && (
        <div className="space-y-4">
          {lifecycleEvents.map((event) => (
            <div key={event.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  event.event_type === 'archived' ? 'bg-blue-100' :
                  event.event_type === 'deleted' ? 'bg-red-100' :
                  event.event_type === 'anonymized' ? 'bg-purple-100' :
                  'bg-gray-100'
                }`}>
                  {event.event_type === 'archived' && <Archive className="w-6 h-6 text-blue-600" />}
                  {event.event_type === 'deleted' && <Trash2 className="w-6 h-6 text-red-600" />}
                  {event.event_type === 'anonymized' && <Eye className="w-6 h-6 text-purple-600" />}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-900 capitalize">
                      {event.event_type.replace(/_/g, ' ')}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                      {event.resource_type}
                    </span>
                    {event.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mb-2">{event.reason}</p>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {new Date(event.executed_at).toLocaleString()}
                    </span>
                    {event.records_affected > 0 && (
                      <span>{event.records_affected} records affected</span>
                    )}
                    {event.archive_location && (
                      <span>
                        <Archive className="w-3 h-3 inline mr-1" />
                        {event.archive_location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {lifecycleEvents.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <Archive className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No lifecycle events</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex justify-end mb-4">
            <button
              onClick={handleGenerateReport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              Generate Report
            </button>
          </div>

          {reports.map((report) => (
            <div key={report.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{report.report_name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{report.summary}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-600">Reviewed</div>
                      <div className="text-lg font-bold text-gray-900">{report.total_records_reviewed}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Archived</div>
                      <div className="text-lg font-bold text-blue-600">{report.records_archived}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Deleted</div>
                      <div className="text-lg font-bold text-red-600">{report.records_deleted}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Anonymized</div>
                      <div className="text-lg font-bold text-purple-600">{report.records_anonymized}</div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Generated {new Date(report.generated_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {reports.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No governance reports generated</p>
              <button
                onClick={handleGenerateReport}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Generate First Report
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
