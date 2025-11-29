import { useState, useEffect } from 'react';
import { Shield, Users, Key, Activity, Download, UserPlus, Edit, Trash2, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService, UserProfile, Role, Permission } from '../services/authService';
import { supabase } from '../lib/supabase';

interface UserWithRoles extends UserProfile {
  roles: string[];
}

export default function Admin() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'audit'>('users');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [rolesData, permsData, logsData] = await Promise.all([
      authService.getAllRoles(),
      authService.getAllPermissions(),
      authService.getAuditLogs(),
    ]);

    setRoles(rolesData);
    setPermissions(permsData);
    setAuditLogs(logsData);

    await loadUsers();
  };

  const loadUsers = async () => {
    const { data: profiles } = await supabase.from('user_profiles').select('*');

    if (profiles) {
      const usersWithRoles = await Promise.all(
        profiles.map(async (profile) => {
          const userRoles = await authService.getUserRoles(profile.id);
          return {
            ...profile,
            roles: userRoles.map((r) => r.name),
          };
        })
      );
      setUsers(usersWithRoles);
    }
  };

  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    await supabase
      .from('user_profiles')
      .update({ is_active: !isActive })
      .eq('id', userId);

    await loadUsers();
    setSuccessMessage(`User ${!isActive ? 'activated' : 'deactivated'} successfully`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleAssignRole = async (userId: string, roleName: string) => {
    await authService.assignRole(userId, roleName);
    await loadUsers();
    setShowRoleModal(false);
    setSuccessMessage(`Role assigned successfully`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleRemoveRole = async (userId: string, roleName: string) => {
    await authService.removeRole(userId, roleName);
    await loadUsers();
    setSuccessMessage(`Role removed successfully`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const exportAuditLogs = () => {
    const csv = [
      'Date,User,Email,Event,IP Address',
      ...auditLogs.map(
        (log) =>
          `${new Date(log.created_at).toLocaleString()},${log.user_id || 'N/A'},${log.email},${
            log.event_type
          },${log.ip_address || 'N/A'}`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'audit-logs.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!hasPermission('roles.manage')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl text-space-cadet font-bebas tracking-wide">ADMIN PANEL</h1>
              <p className="text-sm text-gray-600">User management and system administration</p>
            </div>
          </div>
        </div>
      </header>

      {showSuccess && (
        <div className="fixed top-20 right-8 z-50 animate-in slide-in-from-top">
          <div className="bg-green-50 border-2 border-green-200 rounded-xl px-6 py-4 shadow-xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-semibold text-green-800">{successMessage}</span>
          </div>
        </div>
      )}

      <main className="p-8">
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-light-sea-green to-jungle-green text-white shadow-md'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-light-sea-green'
            }`}
          >
            <Users className="w-5 h-5" />
            User Management
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'roles'
                ? 'bg-gradient-to-r from-light-sea-green to-jungle-green text-white shadow-md'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-light-sea-green'
            }`}
          >
            <Key className="w-5 h-5" />
            Roles & Permissions
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'bg-gradient-to-r from-light-sea-green to-jungle-green text-white shadow-md'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-light-sea-green'
            }`}
          >
            <Activity className="w-5 h-5" />
            Audit Logs
          </button>
        </div>

        {activeTab === 'users' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Users ({users.length})</h2>
                <button className="px-4 py-2 bg-gradient-to-r from-jungle-green to-light-sea-green text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all duration-200">
                  <UserPlus className="w-4 h-4" />
                  Invite User
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">User</th>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Company</th>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Department</th>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Roles</th>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div>
                          <div className="font-semibold text-gray-900">{user.full_name}</div>
                          <div className="text-sm text-gray-600">{user.email}</div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-700">{user.company || '-'}</td>
                      <td className="py-4 px-6 text-sm text-gray-700">{user.department || '-'}</td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <span
                              key={role}
                              className="px-2 py-1 bg-light-sea-green/20 text-jungle-green rounded text-xs font-medium"
                            >
                              {role}
                            </span>
                          ))}
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowRoleModal(true);
                            }}
                            className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200"
                          >
                            + Add
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            user.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                            className="p-2 text-gray-600 hover:text-jungle-green hover:bg-gray-100 rounded"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="grid grid-cols-2 gap-8">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Roles ({roles.length})</h2>
              </div>
              <div className="p-6 space-y-3">
                {roles.map((role) => (
                  <div key={role.id} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-1">{role.name}</h3>
                    <p className="text-sm text-gray-600">{role.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  Permissions ({permissions.length})
                </h2>
              </div>
              <div className="p-6 space-y-3 max-h-[600px] overflow-y-auto">
                {permissions.map((perm) => (
                  <div key={perm.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-sm text-gray-900">{perm.name}</h3>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        {perm.resource}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{perm.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Audit Logs ({auditLogs.length})
                </h2>
                <button
                  onClick={exportAuditLogs}
                  className="px-4 py-2 bg-gradient-to-r from-jungle-green to-light-sea-green text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all duration-200"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                      Timestamp
                    </th>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Email</th>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Event</th>
                    <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                      IP Address
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-6 text-sm text-gray-700">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-6 text-sm text-gray-700">{log.email}</td>
                      <td className="py-3 px-6">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            log.event_type === 'login'
                              ? 'bg-green-100 text-green-700'
                              : log.event_type === 'login_failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {log.event_type}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-sm text-gray-700">{log.ip_address || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Manage Roles for {selectedUser.full_name}
            </h3>
            <div className="space-y-2 mb-6">
              {roles.map((role) => {
                const hasRole = selectedUser.roles.includes(role.name);
                return (
                  <div key={role.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-semibold text-sm">{role.name}</div>
                      <div className="text-xs text-gray-600">{role.description}</div>
                    </div>
                    {hasRole ? (
                      <button
                        onClick={() => handleRemoveRole(selectedUser.id, role.name)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAssignRole(selectedUser.id, role.name)}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-medium hover:bg-green-200"
                      >
                        Assign
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setShowRoleModal(false)}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
