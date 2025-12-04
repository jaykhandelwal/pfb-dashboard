
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { MenuItem, MenuIngredient } from '../types';
import { Plus, Edit2, Trash2, X, Save, Utensils, IndianRupee, Info, ChefHat, Copy, Check, KeyRound } from 'lucide-react';

const MenuManagement: React.FC = () => {
  const { menuItems, skus, addMenuItem, updateMenuItem, deleteMenuItem } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<MenuItem>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Local state for ingredients editing
  const [ingredients, setIngredients] = useState<MenuIngredient[]>([]);

  const handleAddNew = () => {
    setCurrentItem({ name: '', price: 0 });
    setIngredients([]);
    setIsEditing(true);
  };

  const handleEdit = (item: MenuItem) => {
    setCurrentItem({ ...item });
    setIngredients(item.ingredients ? [...item.ingredients] : []);
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this menu item?')) {
      deleteMenuItem(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem.name) return;

    const payload = {
       ...currentItem,
       ingredients
    };

    if (currentItem.id && menuItems.some(i => i.id === currentItem.id)) {
      // Logic: Update if ID exists in list (Edit Mode)
      updateMenuItem(payload as MenuItem);
    } else {
      // Logic: Add new (Create Mode). ID might be passed in payload if user entered one.
      addMenuItem(payload as Omit<MenuItem, 'id'>);
    }
    setIsEditing(false);
    setCurrentItem({});
    setIngredients([]);
  };

  const getSkuName = (skuId?: string) => {
     if(!skuId) return 'Unknown';
     const sku = skus.find(s => s.id === skuId);
     return sku ? sku.name : 'Unknown SKU';
  };

  const addIngredient = () => {
     if(skus.length === 0) return;
     // Add first available SKU as default
     setIngredients([...ingredients, { skuId: skus[0].id, quantity: 1 }]);
  };

  const updateIngredient = (index: number, field: keyof MenuIngredient, value: string | number) => {
     const newIngredients = [...ingredients];
     newIngredients[index] = { ...newIngredients[index], [field]: value };
     setIngredients(newIngredients);
  };

  const removeIngredient = (index: number) => {
     setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="pb-16">
      <div className="mb-6 flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Utensils className="text-orange-500" /> Menu & Pricing
           </h2>
           <p className="text-slate-500 text-sm md:text-base">Manage sellable items, recipes, and prices.</p>
        </div>
        {!isEditing && (
          <button 
            onClick={handleAddNew}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-medium"
          >
            <Plus size={18} />
            <span className="hidden md:inline">Add Menu Item</span>
            <span className="md:hidden">Add</span>
          </button>
        )}
      </div>

      {isEditing && (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 mb-8 animate-fade-in">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <h3 className="text-lg font-bold text-slate-800">
              {currentItem.id && menuItems.some(i => i.id === currentItem.id) ? 'Edit Menu Item' : 'New Menu Item'}
            </h3>
            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Item Name</label>
                  <input 
                  type="text" 
                  required
                  value={currentItem.name || ''}
                  onChange={e => setCurrentItem({...currentItem, name: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. Veg Steam Full Plate"
                  />
               </div>

               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price</label>
                  <div className="relative">
                     <input 
                       type="number" 
                       required
                       min="0"
                       value={currentItem.price || ''}
                       onChange={e => setCurrentItem({...currentItem, price: parseFloat(e.target.value)})}
                       className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                     />
                     <IndianRupee size={14} className="absolute left-3 top-3 text-slate-400" />
                  </div>
               </div>
            </div>

            <div>
               <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  System ID / Code <KeyRound size={14} className="text-slate-400" />
               </label>
               <input 
                 type="text"
                 value={currentItem.id || ''}
                 onChange={e => setCurrentItem({...currentItem, id: e.target.value})}
                 readOnly={menuItems.some(i => i.id === currentItem.id)} // Read-only if editing existing
                 className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-sm ${
                    menuItems.some(i => i.id === currentItem.id) ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' : 'border-slate-300 bg-white'
                 }`}
                 placeholder="Auto-generated if left empty"
                 title={menuItems.some(i => i.id === currentItem.id) ? "ID cannot be changed after creation" : "Enter a custom ID (e.g. POS Code) or leave blank"}
               />
               {!menuItems.some(i => i.id === currentItem.id) && (
                  <p className="text-[10px] text-slate-500 mt-1">Optional: Enter your POS Product ID here to link sales data easily.</p>
               )}
            </div>

            <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
               <input 
                 value={currentItem.description || ''}
                 onChange={e => setCurrentItem({...currentItem, description: e.target.value})}
                 className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                 placeholder="e.g. Served with spicy chutney"
               />
            </div>

            {/* Recipe Builder */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
               <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                     <ChefHat size={16} className="text-slate-500"/> Recipe / Ingredients
                  </label>
                  <button 
                     type="button" 
                     onClick={addIngredient}
                     className="text-xs flex items-center gap-1 text-emerald-600 font-bold hover:bg-emerald-50 px-2 py-1 rounded"
                  >
                     <Plus size={12} /> Add Ingredient
                  </button>
               </div>
               
               {ingredients.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm py-4 italic">
                     No ingredients defined. Add SKUs to link this menu item to inventory.
                  </div>
               ) : (
                  <div className="space-y-2">
                     {ingredients.map((ing, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                           <div className="flex-1">
                              <select 
                                 value={ing.skuId}
                                 onChange={(e) => updateIngredient(idx, 'skuId', e.target.value)}
                                 className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                              >
                                 {skus.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.piecesPerPacket} pcs/pkt)</option>
                                 ))}
                              </select>
                           </div>
                           <div className="w-24 relative">
                              <input 
                                 type="number" 
                                 min="0"
                                 value={ing.quantity}
                                 onChange={(e) => updateIngredient(idx, 'quantity', parseInt(e.target.value))}
                                 className="w-full border border-slate-300 rounded-lg pl-2 pr-7 py-1.5 text-sm text-center"
                              />
                              <span className="absolute right-2 top-1.5 text-xs text-slate-400 pointer-events-none">pcs</span>
                           </div>
                           <button 
                              type="button"
                              onClick={() => removeIngredient(idx)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                           >
                              <Trash2 size={16} />
                           </button>
                        </div>
                     ))}
                  </div>
               )}
               
               <div className="mt-3 flex items-start gap-2 text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-100">
                  <Info size={14} className="mt-0.5 flex-shrink-0" />
                  <p>
                     Define the exact number of pieces used. For example, a <strong>Veg Steam Plate</strong> might use <strong>10 pieces</strong> of <em>Veg Steam Raw SKU</em>. A <strong>Platter</strong> might use <strong>4 pcs</strong> of 3 different SKUs.
                  </p>
               </div>
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
                Save Item
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
                <th className="p-4">Item Name</th>
                <th className="p-4">System ID</th>
                <th className="p-4">Recipe (Ingredients)</th>
                <th className="p-4 text-right">Price</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {menuItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-center text-slate-400 text-sm">
                    {index + 1}
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-700">{item.name}</div>
                    {item.description && <div className="text-xs text-slate-400">{item.description}</div>}
                  </td>
                  <td className="p-4">
                     <button 
                        onClick={() => copyToClipboard(item.id)}
                        className="group flex items-center gap-2 text-xs font-mono bg-slate-100 hover:bg-slate-200 text-slate-500 px-2 py-1 rounded transition-colors"
                        title="Click to copy ID"
                     >
                        {item.id}
                        {copiedId === item.id ? (
                           <Check size={12} className="text-emerald-600" />
                        ) : (
                           <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                     </button>
                  </td>
                  <td className="p-4">
                     {item.ingredients && item.ingredients.length > 0 ? (
                        <div className="flex flex-col gap-1">
                           {item.ingredients.map((ing, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-700 border border-slate-200 w-fit">
                                 <span className="font-bold">{ing.quantity}x</span> {getSkuName(ing.skuId)}
                              </span>
                           ))}
                        </div>
                     ) : (
                        <span className="text-xs text-slate-300 italic">No recipe defined</span>
                     )}
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-mono font-bold text-slate-800 flex items-center justify-end gap-1">
                       <IndianRupee size={12} /> {item.price}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(item)}
                        className="p-2 md:p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} className="md:w-4 md:h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 md:p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} className="md:w-4 md:h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {menuItems.length === 0 && (
                 <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 italic">No menu items configured.</td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MenuManagement;
