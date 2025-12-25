


import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { User, Role, Permission } from '../types';
import { ALL_PERMISSIONS, ROLE_PRESETS, APP_PAGES } from '../constants';
import { Users, Plus, Edit2, Trash2, Shield, X, Save, KeyRound, CalendarDays, Clock, Check, XCircle, Store, ChevronLeft, ChevronRight, Image as ImageIcon, LayoutDashboard } from 'lucide-react';

const UserManagement: React.FC = () => {
  const { users, addUser, updateUser, deleteUser, currentUser } = useAuth();
  const { attendanceRecords, branches } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Partial<User>>({});
  
  // Attendance View Modal State
  const [viewingAttendanceFor, setViewingAttendanceFor] = useState<User | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleAddNew = () => {
    setSelectedUser({
      name: '',
      code: '',
      role: 'STAFF',
      permissions: [...ROLE_PRESETS.STAFF],
      defaultBranchId: '',
      defaultPage: '/dashboard'
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

  const openAttendanceModal = (user: User) => {
      setViewingAttendanceFor(user);
      setViewDate(new Date()); // Reset to current month when opening
  };

  const changeMonth = (delta: number) => {
      setViewDate(prev => {
          const newDate = new Date(prev);
          newDate.setMonth(newDate.getMonth() + delta);
          return newDate;
      });
  };

  // --- Attendance Logic ---
  const attendanceStats = useMemo(() => {
    if (!viewingAttendanceFor) return null;

    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun, 1 = Mon...

    // Filter records for this user & selected month
    const monthlyRecords = attendanceRecords
      .filter(r => {
         const d = new Date(r.date);
         return r.userId === viewingAttendanceFor.id && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .sort((a, b) => b.timestamp - a.timestamp); // Sort newest first

    const presentCount = monthlyRecords.length;
    
    // Absent Logic: 
    // If viewing past month: Absent = DaysInMonth - Present
    // If viewing current month: Absent = DaysPassedSoFar - Present
    // If viewing future month: 0
    
    const today = new Date();
    let absentCount = 0;

    if (currentYear < today.getFullYear() || (currentYear === today.getFullYear() && currentMonth < today.getMonth())) {
        // Past Month
        absentCount = daysInMonth - presentCount;
    } else if (currentYear === today.getFullYear() && currentMonth === today.getMonth()) {
        // Current Month
        const daysPassed = today.getDate();
        absentCount = Math.max(0, daysPassed - presentCount);
    } else {
        // Future Month
        absentCount = 0;
    }

    // Avg Check-in Time
    let avgTimeStr = '--:--';
    if (presentCount > 0) {
       const totalMinutes = monthlyRecords.reduce((acc, r) => {
          const d = new Date(r.timestamp);
          return acc + (d.getHours() * 60) + d.getMinutes();
       }, 0);
       const avgTotalMinutes = Math.floor(totalMinutes / presentCount);
       const hours = Math.floor(avgTotalMinutes / 60);
       const mins = avgTotalMinutes % 60;
       const ampm = hours >= 12 ? 'PM' : 'AM';
       const formattedHours = hours % 12 || 12;
       avgTimeStr = `${formattedHours}:${mins.toString().padStart(2, '0')} ${ampm}`;
    }

    return {
       presentCount,
       absentCount,
       avgTimeStr,
       monthlyRecords,
       monthLabel: viewDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
       daysInMonth,
       startDayOfWeek,
       currentMonthIndex: currentMonth,
       currentYear
    };

  }, [viewingAttendanceFor, attendanceRecords, viewDate]);

  // Helper to render calendar grid
  const renderCalendar = () => {
     if (!attendanceStats) return null;
     const days = [];
     
     // Empty slots for days before the 1st
     for (let i = 0; i < attendanceStats.startDayOfWeek; i++) {
         days.push(<div key={`empty-${i}`} className="aspect-square"></div>);
     }

     const today = new Date();
     const isCurrentMonth = today.getMonth() === attendanceStats.currentMonthIndex && today.getFullYear() === attendanceStats.currentYear;

     for (let i = 1; i <= attendanceStats.daysInMonth; i++) {
        const dateStr = `${attendanceStats.currentYear}-${(attendanceStats.currentMonthIndex + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
        const record = attendanceStats.monthlyRecords.find(r => r.date === dateStr);
        
        const isToday = isCurrentMonth && i === today.getDate();
        const isFuture = isCurrentMonth && i > today.getDate() || (today < new Date(attendanceStats.currentYear, attendanceStats.currentMonthIndex, i));
        
        // Style Logic:
        // Green = Present
        // Red = Absent (Past days only)
        // Slate = Future or Today (if not checked in yet)
        
        let bgClass = 'bg-slate-50 border-slate-100 text-slate-300'; // Default future
        
        if (record) {
            bgClass = 'bg-emerald-100 border-emerald-200 text-emerald-800 font-bold';
        } else if (!isFuture) {
             bgClass = 'bg-red-50 border-red-100 text-red-400';
        }

        if (isToday && !record) {
             bgClass = 'bg-blue-50 border-blue-200 text-blue-500 ring-1 ring-blue-300';
        }

        days.push(
           <div key={i} className={`aspect-square rounded-lg flex items-center justify-center text-sm border transition-all ${bgClass}`}>
              {i}
           </div>
        );
     }
     return days;
  };

  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name || 'Unknown';

  return (
    <div className="pb-16 relative">
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

              {/* Default Branch Selection */}
              <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                     <Store size={14} /> Default Branch / Location
                  </label>
                  <select 
                     value={selectedUser.defaultBranchId || ''}
                     onChange={e => setSelectedUser({...selectedUser, defaultBranchId: e.target.value})}
                     className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                     <option value="">No Default (User selects manually)</option>
                     {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                     ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Pre-selects this location when the user takes attendance.</p>
              </div>

              {/* Default Page Selection */}
              <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                     <LayoutDashboard size={14} /> Default Landing Page
                  </label>
                  <select 
                     value={selectedUser.defaultPage || '/dashboard'}
                     onChange={e => setSelectedUser({...selectedUser, defaultPage: e.target.value})}
                     className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                     {APP_PAGES.map(page => (
                        <option key={page.path} value={page.path}>{page.label}</option>
                     ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Where to redirect this user after login.</p>
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
                        onClick={() => openAttendanceModal(user)}
                        className="p-2 md:p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="View Attendance"
                      >
                         <CalendarDays size={18} className="md:w-4 md:h-4" />
                      </button>
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

      {/* --- ATTENDANCE MODAL --- */}
      {viewingAttendanceFor && attendanceStats && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
               {/* Modal Header */}
               <div className="p-5 border-b border-slate-100 flex justify-between items-center rounded-t-xl bg-slate-50">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                        {viewingAttendanceFor.name.charAt(0).toUpperCase()}
                     </div>
                     <div>
                        <h3 className="text-lg font-bold text-slate-800">{viewingAttendanceFor.name}</h3>
                        <p className="text-xs text-slate-500">Attendance Report</p>
                     </div>
                  </div>
                  <button onClick={() => setViewingAttendanceFor(null)} className="text-slate-400 hover:text-slate-600">
                     <X size={24} />
                  </button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-5">
                  {/* Month Navigation */}
                  <div className="flex items-center justify-between mb-4 bg-slate-50 p-2 rounded-lg border border-slate-200">
                     <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white rounded-md transition-colors text-slate-500 hover:text-indigo-600">
                        <ChevronLeft size={20} />
                     </button>
                     <h4 className="font-bold text-slate-700">{attendanceStats.monthLabel}</h4>
                     <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white rounded-md transition-colors text-slate-500 hover:text-indigo-600">
                        <ChevronRight size={20} />
                     </button>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                     <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-center">
                        <div className="flex items-center justify-center text-emerald-600 mb-1"><Check size={16} /></div>
                        <div className="text-lg font-bold text-emerald-700 leading-none">{attendanceStats.presentCount}</div>
                        <div className="text-[10px] text-emerald-600 uppercase font-semibold mt-1">Present</div>
                     </div>
                     <div className="bg-red-50 border border-red-100 p-3 rounded-lg text-center">
                        <div className="flex items-center justify-center text-red-500 mb-1"><XCircle size={16} /></div>
                        <div className="text-lg font-bold text-red-700 leading-none">{attendanceStats.absentCount}</div>
                        <div className="text-[10px] text-red-600 uppercase font-semibold mt-1">Absent/Off</div>
                     </div>
                     <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-center">
                        <div className="flex items-center justify-center text-blue-500 mb-1"><Clock size={16} /></div>
                        <div className="text-sm font-bold text-blue-700 leading-none mt-1">{attendanceStats.avgTimeStr}</div>
                        <div className="text-[10px] text-blue-600 uppercase font-semibold mt-1">Avg Check-in</div>
                     </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="mb-6">
                     <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Calendar View</h4>
                     <div className="grid grid-cols-7 gap-1">
                        {['S','M','T','W','T','F','S'].map((d, i) => (
                           <div key={i} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>
                        ))}
                        {renderCalendar()}
                     </div>
                  </div>

                  {/* Recent History List with Locations */}
                  <div>
                     <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Check-in History</h4>
                     {attendanceStats.monthlyRecords.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-2">No records found for this month.</p>
                     ) : (
                        <div className="space-y-2">
                           {attendanceStats.monthlyRecords.map(record => (
                              <div key={record.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                                 <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                       <Check size={14} />
                                    </div>
                                    <div>
                                       <div className="font-bold text-slate-700">{record.date}</div>
                                       <div className="text-xs text-slate-500 flex items-center gap-1">
                                          <Store size={10} /> {getBranchName(record.branchId)}
                                       </div>
                                       {record.imageUrl && (
                                          <button 
                                            onClick={() => setPreviewImage(record.imageUrl)}
                                            className="text-[10px] flex items-center gap-1 text-blue-600 hover:text-blue-800 mt-1 font-medium transition-colors"
                                          >
                                             <ImageIcon size={12} /> View Photo
                                          </button>
                                       )}
                                    </div>
                                 </div>
                                 <div className="text-right font-mono font-medium text-slate-600">
                                    {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </div>

               <div className="p-4 border-t border-slate-100 bg-white rounded-b-xl flex justify-end">
                  <button 
                     onClick={() => setViewingAttendanceFor(null)}
                     className="px-6 py-2 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors text-sm"
                  >
                     Close
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* --- PHOTO PREVIEW OVERLAY --- */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
           <div className="relative max-w-lg w-full flex flex-col items-center">
              <button 
                onClick={() => setPreviewImage(null)}
                className="absolute -top-12 right-0 text-white hover:text-red-400 transition-colors p-2"
              >
                <X size={32} />
              </button>
              <img 
                src={previewImage} 
                alt="Attendance Proof" 
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-white/10"
                onClick={(e) => e.stopPropagation()} 
              />
           </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;