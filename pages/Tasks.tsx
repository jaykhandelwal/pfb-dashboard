
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { CheckSquare, Plus, Trash2, Calendar, User as UserIcon, AlertTriangle, Check, Repeat, Clock, MoreVertical, X, Save, CalendarDays, Info, Loader2 } from 'lucide-react';
import { TaskTemplate, TaskFrequency } from '../types';
import { getLocalISOString } from '../constants';

const Tasks: React.FC = () => {
  const { todos, taskTemplates, addTodo, toggleTodo, addTaskTemplate, deleteTaskTemplate, updateTaskTemplate, deleteTodo, isLoading } = useStore();
  const { currentUser, users } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'MY_TASKS' | 'MANAGE_TEMPLATES'>('MY_TASKS');
  
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
    
    // Sort logic
    const allTasks = todos
      .filter(t => t.assignedTo === currentUser.id && !t.isCompleted)
      .sort((a,b) => (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99'));

    return {
       overdue: allTasks.filter(t => t.dueDate && t.dueDate < todayStr),
       today: allTasks.filter(t => !t.dueDate || t.dueDate === todayStr),
       upcoming: allTasks.filter(t => t.dueDate && t.dueDate > todayStr),
       completed: todos.filter(t => t.assignedTo === currentUser.id && t.isCompleted).slice(0, 10) // Last 10
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
    <div className="pb-16 max-w-5xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CheckSquare className="text-indigo-600" /> Tasks
          </h2>
          <p className="text-slate-500 text-sm">Manage daily duties and recurring schedules.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg">
           <button
             onClick={() => setActiveTab('MY_TASKS')}
             className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'MY_TASKS' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
           >
             My Tasks
           </button>
           {canManage && (
               <button
                 onClick={() => setActiveTab('MANAGE_TEMPLATES')}
                 className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'MANAGE_TEMPLATES' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}
               >
                 <Repeat size={16} /> Automation
               </button>
           )}
        </div>
      </div>

      {activeTab === 'MY_TASKS' && (
          <div className="space-y-6 animate-fade-in">
              {/* Actions */}
              <div className="flex justify-end">
                  <button 
                    onClick={() => {
                        setAssignedUserId(currentUser?.id || '');
                        setNewTaskText('');
                        setIsTaskModalOpen(true);
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                      <Plus size={16} /> Add Task
                  </button>
              </div>

              {/* Overdue Section */}
              {myTasks.overdue.length > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-xl overflow-hidden">
                      <div className="p-3 bg-red-100/50 border-b border-red-100 flex items-center gap-2 text-red-800 font-bold text-sm">
                          <AlertTriangle size={16} /> Overdue ({myTasks.overdue.length})
                      </div>
                      <div className="divide-y divide-red-100">
                          {myTasks.overdue.map(task => (
                              <div key={task.id} className="p-3 flex items-center gap-3 hover:bg-white transition-colors">
                                  <button onClick={() => toggleTodo(task.id, true)} className="w-5 h-5 rounded border border-red-300 flex items-center justify-center hover:bg-red-200">
                                      <Check size={14} className="opacity-0" />
                                  </button>
                                  <div className="flex-1">
                                      <p className="text-slate-800 font-medium text-sm">{task.text}</p>
                                      <p className="text-xs text-red-600">Due: {task.dueDate}</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* Today Section */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2 text-slate-700 font-bold text-sm">
                      <Calendar size={16} /> Today
                  </div>
                  <div className="divide-y divide-slate-100">
                      {myTasks.today.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-sm italic">No tasks due today.</div>
                      ) : (
                          myTasks.today.map(task => (
                              <div key={task.id} className="p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors group">
                                  <button onClick={() => toggleTodo(task.id, true)} className="w-5 h-5 rounded border border-slate-300 flex items-center justify-center hover:border-emerald-500 transition-colors">
                                      <Check size={14} className="text-emerald-600 opacity-0 group-hover:opacity-100" />
                                  </button>
                                  <div className="flex-1">
                                      <p className="text-slate-800 font-medium text-sm">{task.text}</p>
                                      {task.templateId && <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-500">Auto</span>}
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>

              {/* Upcoming Section */}
              {myTasks.upcoming.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm opacity-80">
                      <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2 text-slate-500 font-bold text-sm">
                          <Clock size={16} /> Upcoming
                      </div>
                      <div className="divide-y divide-slate-100">
                          {myTasks.upcoming.map(task => (
                              <div key={task.id} className="p-3 flex items-center gap-3">
                                  <div className="w-5 h-5 rounded border border-slate-200 bg-slate-50"></div>
                                  <div className="flex-1">
                                      <p className="text-slate-600 text-sm">{task.text}</p>
                                      <p className="text-xs text-slate-400">Due: {task.dueDate}</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      )}

      {activeTab === 'MANAGE_TEMPLATES' && (
          <div className="animate-fade-in">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="font-bold text-slate-800">Recurring Task Templates</h3>
                          <p className="text-xs text-slate-500">Automatically generate tasks for staff.</p>
                      </div>
                      <button 
                        onClick={openNewTemplate}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                          <Plus size={16} /> Create Template
                      </button>
                  </div>
                  
                  {sortedTemplates.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 italic">No templates configured.</div>
                  ) : (
                      <div className="divide-y divide-slate-100">
                          {sortedTemplates.map(tmpl => (
                              <div key={tmpl.id} className={`p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50 transition-colors ${!tmpl.isActive ? 'opacity-60 bg-slate-50' : ''}`}>
                                  <div className="mb-3 md:mb-0">
                                      <div className="flex items-center gap-2">
                                          <h4 className="font-bold text-slate-800">{tmpl.title}</h4>
                                          {!tmpl.isActive && <span className="text-[10px] bg-slate-200 text-slate-600 px-2 rounded-full font-bold">Inactive</span>}
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                          <span className="flex items-center gap-1"><UserIcon size={12}/> {getUserName(tmpl.assignedTo)}</span>
                                          <span>•</span>
                                          <span className="flex items-center gap-1">
                                              <Repeat size={12}/> 
                                              {getFrequencyLabel(tmpl)}
                                          </span>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <button 
                                        onClick={() => openEditTemplate(tmpl)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                      >
                                          <MoreVertical size={18} />
                                      </button>
                                      <button 
                                        onClick={() => { if(confirm('Delete template?')) deleteTaskTemplate(tmpl.id) }}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      >
                                          <Trash2 size={18} />
                                      </button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* --- MODALS --- */}

      {/* 1. New Task Modal (One-off) */}
      {isTaskModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
               <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-700">Add New Task</h3>
                  <button onClick={() => setIsTaskModalOpen(false)}><X size={20} className="text-slate-400" /></button>
               </div>
               <form onSubmit={handleCreateTask} className="p-4 space-y-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                     <input 
                        type="text"
                        required
                        autoFocus
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                     <input 
                        type="date"
                        required
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                     />
                  </div>
                  {canManage && (
                      <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign To</label>
                         <select 
                            required
                            value={assignedUserId}
                            onChange={(e) => setAssignedUserId(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                         >
                            {users.map(u => (
                               <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                         </select>
                      </div>
                  )}
                  <button 
                     type="submit"
                     className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                     Create Task
                  </button>
               </form>
            </div>
         </div>
      )}

      {/* 2. Template Modal (Recurring) */}
      {isTemplateModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
               <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-700">{editingTemplate.id ? 'Edit Template' : 'New Automation'}</h3>
                  <button onClick={() => setIsTemplateModalOpen(false)}><X size={20} className="text-slate-400" /></button>
               </div>
               <form onSubmit={handleSaveTemplate} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Title</label>
                     <input 
                        type="text"
                        required
                        value={editingTemplate.title || ''}
                        onChange={(e) => setEditingTemplate({...editingTemplate, title: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="e.g. Daily Temperature Check"
                     />
                  </div>
                  
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign To</label>
                     <select 
                        required
                        value={editingTemplate.assignedTo || ''}
                        onChange={(e) => setEditingTemplate({...editingTemplate, assignedTo: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                     >
                        <option value="">Select Staff</option>
                        {users.map(u => (
                           <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                     </select>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Frequency</label>
                     <select 
                        required
                        value={editingTemplate.frequency || 'DAILY'}
                        onChange={(e) => setEditingTemplate({...editingTemplate, frequency: e.target.value as TaskFrequency})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                     >
                        <option value="DAILY">Every Day</option>
                        <option value="WEEKLY">Weekly (Specific Days)</option>
                        <option value="BI_WEEKLY">Every 2 Weeks (Fortnightly)</option>
                        <option value="MONTHLY">Monthly / Bi-Monthly (Specific Dates)</option>
                     </select>
                  </div>

                  {editingTemplate.frequency === 'WEEKLY' && (
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Repeats On</label>
                          <div className="flex justify-between">
                              {['S','M','T','W','T','F','S'].map((day, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => toggleWeekDay(idx)}
                                    className={`w-9 h-9 rounded-full text-xs font-bold transition-all ${
                                        (editingTemplate.weekDays || []).includes(idx)
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                    }`}
                                  >
                                      {day}
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}

                  {editingTemplate.frequency === 'MONTHLY' && (
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select Days of Month</label>
                          <div className="grid grid-cols-7 gap-1">
                              {Array.from({length: 31}, (_, i) => i + 1).map(day => (
                                  <button
                                    key={day}
                                    type="button"
                                    onClick={() => toggleMonthDay(day)}
                                    className={`aspect-square rounded border text-xs font-bold transition-all ${
                                        (editingTemplate.monthDays || []).includes(day)
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                      {day}
                                  </button>
                              ))}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2">
                             Select "1" and "15" for Bi-Monthly tasks.
                          </p>
                      </div>
                  )}

                  {editingTemplate.frequency === 'BI_WEEKLY' && (
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Starts From</label>
                          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                             <input 
                                type="date"
                                required
                                value={editingTemplate.startDate || getLocalISOString()}
                                onChange={(e) => setEditingTemplate({...editingTemplate, startDate: e.target.value})}
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-sm"
                             />
                             <div className="flex items-start gap-2 mt-2">
                                <Info size={14} className="text-blue-500 mt-0.5" />
                                <p className="text-xs text-blue-700">
                                   Task will generate every 14 days starting from this date.
                                </p>
                             </div>
                          </div>
                      </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                      <input 
                        type="checkbox"
                        id="isActive"
                        checked={editingTemplate.isActive ?? true}
                        onChange={(e) => setEditingTemplate({...editingTemplate, isActive: e.target.checked})}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <label htmlFor="isActive" className="text-sm text-slate-700 font-medium">Active (Generating Tasks)</label>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                      <button 
                        type="button"
                        onClick={() => setIsTemplateModalOpen(false)}
                        className="text-slate-500 text-sm font-medium hover:text-slate-700"
                      >
                          Cancel
                      </button>
                      <button 
                        type="submit"
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-2"
                      >
                          <Save size={16} /> Save Template
                      </button>
                  </div>
               </form>
            </div>
         </div>
      )}

    </div>
  );
};

export default Tasks;
