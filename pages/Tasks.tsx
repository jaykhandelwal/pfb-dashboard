
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { CheckSquare, Plus, Trash2, Calendar, User as UserIcon, AlertTriangle, Check, Repeat, Clock, MoreVertical, X, Save, Info, Loader2, CheckCircle2, History, ChevronDown, ChevronUp, List, CheckCircle } from 'lucide-react';
import { TaskTemplate, TaskFrequency } from '../types';
import { getLocalISOString } from '../constants';

const Tasks: React.FC = () => {
  const { todos, taskTemplates, addTodo, toggleTodo, addTaskTemplate, deleteTaskTemplate, updateTaskTemplate, isLoading } = useStore();
  const { currentUser, users } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'MY_TASKS' | 'MANAGE_TEMPLATES'>('MY_TASKS');
  const [showHistory, setShowHistory] = useState(false);
  
  // Template Form State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<TaskTemplate>>({});
  
  // Task Creation State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [assignedUserId, setAssignedUserId] = useState(currentUser?.id || '');
  const [dueDate, setDueDate] = useState(getLocalISOString());

  // --- Derived Data ---
  const myTasks = useMemo(() => {
    if (!currentUser) return { overdue: [], today: [], upcoming: [], completed: [] };
    
    const todayStr = getLocalISOString();
    
    // 1. Active Tasks (Personal Only)
    // We strictly filter active tasks to the current user so "My Tasks" view remains personal.
    const myActiveTasks = todos.filter(t => t.assignedTo === currentUser.id && !t.isCompleted);
    
    // Sort Active: Overdue first, then by date
    myActiveTasks.sort((a,b) => (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99'));

    const overdue = myActiveTasks.filter(t => t.dueDate && t.dueDate < todayStr);
    const today = myActiveTasks.filter(t => !t.dueDate || t.dueDate === todayStr);
    const upcoming = myActiveTasks.filter(t => t.dueDate && t.dueDate > todayStr);

    // 2. History (Completed Tasks)
    // Admin sees ALL completed tasks. Others see only THEIR completed tasks.
    let completedSource = todos.filter(t => t.isCompleted);
    
    if (currentUser.role !== 'ADMIN') {
        completedSource = completedSource.filter(t => t.assignedTo === currentUser.id);
    }

    const completed = completedSource
        .sort((a,b) => (b.completedAt || 0) - (a.completedAt || 0))
        .slice(0, 50); // Show last 50 for context

    return {
       overdue,
       today,
       upcoming,
       completed
    };
  }, [todos, currentUser]);

  const sortedTemplates = useMemo(() => {
      return [...taskTemplates].sort((a,b) => b.isActive === a.isActive ? 0 : a.isActive ? -1 : 1);
  }, [taskTemplates]);

  // --- Handlers ---

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText || !assignedUserId) return;

    await addTodo({
      text: newTaskText,
      assignedTo: assignedUserId,
      assignedBy: currentUser?.name || 'Admin',
      isCompleted: false,
      createdAt: Date.now(),
      dueDate: dueDate
    });

    setNewTaskText('');
    setIsTaskModalOpen(false);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingTemplate.title || !editingTemplate.assignedTo || !editingTemplate.frequency) return;

      const payload: Partial<TaskTemplate> = {
          title: editingTemplate.title,
          assignedTo: editingTemplate.assignedTo,
          assignedBy: currentUser?.name || 'Admin',
          frequency: editingTemplate.frequency,
          weekDays: editingTemplate.weekDays || [],
          monthDays: editingTemplate.monthDays || [],
          startDate: editingTemplate.startDate || getLocalISOString(),
          isActive: editingTemplate.isActive ?? true,
          lastGeneratedDate: '' // Reset generation
      };

      if (editingTemplate.id) {
          await updateTaskTemplate({ ...payload, id: editingTemplate.id } as TaskTemplate);
      } else {
          await addTaskTemplate(payload as TaskTemplate);
      }
      setIsTemplateModalOpen(false);
      setEditingTemplate({});
  };

  const openEditTemplate = (tmpl: TaskTemplate) => {
      setEditingTemplate({ ...tmpl });
      setIsTemplateModalOpen(true);
  };

  const openNewTemplate = () => {
      setEditingTemplate({
          title: '',
          assignedTo: '',
          frequency: 'DAILY',
          weekDays: [],
          monthDays: [],
          startDate: getLocalISOString(),
          isActive: true
      });
      setIsTemplateModalOpen(true);
  };

  const toggleWeekDay = (day: number) => {
      setEditingTemplate(prev => {
          const current = prev.weekDays || [];
          if (current.includes(day)) {
              return { ...prev, weekDays: current.filter(d => d !== day) };
          } else {
              return { ...prev, weekDays: [...current, day].sort() };
          }
      });
  };

  const toggleMonthDay = (day: number) => {
      setEditingTemplate(prev => {
          const current = prev.monthDays || [];
          if (current.includes(day)) {
              return { ...prev, monthDays: current.filter(d => d !== day) };
          } else {
              return { ...prev, monthDays: [...current, day].sort((a,b) => a - b) };
          }
      });
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown';

  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';

  const getFrequencyLabel = (tmpl: TaskTemplate) => {
      if (tmpl.frequency === 'DAILY') return 'Every Day';
      if (tmpl.frequency === 'WEEKLY') return `Weekly (${tmpl.weekDays?.length || 0} days)`;
      if (tmpl.frequency === 'BI_WEEKLY') return `Every 2 Weeks`;
      if (tmpl.frequency === 'MONTHLY') return `Monthly (${tmpl.monthDays?.length || 0} days)`;
      return tmpl.frequency;
  };

  if (isLoading) {
      return (
          <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
              <p className="text-slate-500 font-medium">Loading Tasks...</p>
          </div>
      );
  }

  return (
    <div className="pb-24 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <CheckSquare className="text-indigo-600" size={28} /> Task Center
          </h2>
          <p className="text-slate-500 mt-1">Stay organized and track daily operations.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
           <button
             onClick={() => setActiveTab('MY_TASKS')}
             className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'MY_TASKS' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             <List size={16} /> My Tasks
           </button>
           {canManage && (
               <button
                 onClick={() => setActiveTab('MANAGE_TEMPLATES')}
                 className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'MANAGE_TEMPLATES' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-600'}`}
               >
                 <Repeat size={16} /> Automation
               </button>
           )}
        </div>
      </div>

      {activeTab === 'MY_TASKS' && (
          <div className="space-y-6 animate-fade-in">
              
              {/* Professional Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 relative overflow-hidden">
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg relative z-10">
                          <Calendar size={20} />
                      </div>
                      <div className="relative z-10">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Due Today</p>
                          <p className="text-2xl font-bold text-slate-800">{myTasks.today.length}</p>
                      </div>
                  </div>

                  <div className={`bg-white p-4 rounded-xl border shadow-sm flex items-center gap-3 ${myTasks.overdue.length > 0 ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
                      <div className={`p-2.5 rounded-lg ${myTasks.overdue.length > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                          <AlertTriangle size={20} />
                      </div>
                      <div>
                          <p className={`text-[10px] font-bold uppercase tracking-wide ${myTasks.overdue.length > 0 ? 'text-red-600' : 'text-slate-500'}`}>Overdue</p>
                          <p className={`text-2xl font-bold ${myTasks.overdue.length > 0 ? 'text-red-700' : 'text-slate-800'}`}>{myTasks.overdue.length}</p>
                      </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                          <CheckCircle2 size={20} />
                      </div>
                      <div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">{currentUser?.role === 'ADMIN' ? 'Total Completed' : 'My Completed'}</p>
                          <p className="text-2xl font-bold text-slate-800">{myTasks.completed.length}</p>
                      </div>
                  </div>

                  {/* Quick Add Action (Desktop) */}
                  <button 
                    onClick={() => {
                        setAssignedUserId(currentUser?.id || '');
                        setNewTaskText('');
                        setIsTaskModalOpen(true);
                    }}
                    className="bg-indigo-600 text-white p-4 rounded-xl shadow-sm hover:bg-indigo-700 transition-all flex flex-col items-center justify-center gap-1 active:scale-95"
                  >
                      <Plus size={24} />
                      <span className="text-xs font-bold uppercase tracking-wide">New Task</span>
                  </button>
              </div>

              {/* Overdue Section */}
              {myTasks.overdue.length > 0 && (
                  <div className="space-y-3">
                      <div className="flex items-center gap-2 text-red-700 font-bold text-sm uppercase tracking-wide px-1">
                          <AlertTriangle size={16} /> Attention Required
                      </div>
                      <div className="grid gap-3">
                          {myTasks.overdue.map(task => (
                              <div key={task.id} className="bg-white p-4 rounded-xl border-l-4 border-red-500 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                                  <div>
                                      <p className="font-bold text-slate-800">{task.text}</p>
                                      <p className="text-xs text-red-500 font-medium mt-1">Due: {task.dueDate}</p>
                                  </div>
                                  <button 
                                    onClick={() => toggleTodo(task.id, true)}
                                    className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                    title="Mark as Done"
                                  >
                                      <Check size={20} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* Today Section */}
              <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-500 font-bold text-sm uppercase tracking-wide px-1">
                      <Calendar size={16} /> Today's Agenda
                  </div>
                  
                  {myTasks.today.length === 0 ? (
                      <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-8 text-center">
                          <CheckCircle size={48} className="mx-auto text-slate-300 mb-3" />
                          <p className="text-slate-500 font-medium">No pending tasks for today.</p>
                          <p className="text-xs text-slate-400 mt-1">Check "Upcoming" or add a new task if needed.</p>
                      </div>
                  ) : (
                      <div className="grid gap-3">
                          {myTasks.today.map(task => (
                              <div key={task.id} className="bg-white p-4 rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                                  <div>
                                      <p className="font-bold text-slate-800 text-lg">{task.text}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                          {task.templateId && <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 font-medium">Recurring</span>}
                                          <span className="text-xs text-slate-400">Assigned by: {task.assignedBy}</span>
                                      </div>
                                  </div>
                                  <button 
                                    onClick={() => toggleTodo(task.id, true)}
                                    className="w-12 h-12 rounded-xl bg-slate-50 text-emerald-600 border border-slate-200 flex items-center justify-center hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all shadow-sm group-hover:scale-105"
                                    title="Mark as Done"
                                  >
                                      <Check size={24} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}
              </div>

              {/* Upcoming Section */}
              {myTasks.upcoming.length > 0 && (
                  <div className="space-y-3 opacity-80">
                      <div className="flex items-center gap-2 text-slate-400 font-bold text-sm uppercase tracking-wide px-1">
                          <Clock size={16} /> Upcoming
                      </div>
                      <div className="grid gap-2">
                          {myTasks.upcoming.map(task => (
                              <div key={task.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                  <div className="flex-1">
                                      <p className="text-slate-600 font-medium">{task.text}</p>
                                      <p className="text-xs text-slate-400">Due: {task.dueDate}</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* Completed History Section */}
              <div className="pt-6 border-t border-slate-200">
                  <button 
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm transition-colors w-full bg-slate-50 hover:bg-slate-100 p-3 rounded-xl border border-slate-200"
                  >
                      <History size={16} /> Recent History
                      {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      <span className="ml-auto text-xs font-normal text-slate-400">
                          {showHistory ? 'Hide' : (currentUser?.role === 'ADMIN' ? 'View Team History' : `${myTasks.completed.length} completed items`)}
                      </span>
                  </button>

                  {showHistory && (
                      <div className="mt-4 space-y-2 animate-fade-in-down pl-2 border-l-2 border-slate-200 ml-4">
                          {myTasks.completed.length === 0 ? (
                              <div className="text-center py-4 text-slate-400 text-sm italic">No completed tasks history available.</div>
                          ) : (
                              myTasks.completed.map(task => (
                                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-100 group hover:border-slate-300 transition-colors">
                                      <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                              <Check size={12} />
                                          </div>
                                          <div>
                                              <div className="flex items-center gap-2">
                                                  {currentUser?.role === 'ADMIN' && (
                                                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 font-bold">
                                                          {getUserName(task.assignedTo)}
                                                      </span>
                                                  )}
                                                  <p className="text-sm font-medium text-slate-700 line-through decoration-slate-400">{task.text}</p>
                                              </div>
                                              <p className="text-[10px] text-slate-400">
                                                  Done: {task.completedAt ? new Date(task.completedAt).toLocaleString() : 'Unknown'}
                                              </p>
                                          </div>
                                      </div>
                                      <button 
                                        onClick={() => toggleTodo(task.id, false)}
                                        className="text-xs text-slate-400 hover:text-indigo-600 hover:underline opacity-0 group-hover:opacity-100 transition-opacity px-2"
                                      >
                                          Undo
                                      </button>
                                  </div>
                              ))
                          )}
                      </div>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'MANAGE_TEMPLATES' && (
          <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                  <div>
                      <h3 className="text-xl font-bold text-slate-800">Recurring Automations</h3>
                      <p className="text-sm text-slate-500">Tasks automatically created for staff based on schedule.</p>
                  </div>
                  <button 
                    onClick={openNewTemplate}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-md"
                  >
                      <Plus size={18} /> New Template
                  </button>
              </div>
              
              {sortedTemplates.length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                          <Repeat size={32} />
                      </div>
                      <h4 className="text-lg font-bold text-slate-600">No Templates Yet</h4>
                      <p className="text-slate-400 max-w-xs mx-auto mb-6">Create templates to automatically assign tasks like "Opening Checklist" or "Cleaning" every day.</p>
                      <button onClick={openNewTemplate} className="text-indigo-600 font-bold hover:underline">Create your first template</button>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sortedTemplates.map(tmpl => (
                          <div key={tmpl.id} className={`bg-white p-5 rounded-xl border shadow-sm transition-all hover:shadow-md relative group ${!tmpl.isActive ? 'border-slate-200 opacity-70 bg-slate-50' : 'border-slate-200'}`}>
                              <div className="flex justify-between items-start mb-3">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${!tmpl.isActive ? 'bg-slate-200 text-slate-500' : 'bg-indigo-50 text-indigo-600'}`}>
                                      <Repeat size={20} />
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => openEditTemplate(tmpl)} className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg"><MoreVertical size={16}/></button>
                                      <button onClick={() => { if(confirm('Delete template?')) deleteTaskTemplate(tmpl.id) }} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={16}/></button>
                                  </div>
                              </div>
                              
                              <h4 className="font-bold text-slate-800 text-lg mb-1">{tmpl.title}</h4>
                              <div className="flex flex-wrap gap-2 mb-3">
                                  <span className="text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                      {getFrequencyLabel(tmpl)}
                                  </span>
                                  {!tmpl.isActive && <span className="text-xs font-bold px-2 py-1 rounded bg-slate-200 text-slate-500">Paused</span>}
                              </div>

                              <div className="flex items-center gap-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                                  <UserIcon size={12} /> Assigned to: <span className="font-medium text-slate-700">{getUserName(tmpl.assignedTo)}</span>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {/* --- MODALS --- */}

      {/* 1. New Task Modal (One-off) */}
      {isTaskModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
               <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-800">Add New Task</h3>
                  <button onClick={() => setIsTaskModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
               </div>
               <form onSubmit={handleCreateTask} className="p-5 space-y-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Description</label>
                     <input 
                        type="text"
                        required
                        autoFocus
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                        placeholder="e.g. Check fridge temperature"
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Due Date</label>
                     <input 
                        type="date"
                        required
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                     />
                  </div>
                  {canManage && (
                      <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Assign To</label>
                         <select 
                            required
                            value={assignedUserId}
                            onChange={(e) => setAssignedUserId(e.target.value)}
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                         >
                            {users.map(u => (
                               <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                         </select>
                      </div>
                  )}
                  <button 
                     type="submit"
                     className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 mt-2"
                  >
                     Create Task
                  </button>
               </form>
            </div>
         </div>
      )}

      {/* 2. Template Modal (Recurring) */}
      {isTemplateModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
               <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-800">{editingTemplate.id ? 'Edit Template' : 'New Automation'}</h3>
                  <button onClick={() => setIsTemplateModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
               </div>
               
               <div className="overflow-y-auto p-6 space-y-5">
                  <form id="templateForm" onSubmit={handleSaveTemplate} className="space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Task Title</label>
                        <input 
                            type="text"
                            required
                            value={editingTemplate.title || ''}
                            onChange={(e) => setEditingTemplate({...editingTemplate, title: e.target.value})}
                            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                            placeholder="e.g. Daily Temperature Check"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Assign To</label>
                        <select 
                            required
                            value={editingTemplate.assignedTo || ''}
                            onChange={(e) => setEditingTemplate({...editingTemplate, assignedTo: e.target.value})}
                            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="">Select Staff</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Frequency Rule</label>
                          <select 
                              required
                              value={editingTemplate.frequency || 'DAILY'}
                              onChange={(e) => setEditingTemplate({...editingTemplate, frequency: e.target.value as TaskFrequency})}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white mb-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                              <option value="DAILY">Every Day</option>
                              <option value="WEEKLY">Weekly (Specific Days)</option>
                              <option value="BI_WEEKLY">Every 2 Weeks (Fortnightly)</option>
                              <option value="MONTHLY">Monthly / Bi-Monthly (Specific Dates)</option>
                          </select>

                          {editingTemplate.frequency === 'WEEKLY' && (
                              <div className="animate-fade-in">
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Repeats On</label>
                                  <div className="flex justify-between">
                                      {['S','M','T','W','T','F','S'].map((day, idx) => (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={() => toggleWeekDay(idx)}
                                            className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                                                (editingTemplate.weekDays || []).includes(idx)
                                                ? 'bg-indigo-600 text-white shadow-md transform scale-110'
                                                : 'bg-white text-slate-400 border border-slate-200 hover:border-indigo-300'
                                            }`}
                                          >
                                              {day}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          )}

                          {editingTemplate.frequency === 'MONTHLY' && (
                              <div className="animate-fade-in">
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Select Days</label>
                                  <div className="grid grid-cols-7 gap-1.5">
                                      {Array.from({length: 31}, (_, i) => i + 1).map(day => (
                                          <button
                                            key={day}
                                            type="button"
                                            onClick={() => toggleMonthDay(day)}
                                            className={`aspect-square rounded text-[10px] font-bold transition-all ${
                                                (editingTemplate.monthDays || []).includes(day)
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                                            }`}
                                          >
                                              {day}
                                          </button>
                                      ))}
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-2 italic">
                                    Tip: Select "1" and "15" for standard Bi-Monthly.
                                  </p>
                              </div>
                          )}

                          {editingTemplate.frequency === 'BI_WEEKLY' && (
                              <div className="animate-fade-in">
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Starts From</label>
                                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                                    <input 
                                        type="date"
                                        required
                                        value={editingTemplate.startDate || getLocalISOString()}
                                        onChange={(e) => setEditingTemplate({...editingTemplate, startDate: e.target.value})}
                                        className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-sm outline-none"
                                    />
                                    <div className="flex items-start gap-2 mt-2">
                                        <Info size={14} className="text-blue-500 mt-0.5" />
                                        <p className="text-xs text-blue-700">
                                          Tasks generate every 14 days starting from this date.
                                        </p>
                                    </div>
                                  </div>
                              </div>
                          )}
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                          <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                              <input 
                                type="checkbox" 
                                name="toggle" 
                                id="isActive" 
                                className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer top-1 left-1 checked:right-1 checked:left-auto"
                                checked={editingTemplate.isActive ?? true}
                                onChange={(e) => setEditingTemplate({...editingTemplate, isActive: e.target.checked})}
                              />
                              <label htmlFor="isActive" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${editingTemplate.isActive !== false ? 'bg-indigo-600' : 'bg-slate-300'}`}></label>
                          </div>
                          <label htmlFor="isActive" className="text-sm text-slate-700 font-bold cursor-pointer">Active</label>
                      </div>
                  </form>
               </div>

               <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsTemplateModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-white transition-colors"
                  >
                      Cancel
                  </button>
                  <button 
                    type="submit"
                    form="templateForm"
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                      <Save size={18} /> Save Template
                  </button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default Tasks;
