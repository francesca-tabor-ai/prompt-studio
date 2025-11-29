import { Building2, Users, Briefcase, ListChecks } from 'lucide-react';

interface OrgSummary {
  department: string;
  team: string;
  role: string;
  employeeCount: number;
  keyTasks: string[];
}

interface OrganizationalTableProps {
  data: OrgSummary[];
  onGenerateTasks: (department: string, team: string, role: string) => void;
}

export default function OrganizationalTable({ data, onGenerateTasks }: OrganizationalTableProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
        <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Organization Data</h3>
        <p className="text-sm text-gray-600">Import employee data to see organizational structure</p>
      </div>
    );
  }

  const departments = [...new Set(data.map((d) => d.department))];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-jungle-green to-light-sea-green">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl text-white">ORGANIZATIONAL STRUCTURE</h3>
              <p className="text-sm text-white/80">
                {departments.length} departments, {data.length} unique roles
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-6">
          {departments.map((department) => {
            const deptData = data.filter((d) => d.department === department);
            const teams = [...new Set(deptData.map((d) => d.team))];
            const totalEmployees = deptData.reduce((sum, d) => sum + d.employeeCount, 0);

            return (
              <div key={department} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-space-cadet/5 to-yale-blue/5 p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-space-cadet rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{department}</h4>
                        <p className="text-xs text-gray-600">
                          {teams.length} teams • {totalEmployees} employees
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  {teams.map((team) => {
                    const teamData = deptData.filter((d) => d.team === team);

                    return (
                      <div key={team} className="bg-white">
                        <div className="p-4 bg-light-sea-green/5">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-light-sea-green" />
                            <span className="font-semibold text-sm text-gray-900">{team}</span>
                            <span className="text-xs text-gray-600">
                              ({teamData.reduce((sum, d) => sum + d.employeeCount, 0)} members)
                            </span>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left py-2 px-4 text-xs font-semibold text-gray-600">
                                  Role
                                </th>
                                <th className="text-left py-2 px-4 text-xs font-semibold text-gray-600">
                                  Employees
                                </th>
                                <th className="text-left py-2 px-4 text-xs font-semibold text-gray-600">
                                  Key Tasks
                                </th>
                                <th className="text-right py-2 px-4 text-xs font-semibold text-gray-600">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {teamData.map((item) => (
                                <tr key={item.role} className="border-t border-gray-100">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <Briefcase className="w-4 h-4 text-gray-400" />
                                      <span className="text-sm font-medium text-gray-900">
                                        {item.role}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="inline-flex items-center justify-center w-8 h-8 bg-jungle-green/10 text-jungle-green rounded-full text-sm font-bold">
                                      {item.employeeCount}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    {item.keyTasks.length > 0 ? (
                                      <div className="flex items-center gap-2">
                                        <ListChecks className="w-4 h-4 text-green-600" />
                                        <span className="text-sm text-gray-700">
                                          {item.keyTasks.length} task{item.keyTasks.length !== 1 ? 's' : ''}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-sm text-gray-400">No tasks defined</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    {item.keyTasks.length === 0 && (
                                      <button
                                        onClick={() =>
                                          onGenerateTasks(item.department, item.team, item.role)
                                        }
                                        className="px-3 py-1 bg-light-sea-green hover:bg-jungle-green text-white rounded-lg transition-all duration-200 text-xs font-medium"
                                      >
                                        Generate Tasks
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
