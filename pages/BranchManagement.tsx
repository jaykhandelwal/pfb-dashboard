import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Branch } from '../types';
import { Plus, Edit2, Trash2, X, Save, Store } from 'lucide-react';

const BranchManagement: React.FC = () => {
  const { branches, addBranch, updateBranch, deleteBranch } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<Partial<Branch>>({});

  const handleAddNew = () => {
    setCurrentBranch({ name: '' });
    setIsEditing(true);
  };

  const handleEdit = (branch: Branch) => {
    setCurrentBranch({ ...branch });
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this branch?')) {
      deleteBranch(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBranch.name) return;

    if (currentBranch.id) {
      updateBranch(currentBranch as Branch);
    } else {
      addBranch(currentBranch as Omit<Branch, 'id'>);
    }
    setIsEditing(false);
    setCurrentBranch({});
  };

  return (
    <div className="pb-16">
      <div className="mb-6 flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Branch Management</h2>
           <p className="text-slate-500 text-sm md:text-base">Configure your store locations.</p>
        </div>
        {!isEditing && (
          <button 
            onClick={handleAddNew}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-medium"
          >
            <Plus size={18} />
            <span className="hidden md:inline">Add New Branch</span>
            <span className="md:hidden">Add</span>
          </button>
        )}
      </div>

      {isEditing && (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 mb-8 animate-fade-in">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <h3 className="text-lg font-bold text-slate-800">
              {currentBranch.id ? 'Edit Branch' : 'New Branch'}
            </h3>
            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Branch Name</label>
              <input 
                type="text" 
                required
                value={currentBranch.name || ''}
                onChange={e => setCurrentBranch({...currentBranch, name: e.target.value})}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="e.g. Momo Mafia 03"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
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
                Save Branch
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
                <th className="p-4">Branch Name</th>
                <th className="hidden md:table-cell p-4 text-slate-400">ID</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branches.map((branch, index) => (
                <tr key={branch.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-center text-slate-400 text-sm">
                    {index + 1}
                  </td>
                  <td className="p-4 font-medium text-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                            <Store size={18} />
                        </div>
                        {branch.name}
                    </div>
                  </td>
                  <td className="hidden md:table-cell p-4 text-xs font-mono text-slate-400">
                    {branch.id}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(branch)}
                        className="p-2 md:p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} className="md:w-4 md:h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(branch.id)}
                        className="p-2 md:p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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

export default BranchManagement;