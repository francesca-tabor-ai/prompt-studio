import { useState, useEffect } from 'react';
import MetricCard from '../components/MetricCard';
import { Target, TrendingUp, Users, Activity, Download, AlertCircle, TrendingDown, Building2 } from 'lucide-react';
import {
  analyticsService,
  DepartmentMetrics,
  RoleMetrics,
  PromptPerformance,
  TrendData,
} from '../services/analyticsService';

export default function Dashboard() {
  const [departmentMetrics, setDepartmentMetrics] = useState<DepartmentMetrics[]>([]);
  const [roleMetrics, setRoleMetrics] = useState<RoleMetrics[]>([]);
  const [promptPerformance, setPromptPerformance] = useState<PromptPerformance[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setIsLoading(true);
    const [deptData, roleData, perfData, trendsData] = await Promise.all([
      analyticsService.getDepartmentMetrics(),
      analyticsService.getRoleMetrics(),
      analyticsService.getPromptPerformance(),
      analyticsService.getTrendData(),
    ]);
    setDepartmentMetrics(deptData);
    setRoleMetrics(roleData);
    setPromptPerformance(perfData);
    setTrendData(trendsData);
    setIsLoading(false);
  };

  const handleExportCsv = () => {
    const exportData = [
      ...departmentMetrics.map((d) => ({ type: 'Department', ...d })),
      ...roleMetrics.map((r) => ({ type: 'Role', ...r })),
      ...promptPerformance.map((p) => ({ type: 'Prompt', ...p })),
    ];
    analyticsService.exportToCsv(exportData, 'analytics-report');
  };

  const handleExportPdf = () => {
    analyticsService.exportToPdf('dashboard', 'analytics-report');
  };

  const promptsNeedingImprovement = promptPerformance.filter((p) => p.needsImprovement);
  const totalPrompts = promptPerformance.length;
  const avgAccuracy = Math.round(
    promptPerformance.reduce((sum, p) => sum + p.accuracy, 0) / (totalPrompts || 1)
  );
  const totalUsage = promptPerformance.reduce((sum, p) => sum + p.usageCount, 0);
  const activeUsers = departmentMetrics.reduce((sum, d) => sum + d.activeEmployees, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl text-space-cadet font-bebas tracking-wide">ENTERPRISE ANALYTICS</h1>
              <p className="text-sm text-gray-600">Performance metrics and insights across departments</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleExportCsv}
                className="px-4 py-2 bg-white border-2 border-gray-300 hover:border-light-sea-green text-gray-700 rounded-lg transition-all duration-200 font-medium flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={handleExportPdf}
                className="px-4 py-2 bg-gradient-to-r from-jungle-green to-light-sea-green hover:from-light-sea-green hover:to-jungle-green text-white rounded-lg transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="p-8 space-y-8">
        <div className="grid grid-cols-4 gap-6">
          <MetricCard
            title="Total Prompts"
            value={totalPrompts.toString()}
            change="+12%"
            isPositive={true}
            icon={Target}
            color="green"
          />
          <MetricCard
            title="Avg Accuracy"
            value={`${avgAccuracy}%`}
            change="+5%"
            isPositive={true}
            icon={Activity}
            color="blue"
          />
          <MetricCard
            title="Total Usage"
            value={totalUsage.toString()}
            change="+18%"
            isPositive={true}
            icon={TrendingUp}
            color="yellow"
          />
          <MetricCard
            title="Active Users"
            value={activeUsers.toString()}
            change="-3%"
            isPositive={false}
            icon={Users}
            color="green"
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-space-cadet to-yale-blue">
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6 text-white" />
              <div>
                <h2 className="text-xl text-white">DEPARTMENT METRICS</h2>
                <p className="text-sm text-white/80">Usage and performance by department</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            {departmentMetrics.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No department data available</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Department</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Prompts</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Usage</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Accuracy</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Relevance</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Employees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentMetrics.map((dept) => (
                      <tr key={dept.department} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{dept.department}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{dept.totalPrompts}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{dept.totalUsage}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-jungle-green h-2 rounded-full"
                                style={{ width: `${dept.avgAccuracy}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-700">{dept.avgAccuracy}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-light-sea-green h-2 rounded-full"
                                style={{ width: `${dept.avgRelevance}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-700">{dept.avgRelevance}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">{dept.activeEmployees}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-jungle-green to-light-sea-green">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-xl text-white">PERFORMANCE TRENDS</h2>
                  <p className="text-sm text-white/80">Last 30 days</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {trendData.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No trend data available</div>
              ) : (
                <div className="space-y-4">
                  <div className="h-48 flex items-end justify-between gap-1">
                    {trendData.slice(-14).map((trend, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-jungle-green/20 rounded-t" style={{ height: `${trend.accuracy}%` }}>
                          <div className="w-full bg-jungle-green rounded-t h-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-xs text-gray-600 mb-1">Avg Accuracy</div>
                      <div className="text-2xl font-bold text-jungle-green">
                        {Math.round(trendData.reduce((s, t) => s + t.accuracy, 0) / trendData.length)}%
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-xs text-gray-600 mb-1">Total Usage</div>
                      <div className="text-2xl font-bold text-yale-blue">
                        {trendData.reduce((s, t) => s + t.usage, 0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-red-500 to-orange-500">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-xl text-white">NEEDS IMPROVEMENT</h2>
                  <p className="text-sm text-white/80">{promptsNeedingImprovement.length} prompts flagged</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {promptsNeedingImprovement.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-green-600" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">All prompts performing well</h4>
                  <p className="text-sm text-gray-600">No prompts currently need improvement</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {promptsNeedingImprovement.map((prompt) => (
                    <div key={prompt.promptId} className="border border-gray-200 rounded-lg p-4 hover:border-red-300 transition-all duration-200">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900 text-sm">{prompt.promptTitle}</h4>
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                          {prompt.workflow}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Accuracy:</span>
                          <span className={`font-semibold ${prompt.accuracy < 70 ? 'text-red-600' : 'text-gray-900'}`}>
                            {prompt.accuracy}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Relevance:</span>
                          <span className={`font-semibold ${prompt.relevance < 70 ? 'text-red-600' : 'text-gray-900'}`}>
                            {prompt.relevance}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Rating:</span>
                          <span className={`font-semibold ${prompt.userRating < 3 ? 'text-red-600' : 'text-gray-900'}`}>
                            {prompt.userRating.toFixed(1)}/5
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Success:</span>
                          <span className={`font-semibold ${prompt.testSuccessRate < 75 ? 'text-red-600' : 'text-gray-900'}`}>
                            {prompt.testSuccessRate}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-yellow to-jungle-green">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-white" />
              <div>
                <h2 className="text-xl text-white">ROLE PERFORMANCE</h2>
                <p className="text-sm text-white/80">Metrics by role and department</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            {roleMetrics.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No role data available</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Role</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Department</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tasks</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Avg Rating</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Usage</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roleMetrics.map((role, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{role.role}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{role.department}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{role.totalTasks}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-1 bg-green-yellow/20 text-jungle-green rounded text-sm font-semibold">
                            ⭐ {role.avgRating}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">{role.usageCount}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-jungle-green h-2 rounded-full"
                                style={{ width: `${role.successRate}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-700">{role.successRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
