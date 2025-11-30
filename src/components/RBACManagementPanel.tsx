import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Key,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { rbacService } from '../services/rbacService';

export function RBACManagementPanel() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'roles' | 'permissions' | 'templates' | 'audit'>('roles');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [showCreateRole, setShowCreateRole] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      rbacService.expireRoleAssignments();
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesData, permissionsData, templatesData, auditData] = await Promise.all([
        rbacService.getRoles(),
        rbacService.getPermissions(),
        rbacService.getRoleTemplates(),
        rbacService.getAuditLog({ limit: 50 }),
      ]);

      setRoles(rolesData);
      setPermissions(permissionsData);
      setTemplates(templatesData);
      setAuditLog(auditData);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      await rbacService.deleteRole(roleId);
      alert('Role deleted successfully');
      await loadData();
    } catch (error) {
      alert('Failed to delete role');
    }
  };

  const getRoleLevelColor = (level: number) => {
    if (level >= 80) return 'text-red-600 font-bold';
    if (level >= 60) return 'text-orange-600 font-semibold';
    if (level >= 40) return 'text-yellow-600 font-medium';
    return 'text-gray-600';
  };

  const getRoleBadge = (role: any) => {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: role.colorCode }}
        ></div>
        <span className="font-medium text-gray-900">{role.name}</span>
        {role.isSystemRole && (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">System</span>
        )}
      </div>
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
            RBAC Management
          </h2>
          <p className="text-gray-600">Manage roles, permissions, and access control</p>
        </div>

        <button
          onClick={() => setShowCreateRole(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Role
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Roles', value: roles.length, icon: Shield, color: 'bg-blue-500' },
          { label: 'Permissions', value: permissions.length, icon: Key, color: 'bg-green-500' },
          { label: 'Templates', value: templates.length, icon: FileText, color: 'bg-purple-500' },
          { label: 'Audit Entries', value: auditLog.length, icon: Clock, color: 'bg-orange-500' },
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
            { id: 'roles', label: 'Roles', icon: Shield },
            { id: 'permissions', label: 'Permissions', icon: Key },
            { id: 'templates', label: 'Templates', icon: FileText },
            { id: 'audit', label: 'Audit Log', icon: Clock },
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

      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Level</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">{getRoleBadge(role)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-sm ${getRoleLevelColor(role.roleLevel)}`}>
                        Level {role.roleLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{role.description || 'No description'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {role.isAssignable ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          <Check className="w-3 h-3" />
                          Assignable
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                          <X className="w-3 h-3" />
                          Not Assignable
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedRole(role.id)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit Permissions"
                        >
                          <Key className="w-4 h-4" />
                        </button>

                        {!role.isSystemRole && (
                          <>
                            <button
                              className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                              title="Edit Role"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteRole(role.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Delete Role"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">System Permissions</h3>
            <p className="text-sm text-gray-600">Available permissions that can be assigned to roles</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {permissions.map((permission) => (
                <div key={permission.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Key className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 text-sm">{permission.name}</h4>
                      <p className="text-xs text-gray-600 mt-1">{permission.resource}.{permission.action}</p>
                      {permission.description && (
                        <p className="text-xs text-gray-500 mt-2">{permission.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-4">
          {templates.map((template) => (
            <div key={template.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{template.templateName}</h3>
                    {template.isRecommended && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <FileText className="w-4 h-4" />
                    <span>Use case: {template.useCase}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {template.permissionKeys.slice(0, 5).map((key: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                      >
                        {key}
                      </span>
                    ))}
                    {template.permissionKeys.length > 5 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        +{template.permissionKeys.length - 5} more
                      </span>
                    )}
                  </div>
                </div>

                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                  Apply Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Audit Log</h3>
            <p className="text-sm text-gray-600">All RBAC changes and permission assignments</p>
          </div>

          <div className="divide-y divide-gray-100">
            {auditLog.map((log) => (
              <div key={log.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Clock className="w-5 h-5 text-gray-400" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 capitalize">
                        {log.event_type.replace(/_/g, ' ')}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                        {log.action}
                      </span>
                      {log.success ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                    </div>

                    <p className="text-sm text-gray-600">
                      {log.actor_email || 'System'} • {new Date(log.created_at).toLocaleString()}
                    </p>

                    {log.reason && (
                      <p className="text-sm text-gray-500 mt-2">
                        Reason: {log.reason}
                      </p>
                    )}
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
