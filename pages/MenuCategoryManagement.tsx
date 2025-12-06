
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { MenuCategory } from '../types';
import { Plus, Edit2, Trash2, X, Save, Tag, ArrowUp, ArrowDown } from 'lucide-react';

const MenuCategoryManagement: React.FC = () => {
  const { menuCategories, addMenuCategory, updateMenuCategory, deleteMenuCategory, reorderMenuCategory } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Partial<MenuCategory>>({});
  
  // Track old name to update menu items
  const [originalName, setOriginalName] = useState<string>('');

  const handleAddNew = () => {
    setCurrentCategory({ name: '', order: menuCategories.length });
    setIsEditing(true);
  };

  const handleEdit = (category: MenuCategory) => {
    setCurrentCategory({ ...category });
    setOriginalName(category.name);
    setIsEditing(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure? This will remove the category "${name}" and set all associated menu items to "Uncategorized".`)) {
      deleteMenuCategory(id, name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCategory.name) return;

    if (currentCategory.id) {
      updateMenuCategory(currentCategory as MenuCategory, originalName);
    } else {
      addMenuCategory(currentCategory as Omit<MenuCategory, 'id'>);
    }
    setIsEditing(false);
    setCurrentCategory({});
    setOriginalName('');
  };

  return (
    <div className="pb-16 max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Tag className="text-pink-500" /> Menu Categories
           </h2>
           <p className="text-slate-500 text-sm md:text-base">Organize your menu structure.</p>
        </div>
        {!isEditing && (
          <button 
            onClick={handleAddNew}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-medium"
          >
            <Plus size={18} />
            <span className="hidden md:inline">Add Category</span>
            <span className="md:hidden">Add</span>
          </button>
        )}
      </div>

      {isEditing && (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 mb-8 animate-fade-in">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <h3 className="text-lg font-bold text-slate-800">
              {currentCategory.id ? 'Edit Category' : 'New Category'}
            </h3>
            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category Name</label>
              <input 
                type="text" 
                required
                value={currentCategory.name || ''}
                onChange={e => setCurrentCategory({...currentCategory, name: e.target.value})}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="e.g. Steamed Momos"
              />
              <p className="text-xs text-slate-400 mt-1">
                 {currentCategory.id 
                    ? "Renaming will automatically update all menu items in this category." 
                    : "Create a new section for your menu."}
              </p>
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
                Save Category
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
                <th className="p-4 w-16 text-center">Order</th>
                <th className="p-4">Category Name</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {menuCategories.sort((a,b) => a.order - b.order).map((cat, index) => (
                <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      <button 
                        onClick={() => reorderMenuCategory(cat.id, 'up')}
                        disabled={index === 0}
                        className="text-slate-300 hover:text-emerald-600 disabled:opacity-20 disabled:hover:text-slate-300"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button 
                        onClick={() => reorderMenuCategory(cat.id, 'down')}
                        disabled={index === menuCategories.length - 1}
                        className="text-slate-300 hover:text-emerald-600 disabled:opacity-20 disabled:hover:text-slate-300"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  </td>
                  <td className="p-4 font-medium text-slate-700 text-base">
                     {cat.name}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(cat)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(cat.id, cat.name)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {menuCategories.length === 0 && (
                 <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-400 italic">No categories found.</td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MenuCategoryManagement;
