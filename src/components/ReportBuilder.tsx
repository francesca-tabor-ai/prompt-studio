import React, { useState, useEffect } from 'react';
import {
  FileText,
  Calendar,
  Download,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Settings,
  Eye,
  Plus,
  Trash2,
} from 'lucide-react';
import { reportGenerationService } from '../services/reportGenerationService';

export function ReportBuilder() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'generate' | 'scheduled' | 'history'>('generate');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [templatesData, executionsData, schedulesData] = await Promise.all([
        reportGenerationService.getTemplates(),
        reportGenerationService.getReportExecutions(20),
        reportGenerationService.getScheduledReports(),
      ]);

      setTemplates(templatesData);
      setExecutions(executionsData);
      setSchedules(schedulesData);

      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      setEndDate(today.toISOString().split('T')[0]);
      setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedTemplate || !startDate || !endDate) {
      alert('Please select a template and date range');
      return;
    }

    setGenerating(true);
    try {
      const executionId = await reportGenerationService.generateReport(
        selectedTemplate,
        new Date(startDate),
        new Date(endDate)
      );

      alert('Report generated successfully!');
      await loadData();
    } catch (error) {
      alert('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (executionId: string, format: 'pdf' | 'csv') => {
    try {
      await reportGenerationService.exportReport(executionId, format);
      alert(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      alert('Export failed');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-600 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      performance: 'bg-blue-100 text-blue-700',
      usage: 'bg-green-100 text-green-700',
      quality: 'bg-purple-100 text-purple-700',
      cost: 'bg-orange-100 text-orange-700',
      satisfaction: 'bg-yellow-100 text-yellow-700',
      productivity: 'bg-indigo-100 text-indigo-700',
    };

    return colors[category] || 'bg-gray-100 text-gray-700';
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
          <h2 className="text-2xl font-bold text-gray-900">Report Builder</h2>
          <p className="text-gray-600">Generate and manage professional reports</p>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200">
        <div className="flex gap-4 px-6">
          {[
            { id: 'generate', label: 'Generate Report', icon: FileText },
            { id: 'scheduled', label: 'Scheduled Reports', icon: Calendar },
            { id: 'history', label: 'Report History', icon: Clock },
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

      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Report Template</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`text-left p-4 border-2 rounded-lg transition-all ${
                      selectedTemplate === template.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{template.templateName}</h4>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(
                          template.category
                        )}`}
                      >
                        {template.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Range</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                {[
                  { label: 'Last 7 Days', days: 7 },
                  { label: 'Last 30 Days', days: 30 },
                  { label: 'Last 90 Days', days: 90 },
                ].map((preset) => (
                  <button
                    key={preset.days}
                    onClick={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - preset.days);
                      setEndDate(end.toISOString().split('T')[0]);
                      setStartDate(start.toISOString().split('T')[0]);
                    }}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Report</h3>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Template:</span>
                  <span className="font-medium text-gray-900">
                    {selectedTemplate
                      ? templates.find((t) => t.id === selectedTemplate)?.templateName
                      : 'None'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Period:</span>
                  <span className="font-medium text-gray-900">
                    {startDate && endDate
                      ? `${Math.ceil(
                          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )} days`
                      : 'Not set'}
                  </span>
                </div>
              </div>

              <button
                onClick={handleGenerateReport}
                disabled={!selectedTemplate || !startDate || !endDate || generating}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <Clock className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    Generate Report
                  </>
                )}
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Options</h3>

              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">PDF Report</p>
                    <p className="text-xs text-gray-600">Professional formatted document</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">CSV Data</p>
                    <p className="text-xs text-gray-600">Raw data for analysis</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'scheduled' && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Scheduled Reports</h3>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New Schedule
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">{schedule.scheduleName}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {schedule.frequency}
                      </span>
                      <span>{schedule.recipients.length} recipients</span>
                      <span>{schedule.exportFormats.join(', ')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded">
                      <Settings className="w-4 h-4 text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Report History</h3>
          </div>

          <div className="divide-y divide-gray-100">
            {executions.map((execution) => (
              <div key={execution.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {getStatusIcon(execution.status)}

                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{execution.reportTitle}</h4>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>
                          {execution.dateRangeStart.toLocaleDateString()} -{' '}
                          {execution.dateRangeEnd.toLocaleDateString()}
                        </span>
                        <span className="capitalize">{execution.executionType}</span>
                      </div>

                      {execution.keyInsights && execution.keyInsights.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-700">
                            {execution.keyInsights[0]}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded">
                      <Eye className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleExport(execution.id, 'pdf')}
                      className="p-2 hover:bg-gray-100 rounded"
                    >
                      <Download className="w-4 h-4 text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded">
                      <Send className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
