import { ChevronDown, ChevronRight, Building2, Users, Briefcase, CheckSquare } from 'lucide-react';
import { useState } from 'react';

interface OrgNode {
  department: string;
  teams: {
    team: string;
    roles: {
      role: string;
      count: number;
      tasks: string[];
    }[];
  }[];
}

interface OrgChartProps {
  data: {
    department: string;
    team: string;
    role: string;
    employeeCount: number;
    keyTasks: string[];
  }[];
}

export default function OrgChart({ data }: OrgChartProps) {
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleDepartment = (dept: string) => {
    const newExpanded = new Set(expandedDepts);
    if (newExpanded.has(dept)) {
      newExpanded.delete(dept);
    } else {
      newExpanded.add(dept);
    }
    setExpandedDepts(newExpanded);
  };

  const toggleTeam = (key: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedTeams(newExpanded);
  };

  const toggleRole = (key: string) => {
    const newExpanded = new Set(expandedRoles);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedRoles(newExpanded);
  };

  const organizeData = (): OrgNode[] => {
    const deptMap = new Map<string, Map<string, Map<string, { count: number; tasks: string[] }>>>();

    data.forEach((item) => {
      if (!deptMap.has(item.department)) {
        deptMap.set(item.department, new Map());
      }
      const teamMap = deptMap.get(item.department)!;

      if (!teamMap.has(item.team)) {
        teamMap.set(item.team, new Map());
      }
      const roleMap = teamMap.get(item.team)!;

      roleMap.set(item.role, {
        count: item.employeeCount,
        tasks: item.keyTasks,
      });
    });

    const result: OrgNode[] = [];
    deptMap.forEach((teamMap, department) => {
      const teams: { team: string; roles: { role: string; count: number; tasks: string[] }[] }[] = [];
      teamMap.forEach((roleMap, team) => {
        const roles: { role: string; count: number; tasks: string[] }[] = [];
        roleMap.forEach((data, role) => {
          roles.push({ role, count: data.count, tasks: data.tasks });
        });
        teams.push({ team, roles });
      });
      result.push({ department, teams });
    });

    return result;
  };

  const orgData = organizeData();

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-space-cadet to-yale-blue rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-gray-900">Organization Chart</h3>
            <p className="text-sm text-gray-600">Visual hierarchy of departments, teams, and roles</p>
          </div>
        </div>
        <div className={`transform transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}>
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </div>
      </button>

      {!isCollapsed && (
        <div className="p-6 pt-0">
          <div className="space-y-2">
            {orgData.map((dept) => {
              const deptKey = dept.department;
              const isDeptExpanded = expandedDepts.has(deptKey);
              const totalEmployees = dept.teams.reduce(
                (sum, team) => sum + team.roles.reduce((s, role) => s + role.count, 0),
                0
              );

              return (
                <div key={deptKey} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleDepartment(deptKey)}
                    className="w-full p-4 bg-gradient-to-r from-space-cadet/5 to-yale-blue/5 hover:from-space-cadet/10 hover:to-yale-blue/10 flex items-center justify-between transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      {isDeptExpanded ? (
                        <ChevronDown className="w-5 h-5 text-space-cadet" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-space-cadet" />
                      )}
                      <Building2 className="w-5 h-5 text-space-cadet" />
                      <div className="text-left">
                        <div className="font-bold text-gray-900">{dept.department}</div>
                        <div className="text-xs text-gray-600">
                          {dept.teams.length} teams • {totalEmployees} employees
                        </div>
                      </div>
                    </div>
                  </button>

                  {isDeptExpanded && (
                    <div className="p-4 pl-12 space-y-2 bg-white">
                      {dept.teams.map((team) => {
                        const teamKey = `${deptKey}-${team.team}`;
                        const isTeamExpanded = expandedTeams.has(teamKey);
                        const teamTotal = team.roles.reduce((sum, role) => sum + role.count, 0);

                        return (
                          <div key={teamKey} className="border-l-2 border-light-sea-green/30 pl-4">
                            <button
                              onClick={() => toggleTeam(teamKey)}
                              className="w-full p-3 bg-light-sea-green/5 hover:bg-light-sea-green/10 rounded-lg flex items-center justify-between transition-all duration-200"
                            >
                              <div className="flex items-center gap-3">
                                {isTeamExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-light-sea-green" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-light-sea-green" />
                                )}
                                <Users className="w-4 h-4 text-light-sea-green" />
                                <div className="text-left">
                                  <div className="font-semibold text-gray-900 text-sm">{team.team}</div>
                                  <div className="text-xs text-gray-600">
                                    {team.roles.length} roles • {teamTotal} members
                                  </div>
                                </div>
                              </div>
                            </button>

                            {isTeamExpanded && (
                              <div className="mt-2 ml-8 space-y-2">
                                {team.roles.map((role) => {
                                  const roleKey = `${teamKey}-${role.role}`;
                                  const isRoleExpanded = expandedRoles.has(roleKey);

                                  return (
                                    <div
                                      key={roleKey}
                                      className="border border-gray-200 rounded-lg overflow-hidden"
                                    >
                                      <button
                                        onClick={() => toggleRole(roleKey)}
                                        className="w-full p-3 bg-green-yellow/5 hover:bg-green-yellow/10 flex items-center justify-between transition-all duration-200"
                                      >
                                        <div className="flex items-center gap-3">
                                          {isRoleExpanded ? (
                                            <ChevronDown className="w-4 h-4 text-jungle-green" />
                                          ) : (
                                            <ChevronRight className="w-4 h-4 text-jungle-green" />
                                          )}
                                          <Briefcase className="w-4 h-4 text-jungle-green" />
                                          <div className="text-left">
                                            <div className="font-medium text-gray-900 text-sm">
                                              {role.role}
                                            </div>
                                            <div className="text-xs text-gray-600">
                                              {role.count} employee{role.count !== 1 ? 's' : ''} •{' '}
                                              {role.tasks.length} task{role.tasks.length !== 1 ? 's' : ''}
                                            </div>
                                          </div>
                                        </div>
                                      </button>

                                      {isRoleExpanded && role.tasks.length > 0 && (
                                        <div className="p-3 bg-white border-t border-gray-200">
                                          <div className="flex items-center gap-2 mb-2">
                                            <CheckSquare className="w-4 h-4 text-green-600" />
                                            <span className="text-xs font-semibold text-gray-700 uppercase">
                                              Key Tasks
                                            </span>
                                          </div>
                                          <ul className="space-y-1 ml-6">
                                            {role.tasks.map((task, idx) => (
                                              <li
                                                key={idx}
                                                className="text-sm text-gray-700 flex items-start gap-2"
                                              >
                                                <span className="text-jungle-green">•</span>
                                                <span>{task}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
