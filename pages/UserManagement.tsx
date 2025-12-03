import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Role, Permission } from '../types';
import { ALL_PERMISSIONS, ROLE_PRESETS } from '../constants';
import { Users, Plus, Edit2, Trash2, Shield, X, Save, Lock, KeyRound } from 'lucide-react';

const UserManagement: React.FC = () => {
  const { users, addUser, updateUser, deleteUser, currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Partial<User>>({});

  const handleAddNew = () => {
    setSelectedUser({
      name: '',
      code: '',
      role: 'STAFF',
      permissions: [...ROLE_PRESETS.STAFF]
    });
    setIsEditing(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUser({ ...user });
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      deleteUser(id);
    }
  };

  const handleRoleChange = (role: Role) => {
    setSelectedUser(prev => ({
      ...prev,
      role,
      permissions: [...ROLE_PRESETS[role]]
    }));
  };

  const togglePermission = (permission: Permission) => {
    setSelectedUser(prev => {
      const currentPerms = prev.permissions || [];
      const hasPerm = currentPerms.includes(permission);
      const newPerms = hasPerm
        ? currentPerms.filter(p => p !== permission)
        : [...currentPerms, permission];
      
      return { ...prev, permissions: newPerms };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser.name || !selectedUser.code) return;

    if (selectedUser.id) {
      updateUser(selectedUser as User);
    } else {
      addUser(selectedUser as Omit<User, 'id'>);
    }
    setIsEditing(false);
  };

  return (
    <div className="pb-16">
      <div className="mb-6 flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Users className="text-slate-600" /> User Management
           </h2>
           <p className="text-slate-500 text-sm md:text-base">Manage staff access and permissions.</p>
        </div>
        {!isEditing && (
          <button 
            onClick={handleAddNew}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-medium"
          >
            <Plus size={18} />
            <span className="hidden md:inline">Add User</span>
            <span className="md:hidden">Add</span>
          </button>
        )}
      </div>

      {isEditing && (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 mb-8 animate-fade-in">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-2">
            <h3 className="text-lg font-bold text-slate-800">
              {selectedUser.id ? 'Edit User' : 'New User'}
            </h3>
            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={selectedUser.name || ''}
                  onChange={e => setSelectedUser({...selectedUser, name: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. John Doe"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Access Code</label>
                <div className="relative">
                  <input 
                    type="text" 
                    required
                    value={selectedUser.code || ''}
                    onChange={e => setSelectedUser({...selectedUser, code: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                    placeholder="e.g. admin123"
                  />
                  <KeyRound className="absolute left-3 top-2.5 text-slate-400" size={16} />
                </div>
                <p className="text-xs text-slate-500 mt-1">Alphanumeric code used for login.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Role & Permissions</label>
              
              {/* Role Presets */}
              <div className="flex gap-2 mb-6">
                {(['ADMIN', 'MANAGER', 'STAFF'] as Role[]).map(role => (
                   <button
                     key={role}
                     type="button"
                     onClick={() => handleRoleChange(role)}
                     className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all border ${
                       selectedUser.role === role
                         ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                         : 'bg-white text-slate-600 border-slate-300 hover:bg-white hover:border-slate-400'
                     }`}
                   >
                     {role}
                   </button>
                ))}
              </div>

              {/* Granular Permissions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 {ALL_PERMISSIONS.map(perm => {
                   const isChecked = selectedUser.permissions?.includes(perm.id);
                   return (
                     <label key={perm.id} className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                       <input 
                         type="checkbox"
                         checked={isChecked}
                         onChange={() => togglePermission(perm.id)}
                         className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                       />
                       <span className={`text-sm ${isChecked ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                         {perm.label}
                       </span>
                     </label>
                   );
                 })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button 
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <Save size={18} />
                Save User
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="p-4 w-12 text-center">#</th>
                <th className="p-4">User</th>
                <th className="hidden md:table-cell p-4">Role</th>
                <th className="hidden sm:table-cell p-4">Access Level</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user, index) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-center text-slate-400 text-sm">
                    {index + 1}
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-700">{user.name}</div>
                    <div className="text-xs text-slate-400 font-mono">
                      Code: {user.code.length > 2 ? '•'.repeat(user.code.length - 2) + user.code.slice(-2) : '***'}
                    </div>
                  </td>
                  <td className="hidden md:table-cell p-4">
                     <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                       user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                       user.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' :
                       'bg-slate-100 text-slate-700'
                     }`}>
                       {user.role}
                     </span>
                  </td>
                  <td className="hidden sm:table-cell p-4">
                    <div className="flex flex-wrap gap-1">
                      {user.permissions.length === ALL_PERMISSIONS.length ? (
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <Shield size={12} /> Full Access
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {user.permissions.length} permissions granted
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(user)}
                        className="p-2 md:p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} className="md:w-4 md:h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(user.id)}
                        disabled={currentUser?.id === user.id}
                        className="p-2 md:p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                        title="Delete"
                      >
                        <Trash2 size={18} className="md:w-4 md:h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;