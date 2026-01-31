




import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { User, Role, Permission, AttendanceOverrideType, AttendanceRecord } from '../types';
import { ALL_PERMISSIONS, ROLE_PRESETS, APP_PAGES } from '../constants';
import { Users, Plus, Edit2, Trash2, Shield, X, Save, KeyRound, CalendarDays, Clock, Check, XCircle, Store, ChevronLeft, ChevronRight, Image as ImageIcon, LayoutDashboard, Palmtree, AlertCircle, AlertTriangle, Camera, ArrowDown, ArrowUp, Globe } from 'lucide-react';

const UserManagement: React.FC = () => {
  const { users, addUser, updateUser, deleteUser, currentUser } = useAuth();
  const { attendanceRecords, branches, attendanceOverrides, setAttendanceStatus } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Partial<User>>({});

  // Attendance View Modal State
  const [viewingAttendanceFor, setViewingAttendanceFor] = useState<User | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [previewRecord, setPreviewRecord] = useState<AttendanceRecord | null>(null);

  // Day Action Modal
  const [selectedDayAction, setSelectedDayAction] = useState<{ date: string, formattedDate: string } | null>(null);

  const handleAddNew = () => {
    setSelectedUser({
      name: '',
      code: '',
      role: 'STAFF',
      permissions: [...ROLE_PRESETS.STAFF],
      defaultBranchId: '',
      defaultPage: '/dashboard',
      isStagedAttendanceEnabled: false,
      stagedAttendanceConfig: []
    });
    setIsEditing(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUser({
      ...user,
      stagedAttendanceConfig: user.stagedAttendanceConfig || []
    });
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

  // --- Staged Attendance Helpers ---
  const addStage = () => {
    const newStage = {
      id: Date.now().toString(),
      title: `Stage ${(selectedUser.stagedAttendanceConfig?.length || 0) + 1}`,
      cameraFacingMode: 'user' as const,
      sendToWebhook: false
    };
    setSelectedUser(prev => ({
      ...prev,
      stagedAttendanceConfig: [...(prev.stagedAttendanceConfig || []), newStage]
    }));
  };

  const removeStage = (index: number) => {
    setSelectedUser(prev => ({
      ...prev,
      stagedAttendanceConfig: (prev.stagedAttendanceConfig || []).filter((_, i) => i !== index)
    }));
  };

  const updateStage = (index: number, field: string, value: any) => {
    setSelectedUser(prev => {
      const newConfig = [...(prev.stagedAttendanceConfig || [])];
      newConfig[index] = { ...newConfig[index], [field]: value };
      return { ...prev, stagedAttendanceConfig: newConfig };
    });
  };

  const moveStage = (index: number, direction: 'up' | 'down') => {
    setSelectedUser(prev => {
      const newConfig = [...(prev.stagedAttendanceConfig || [])];
      if (direction === 'up' && index > 0) {
        [newConfig[index], newConfig[index - 1]] = [newConfig[index - 1], newConfig[index]];
      } else if (direction === 'down' && index < newConfig.length - 1) {
        [newConfig[index], newConfig[index + 1]] = [newConfig[index + 1], newConfig[index]];
      }
      return { ...prev, stagedAttendanceConfig: newConfig };
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

    // Filter overrides for this user & selected month
    const monthlyOverrides = attendanceOverrides.filter(o => {
      const d = new Date(o.date);
      return o.userId === viewingAttendanceFor.id && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const presentCount = monthlyRecords.length + monthlyOverrides.filter(o => o.type === 'PRESENT').length;

    // Calculated Penalty/Absent Count
    // Logic: Iterate days up to today. 
    // If override exists: add penalty based on type.
    // If no override and no check-in: add 1 penalty.

    const today = new Date();
    let totalDeductibleDays = 0;

    // Limit calculation loop
    let daysToCalculate = daysInMonth;
    if (currentYear === today.getFullYear() && currentMonth === today.getMonth()) {
      daysToCalculate = today.getDate();
    } else if (currentYear > today.getFullYear() || (currentYear === today.getFullYear() && currentMonth > today.getMonth())) {
      daysToCalculate = 0; // Future month
    }

    for (let i = 1; i <= daysToCalculate; i++) {
      const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;

      // Check for override first
      const override = monthlyOverrides.find(o => o.date === dateStr);
      const record = monthlyRecords.find(r => r.date === dateStr);

      if (override) {
        if (override.type === 'ABSENT') totalDeductibleDays += 1;
        else if (override.type === 'PENALTY_2_DAYS') totalDeductibleDays += 2;
        // HOLIDAY adds 0
      } else {
        // No override. If no record, count as absent (1 day)
        // But if it is TODAY and no record yet, maybe don't count? 
        // Standard logic: If today has passed without checkin, it's absent. 
        // For live view, counting today as absent before day ends might be harsh, but let's stick to simple logic.
        if (!record) {
          // If it's today, only count if it's late? For simplicity, we count past days.
          if (dateStr !== today.toISOString().slice(0, 10)) {
            totalDeductibleDays += 1;
          }
        }
      }
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
      totalDeductibleDays,
      avgTimeStr,
      monthlyRecords,
      monthlyOverrides,
      monthLabel: viewDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
      daysInMonth,
      startDayOfWeek,
      currentMonthIndex: currentMonth,
      currentYear
    };

  }, [viewingAttendanceFor, attendanceRecords, attendanceOverrides, viewDate]);

  const handleDayClick = (day: number) => {
    if (!attendanceStats) return;
    const dateStr = `${attendanceStats.currentYear}-${(attendanceStats.currentMonthIndex + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const dateObj = new Date(attendanceStats.currentYear, attendanceStats.currentMonthIndex, day);

    setSelectedDayAction({
      date: dateStr,
      formattedDate: dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    });
  };

  const applyStatus = async (type: AttendanceOverrideType | null) => {
    if (!viewingAttendanceFor || !selectedDayAction) return;

    if (type === null) {
      if (currentUser?.role !== 'ADMIN') {
        alert("Only Admins can clear attendance records.");
        return;
      }
      if (!window.confirm("Are you sure you want to clear this status?\n\nWARNING: All attached images will be PERMANENTLY DELETED from BunnyCDN storage.")) {
        return;
      }
    }

    await setAttendanceStatus(viewingAttendanceFor.id, selectedDayAction.date, type);
    setSelectedDayAction(null);
  };

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
      const override = attendanceStats.monthlyOverrides.find(o => o.date === dateStr);

      const isToday = isCurrentMonth && i === today.getDate();
      const isFuture = isCurrentMonth && i > today.getDate() || (today < new Date(attendanceStats.currentYear, attendanceStats.currentMonthIndex, i));

      let bgClass = 'bg-slate-50 border-slate-100 text-slate-300'; // Default future
      let content = <span className="text-sm">{i}</span>;

      if (override) {
        // Admin Override Logic
        if (override.type === 'HOLIDAY') {
          bgClass = 'bg-amber-100 border-amber-200 text-amber-700 font-bold';
        } else if (override.type === 'ABSENT') {
          bgClass = 'bg-red-100 border-red-200 text-red-700 font-bold';
        } else if (override.type === 'PENALTY_2_DAYS') {
          bgClass = 'bg-purple-100 border-purple-200 text-purple-700 font-bold ring-1 ring-purple-300';
        } else if (override.type === 'PRESENT') {
          bgClass = 'bg-emerald-100 border-emerald-200 text-emerald-800 font-bold';
        }
      } else if (record) {
        // Present
        bgClass = 'bg-emerald-100 border-emerald-200 text-emerald-800 font-bold';
      } else {
        // Check for Partial / In Progress
        // Only if date matches the stored progress date
        const isPartial = viewingAttendanceFor.stagedAttendanceProgress &&
          viewingAttendanceFor.stagedAttendanceProgress.date === dateStr;

        if (isPartial) {
          bgClass = 'bg-amber-50 border-amber-200 text-amber-600 font-bold ring-1 ring-amber-200';
          content = (
            <div className="flex flex-col items-center">
              <span className="text-sm">{i}</span>
              <span className="text-[8px] leading-none mt-0.5">Part</span>
            </div>
          );
        } else if (!isFuture) {
          // Absent (Default)
          bgClass = 'bg-red-50 border-red-100 text-red-300';
        }
      }

      if (isToday && !record && !override) {
        bgClass = 'bg-blue-50 border-blue-200 text-blue-500 ring-1 ring-blue-300';
      }

      days.push(
        <button
          key={i}
          onClick={() => handleDayClick(i)}
          className={`aspect-square rounded-lg flex items-center justify-center border transition-all hover:brightness-95 active:scale-95 ${bgClass}`}
        >
          {content}
        </button>
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
                  onChange={e => setSelectedUser({ ...selectedUser, name: e.target.value })}
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
                    onChange={e => setSelectedUser({ ...selectedUser, code: e.target.value })}
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
                  onChange={e => setSelectedUser({ ...selectedUser, defaultBranchId: e.target.value })}
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
              {/* Default Page Selection */}
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <LayoutDashboard size={14} /> Default Landing Page
                </label>
                <select
                  value={selectedUser.defaultPage || '/dashboard'}
                  onChange={e => setSelectedUser({ ...selectedUser, defaultPage: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  {APP_PAGES.map(page => (
                    <option key={page.path} value={page.path}>{page.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Where to redirect this user after login.</p>
              </div>

              {/* Ledger Auditor Toggle */}
              <div className="md:col-span-2 bg-amber-50 rounded-lg p-3 border border-amber-200 flex items-center justify-between">
                <div>
                  <label className="text-sm font-bold text-amber-900 flex items-center gap-2">
                    <Shield size={16} /> Ledger Auditor
                  </label>
                  <p className="text-xs text-amber-700">Grant permission to approve/reject pending ledger transactions.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={selectedUser.isLedgerAuditor || false}
                    onChange={e => setSelectedUser({ ...selectedUser, isLedgerAuditor: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
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
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all border ${selectedUser.role === role
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

            {/* --- Staged Attendance Configuration --- */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                    <Camera size={16} /> Staged Attendance
                  </h4>
                  <p className="text-xs text-slate-500">Require multiple photos for check-in.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={selectedUser.isStagedAttendanceEnabled || false}
                    onChange={e => setSelectedUser({ ...selectedUser, isStagedAttendanceEnabled: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {selectedUser.isStagedAttendanceEnabled && (
                <div className="space-y-3 animate-fade-in">
                  {(selectedUser.stagedAttendanceConfig || []).map((stage, idx) => (
                    <div key={stage.id} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                      <div className="flex flex-col gap-1 text-slate-400">
                        <button type="button" onClick={() => moveStage(idx, 'up')} disabled={idx === 0} className="hover:text-indigo-600 disabled:opacity-30"><ArrowUp size={14} /></button>
                        <button type="button" onClick={() => moveStage(idx, 'down')} disabled={idx === (selectedUser.stagedAttendanceConfig?.length || 0) - 1} className="hover:text-indigo-600 disabled:opacity-30"><ArrowDown size={14} /></button>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={stage.title}
                          onChange={(e) => updateStage(idx, 'title', e.target.value)}
                          placeholder="Stage Title (e.g. Kitchen View)"
                          className="w-full text-sm font-medium border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none bg-transparent"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => updateStage(idx, 'cameraFacingMode', 'user')}
                          className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${stage.cameraFacingMode === 'user' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          Front
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStage(idx, 'cameraFacingMode', 'environment')}
                          className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${stage.cameraFacingMode === 'environment' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          Back
                        </button>
                      </div>

                      {/* Webhook Toggle */}
                      <label className="flex items-center gap-2 cursor-pointer relative group">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={stage.sendToWebhook || false}
                          onChange={(e) => updateStage(idx, 'sendToWebhook', e.target.checked)}
                        />
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${stage.sendToWebhook ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}>
                          <Globe size={14} />
                        </div>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {stage.sendToWebhook ? 'Send to Webhook' : 'No Webhook'}
                        </div>
                      </label>
                      <button type="button" onClick={() => removeStage(idx)} className="text-slate-400 hover:text-red-500 p-1">
                        <X size={16} />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addStage}
                    className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <Plus size={16} /> Add Stage
                  </button>
                </div>
              )}
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
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
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
      {
        viewingAttendanceFor && attendanceStats && (
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
                    <div className="text-lg font-bold text-red-700 leading-none">{attendanceStats.totalDeductibleDays}</div>
                    <div className="text-[10px] text-red-600 uppercase font-semibold mt-1">Deductible</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-center">
                    <div className="flex items-center justify-center text-blue-500 mb-1"><Clock size={16} /></div>
                    <div className="text-sm font-bold text-blue-700 leading-none mt-1">{attendanceStats.avgTimeStr}</div>
                    <div className="text-[10px] text-blue-600 uppercase font-semibold mt-1">Avg Check-in</div>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                    Calendar View
                    <span className="text-[10px] font-normal text-slate-400 normal-case">Tap date to edit</span>
                  </h4>
                  <div className="grid grid-cols-7 gap-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                      <div key={i} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>
                    ))}
                    {renderCalendar()}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-slate-500">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Present</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Holiday</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Absent (1)</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Penalty (2)</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"></div> In Progress</div>
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
                              {(record.imageUrl || (record.imageUrls && record.imageUrls.length > 0)) && (
                                <button
                                  onClick={() => setPreviewRecord(record)}
                                  className="text-[10px] flex items-center gap-1 text-blue-600 hover:text-blue-800 mt-1 font-medium transition-colors"
                                >
                                  <ImageIcon size={12} /> View {record.imageUrls && record.imageUrls.length > 1 ? 'Photos' : 'Photo'}
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
        )
      }

      {/* --- DAY ACTION MODAL --- */}
      {
        selectedDayAction && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800">Set Status</h3>
                  <p className="text-xs text-slate-500">{selectedDayAction.formattedDate}</p>
                </div>
                <button onClick={() => setSelectedDayAction(null)}><X size={20} className="text-slate-400" /></button>
              </div>
              <div className="p-4 space-y-2">
                <button
                  onClick={() => applyStatus('HOLIDAY')}
                  className="w-full p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 font-bold flex items-center gap-3 hover:bg-amber-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-700"><Palmtree size={16} /></div>
                  <div>
                    <div className="text-sm">Mark as Holiday/Leave</div>
                    <div className="text-[10px] opacity-70 font-normal">No salary deduction (0 Days)</div>
                  </div>
                </button>

                <button
                  onClick={() => applyStatus('ABSENT')}
                  className="w-full p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 font-bold flex items-center gap-3 hover:bg-red-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-red-700"><AlertCircle size={16} /></div>
                  <div>
                    <div className="text-sm">Mark Absent (Standard)</div>
                    <div className="text-[10px] opacity-70 font-normal">Salary deduction for 1 Day</div>
                  </div>
                </button>

                <button
                  onClick={() => applyStatus('PENALTY_2_DAYS')}
                  className="w-full p-3 rounded-lg border border-purple-200 bg-purple-50 text-purple-800 font-bold flex items-center gap-3 hover:bg-purple-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center text-purple-700"><AlertTriangle size={16} /></div>
                  <div>
                    <div className="text-sm">Mark Penalty</div>
                    <div className="text-[10px] opacity-70 font-normal">Salary deduction for 2 Days</div>
                  </div>
                </button>

                <div className="border-t border-slate-100 my-2"></div>

                <button
                  onClick={() => applyStatus('PRESENT')}
                  className="w-full p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold flex items-center gap-3 hover:bg-emerald-100 transition-colors mb-2"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700"><Check size={16} /></div>
                  <div>
                    <div className="text-sm">Mark Present (Manual)</div>
                    <div className="text-[10px] opacity-70 font-normal">Admin Override</div>
                  </div>
                </button>

                <button
                  onClick={() => applyStatus(null)}
                  className="w-full p-3 rounded-lg border border-slate-200 bg-white text-slate-600 font-medium flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                >
                  Clear Status / Reset
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* --- PHOTO PREVIEW OVERLAY --- */}
      {
        previewRecord && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in"
            onClick={() => setPreviewRecord(null)}
          >
            <div className="relative max-w-4xl w-full flex flex-col items-center max-h-[90vh]">
              <button
                onClick={() => setPreviewRecord(null)}
                className="absolute -top-12 right-0 text-white hover:text-red-400 transition-colors p-2"
              >
                <X size={32} />
              </button>

              <div className="w-full overflow-y-auto px-4 py-2" onClick={(e) => e.stopPropagation()}>
                {/* Header Information */}
                <div className="text-white mb-6 text-center">
                  <h3 className="text-xl font-bold">{previewRecord.userName}</h3>
                  <p className="text-slate-400 text-sm">
                    {new Date(previewRecord.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    <span className="mx-2">•</span>
                    {new Date(previewRecord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* Images Grid */}
                <div className="flex flex-wrap justify-center gap-6 pb-10">
                  {(previewRecord.imageUrls && previewRecord.imageUrls.length > 0) ? (
                    previewRecord.imageUrls.map((url, index) => {
                      // Attempt to find stage name from user config
                      // Note: This uses CURRENT config, so if stages changed, it might not match perfectly.
                      // Fallback to "Stage X"
                      const stageConfig = viewingAttendanceFor?.stagedAttendanceConfig?.[index];
                      const stageName = stageConfig?.title || `Stage ${index + 1}`;
                      const timestamp = previewRecord.imageTimestamps?.[index];

                      return (
                        <div key={index} className="flex flex-col items-center bg-white/5 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                          <div className="relative h-64 md:h-80 aspect-[3/4] bg-black rounded-lg overflow-hidden mb-3 border border-white/20">
                            <img
                              src={url}
                              alt={`${stageName} Proof`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="text-center">
                            <span className="block text-white font-bold text-sm bg-indigo-600/80 px-3 py-1 rounded-full backdrop-blur-md border border-indigo-400/30 mb-1">
                              {stageName}
                            </span>
                            {timestamp && (
                              <span className="block text-slate-300 text-xs font-mono bg-black/40 px-2 py-0.5 rounded">
                                {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : previewRecord.imageUrl ? (
                    <div className="flex flex-col items-center">
                      <img
                        src={previewRecord.imageUrl}
                        alt="Attendance Proof"
                        className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl border border-white/10"
                      />
                    </div>
                  ) : (
                    <div className="text-slate-400 italic">No images attached to this record.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default UserManagement;