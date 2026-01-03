
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { MenuItem, MenuIngredient } from '../types';
import { Plus, Edit2, Trash2, X, Save, Utensils, IndianRupee, Info, ChefHat, Check, KeyRound, Divide, FileJson, Download, Tag, Copy } from 'lucide-react';

// Helper to escape regex characters
const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const MenuManagement: React.FC = () => {
  const { menuItems, skus, addMenuItem, updateMenuItem, deleteMenuItem, menuCategories } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<MenuItem>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Export Prompt State
  const [showExportPrompt, setShowExportPrompt] = useState(false);
  
  // JSON Preview Modal State
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonData, setJsonData] = useState('');
  const [jsonCopied, setJsonCopied] = useState(false);
  
  // Local state for ingredients editing
  const [ingredients, setIngredients] = useState<MenuIngredient[]>([]);
  const [halfIngredients, setHalfIngredients] = useState<MenuIngredient[]>([]);
  const [recipeTab, setRecipeTab] = useState<'FULL' | 'HALF'>('FULL');

  // UX: Scroll Management
  const formRef = useRef<HTMLDivElement>(null);
  const [editingReturnId, setEditingReturnId] = useState<string | null>(null);

  // Effect: Scroll to form when it opens
  useEffect(() => {
    if (isEditing && formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [isEditing]);

  const closeForm = () => {
    setIsEditing(false);
    setCurrentItem({});
    setIngredients([]);
    setHalfIngredients([]);
    
    // Scroll back to the item we were editing
    if (editingReturnId) {
      setTimeout(() => {
        const row = document.getElementById(`menu-row-${editingReturnId}`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
    setEditingReturnId(null);
  };

  const handleAddNew = () => {
    setEditingReturnId(null); // No specific item to return to
    setCurrentItem({ name: '', price: 0, category: menuCategories.length > 0 ? menuCategories[0].name : '' });
    setIngredients([]);
    setHalfIngredients([]);
    setRecipeTab('FULL');
    setIsEditing(true);
  };

  const handleEdit = (item: MenuItem) => {
    setEditingReturnId(item.id); // Remember where to scroll back to
    setCurrentItem({ ...item });
    setIngredients(item.ingredients ? [...item.ingredients] : []);
    setHalfIngredients(item.halfIngredients ? [...item.halfIngredients] : []);
    setRecipeTab('FULL');
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this menu item?')) {
      deleteMenuItem(id);
      setShowExportPrompt(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem.name) return;

    const payload = {
       ...currentItem,
       category: currentItem.category || 'Uncategorized',
       ingredients,
       halfIngredients
    };

    if (currentItem.id && menuItems.some(i => i.id === currentItem.id)) {
      await updateMenuItem(payload as MenuItem);
    } else {
      await addMenuItem(payload as Omit<MenuItem, 'id'>);
    }
    closeForm();
    setShowExportPrompt(true); // Trigger notification
  };

  // --- Export Logic ---
  const generateAppConfig = () => {
    // 1. Map existing menu items
    const exportData = menuItems.map(item => {
        const catName = item.category || 'Uncategorized';
        
        // Clean Name Logic
        let cleanName = item.name;
        // Remove Category Name from Item Name (case insensitive)
        // Use escapeRegExp to prevent crashes if category has special chars like (, ), +
        const catRegex = new RegExp(`\\b${escapeRegExp(catName)}\\b`, 'gi');
        cleanName = cleanName.replace(catRegex, '');
        // Remove common suffixes
        cleanName = cleanName.replace(/\b(Full Plate|Plate|Half|Platter)\b/gi, '');
        // Trim and clean double spaces
        cleanName = cleanName.replace(/\s+/g, ' ').trim();
        
        // Fallback if name becomes empty
        if (!cleanName) cleanName = item.name;

        // Construct basic entry
        const itemEntry: any = {
            id: item.id,
            category: catName,
            label: item.name,
            name: cleanName,
            item_image: `${item.id}.jpg`, // Changed to .jpg
            includes: {}
        };

        // --- PLATE Logic ---
        const plateIngs = item.ingredients || [];
        // Logic: Use 'items' array if it's a Platter (or multiple items), otherwise single object
        const isPlatter = plateIngs.length > 1 || catName.toLowerCase() === 'platters';

        if (isPlatter) {
             itemEntry.includes.plate = {
                 price: item.price,
                 items: plateIngs.map(ing => ({
                     quantity: ing.quantity,
                     skuId: ing.skuId
                 }))
             };
        } else {
             const totalQty = plateIngs.reduce((sum, ing) => sum + ing.quantity, 0);
             const mainSku = plateIngs.length > 0 ? plateIngs[0].skuId : '';
             
             itemEntry.includes.plate = {
                 price: item.price,
                 quantity: totalQty,
                 skuId: mainSku
             };
        }

        // --- HALF PLATE Logic ---
        if (item.halfPrice) {
            let finalHalfIngs = item.halfIngredients || [];
            // Auto-calculate if empty
            if (finalHalfIngs.length === 0 && plateIngs.length > 0) {
                 finalHalfIngs = plateIngs.map(i => ({ ...i, quantity: i.quantity * 0.5 }));
            }

            const isHalfPlatter = finalHalfIngs.length > 1 || catName.toLowerCase() === 'platters';

            if (isHalfPlatter) {
                 itemEntry.includes.half_plate = {
                     price: item.halfPrice,
                     items: finalHalfIngs.map(ing => ({
                         quantity: ing.quantity,
                         skuId: ing.skuId
                     }))
                 };
            } else {
                 const totalHalfQty = finalHalfIngs.reduce((sum, ing) => sum + ing.quantity, 0);
                 const mainHalfSku = finalHalfIngs.length > 0 ? finalHalfIngs[0].skuId : '';

                 itemEntry.includes.half_plate = {
                     price: item.halfPrice,
                     quantity: totalHalfQty,
                     skuId: mainHalfSku
                 };
            }
        }

        return itemEntry;
    });

    // 2. Append Static System Items (Addons/Modals)
    const staticItems = [
        {
            id: "custom_amount",
            category: "Addons",
            label: "Custom Amount",
            name: "Custom Amount",
            item_image: "custom_amount.jpg", // Changed to .jpg
            is_modal: true,
            includes: {
                plate: { price: 0, quantity: 0 }
            }
        },
        {
            id: "custom_pieces",
            category: "Addons",
            label: "Custom Pieces",
            name: "Custom Pieces",
            item_image: "custom_pieces.jpg", // Changed to .jpg
            is_modal: true,
            includes: {
                plate: { price: 0, quantity: 0 }
            }
        }
    ];

    // Combine and Stringify
    return JSON.stringify([...exportData, ...staticItems], null, 2);
  };

  const openExportModal = () => {
    const jsonString = generateAppConfig();
    setJsonData(jsonString);
    setShowJsonModal(true);
    setShowExportPrompt(false);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `pakaja_pos_config_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonData);
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2000);
  };

  const getSkuName = (skuId?: string) => {
     if(!skuId) return 'Unknown';
     const sku = skus.find(s => s.id === skuId);
     return sku ? sku.name : 'Unknown SKU';
  };
  
  const getCategoryColor = (catName?: string) => {
      const cat = menuCategories.find(c => c.name === catName);
      return cat?.color || '#64748b';
  };

  const getCurrentList = () => recipeTab === 'FULL' ? ingredients : halfIngredients;
  const setList = (list: MenuIngredient[]) => recipeTab === 'FULL' ? setIngredients(list) : setHalfIngredients(list);

  const addIngredient = () => {
     if(skus.length === 0) return;
     const current = getCurrentList();
     setList([...current, { skuId: skus[0].id, quantity: 1 }]);
  };

  const updateIngredient = (index: number, field: keyof MenuIngredient, value: string | number) => {
     const newIngredients = [...getCurrentList()];
     newIngredients[index] = { ...newIngredients[index], [field]: value };
     setList(newIngredients);
  };

  const removeIngredient = (index: number) => {
     setList(getCurrentList().filter((_, i) => i !== index));
  };

  const copyFullToHalf = () => {
      const calculated = ingredients.map(ing => ({
          skuId: ing.skuId,
          quantity: ing.quantity * 0.5
      }));
      setHalfIngredients(calculated);
      setRecipeTab('HALF');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="pb-16 relative">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Utensils className="text-orange-500" /> Menu & Pricing
           </h2>
           <p className="text-slate-500 text-sm md:text-base">Manage sellable items, recipes, and prices.</p>
        </div>
        {!isEditing && (
          <div className="flex gap-2">
            <button 
              onClick={openExportModal}
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-bold border border-slate-700"
            >
              <FileJson size={18} />
              <span className="hidden md:inline">Export App JSON</span>
              <span className="md:hidden">Export</span>
            </button>
            <button 
              onClick={handleAddNew}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-medium"
            >
              <Plus size={18} />
              <span className="hidden md:inline">Add Item</span>
              <span className="md:hidden">Add</span>
            </button>
          </div>
        )}
      </div>

      {isEditing && (
        <div ref={formRef} className="bg-white rounded-xl shadow-md border border-slate-200 p-6 mb-8 animate-fade-in scroll-mt-24">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <h3 className="text-lg font-bold text-slate-800">
              {currentItem.id && menuItems.some(i => i.id === currentItem.id) ? 'Edit Menu Item' : 'New Menu Item'}
            </h3>
            <button onClick={closeForm} className="text-slate-400 hover:text-slate-600">
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
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                     Category <Tag size={14} className="text-slate-400" />
                  </label>
                  <select 
                     value={currentItem.category || ''}
                     onChange={e => setCurrentItem({...currentItem, category: e.target.value})}
                     className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                     <option value="">-- Select Category --</option>
                     {menuCategories.sort((a,b) => a.order - b.order).map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                     ))}
                     <option value="Uncategorized">Uncategorized</option>
                  </select>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="flex gap-3">
                  <div className="flex-1">
                     <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price (Full)</label>
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
                  <div className="flex-1">
                     <label className="block text-sm font-medium text-slate-700 mb-1">Half Price (Optional)</label>
                     <div className="relative">
                        <input 
                          type="number" 
                          min="0"
                          value={currentItem.halfPrice || ''}
                          onChange={e => setCurrentItem({...currentItem, halfPrice: e.target.value ? parseFloat(e.target.value) : undefined})}
                          className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="e.g. 60"
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
               </div>
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
                     <ChefHat size={16} className="text-slate-500"/> Recipe Configuration
                  </label>
               </div>
               
               {/* Recipe Tabs */}
               <div className="flex gap-1 bg-slate-200 p-1 rounded-lg mb-4">
                  <button 
                     type="button"
                     onClick={() => setRecipeTab('FULL')}
                     className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                        recipeTab === 'FULL' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-emerald-700'
                     }`}
                  >
                     Full Plate Recipe
                  </button>
                  <button 
                     type="button"
                     onClick={() => setRecipeTab('HALF')}
                     className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                        recipeTab === 'HALF' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-orange-700'
                     }`}
                  >
                     Half Plate Recipe
                  </button>
               </div>

               {/* Quick Action: Copy Full to Half */}
               {recipeTab === 'HALF' && ingredients.length > 0 && halfIngredients.length === 0 && (
                   <button 
                     type="button"
                     onClick={copyFullToHalf}
                     className="w-full py-2 mb-4 border border-dashed border-orange-300 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold hover:bg-orange-100 flex items-center justify-center gap-2"
                   >
                       <Divide size={14} /> Auto-fill from Full Plate (0.5x)
                   </button>
               )}
               
               {getCurrentList().length === 0 ? (
                  <div className="text-center text-slate-400 text-sm py-4 italic border border-dashed border-slate-200 rounded-lg">
                     No ingredients defined for {recipeTab === 'FULL' ? 'Full' : 'Half'} Plate.
                     <br />
                     <button 
                        type="button"
                        onClick={addIngredient}
                        className="mt-2 text-emerald-600 font-bold hover:underline"
                     >
                        + Add First Ingredient
                     </button>
                  </div>
               ) : (
                  <div className="space-y-2">
                     {getCurrentList().map((ing, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                           <div className="flex-1">
                              <select 
                                 value={ing.skuId}
                                 onChange={(e) => updateIngredient(idx, 'skuId', e.target.value)}
                                 className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-emerald-500"
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
                                 step="0.01"
                                 value={ing.quantity}
                                 onChange={(e) => updateIngredient(idx, 'quantity', parseFloat(e.target.value))}
                                 className="w-full border border-slate-300 rounded-lg pl-2 pr-7 py-1.5 text-sm text-center focus:outline-none focus:border-emerald-500"
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
                     
                     <button 
                        type="button" 
                        onClick={addIngredient}
                        className="text-xs flex items-center gap-1 text-emerald-600 font-bold hover:bg-emerald-50 px-2 py-1 rounded mt-2"
                     >
                        <Plus size={12} /> Add Ingredient
                     </button>
                  </div>
               )}
               
               <div className="mt-3 flex items-start gap-2 text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-100">
                  <Info size={14} className="mt-0.5 flex-shrink-0" />
                  <p>
                     {recipeTab === 'FULL' 
                        ? "Define ingredients for a Full Plate. If no Half Plate recipe is set, the system will use 50% of these values for half plates."
                        : "Define specific ingredients for a Half Plate. This overrides the automatic 50% calculation."
                     }
                  </p>
               </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button"
                onClick={closeForm}
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
                <th className="p-4">Category</th>
                <th className="p-4">Recipe Summary</th>
                <th className="p-4 text-right">Price (Full / Half)</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {menuItems.map((item, index) => {
                const catColor = getCategoryColor(item.category);
                
                return (
                <tr key={item.id} id={`menu-row-${item.id}`} className="hover:bg-slate-50 transition-colors scroll-mt-32">
                  <td className="p-4 text-center text-slate-400 text-sm">
                    {index + 1}
                  </td>
                  <td className="p-4">
                     <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{item.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                           {item.description && <div className="text-xs text-slate-400">{item.description}</div>}
                           <button 
                              onClick={() => copyToClipboard(item.id)}
                              className="group flex items-center gap-1 text-[10px] font-mono text-slate-300 hover:text-slate-500 transition-colors"
                              title="Click to copy ID"
                           >
                              {copiedId === item.id ? <Check size={10} className="text-emerald-500"/> : item.id}
                           </button>
                        </div>
                     </div>
                  </td>
                  <td className="p-4">
                     {item.category && item.category !== 'Uncategorized' ? (
                        <span 
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-xs font-bold shadow-sm"
                          style={{ backgroundColor: catColor }}
                        >
                           <Tag size={10} /> {item.category}
                        </span>
                     ) : (
                        <span className="text-xs text-slate-300 italic">No Category</span>
                     )}
                  </td>
                  <td className="p-4">
                     <div className="flex flex-col gap-2">
                        {/* Full Plate */}
                        {item.ingredients && item.ingredients.length > 0 && (
                           <div className="flex flex-col gap-1">
                              <div className="text-[10px] text-slate-400 font-bold uppercase">Full:</div>
                              {item.ingredients.map((ing, idx) => (
                                 <span key={idx} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-700 border border-slate-200 w-fit">
                                    <span className="font-bold">{ing.quantity}x</span> {getSkuName(ing.skuId)}
                                 </span>
                              ))}
                           </div>
                        )}

                        {/* Half Plate */}
                        {item.halfIngredients && item.halfIngredients.length > 0 && (
                           <div className="flex flex-col gap-1">
                              <div className="text-[10px] text-slate-400 font-bold uppercase">Half:</div>
                              {item.halfIngredients.map((ing, idx) => (
                                 <span key={`h-${idx}`} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-orange-50 text-xs text-orange-800 border border-orange-100 w-fit">
                                    <span className="font-bold">{ing.quantity}x</span> {getSkuName(ing.skuId)}
                                 </span>
                              ))}
                           </div>
                        )}

                        {(!item.ingredients?.length && !item.halfIngredients?.length) && (
                           <span className="text-xs text-slate-300 italic">No recipe defined</span>
                        )}
                     </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex flex-col items-end gap-1">
                        <span className="font-mono font-bold text-slate-800 flex items-center justify-end gap-1">
                           <IndianRupee size={12} /> {item.price}
                        </span>
                        {item.halfPrice && (
                           <span className="text-xs text-slate-500 font-mono flex items-center">
                              Half: <IndianRupee size={10} /> {item.halfPrice}
                           </span>
                        )}
                    </div>
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
              )})}
              {menuItems.length === 0 && (
                 <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 italic">No menu items configured.</td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Prompt Modal (Notification after Save) */}
      {showExportPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md text-center">
             <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                <FileJson size={32} />
             </div>
             <h3 className="text-xl font-bold text-slate-800 mb-2">Configuration Updated!</h3>
             <p className="text-slate-600 mb-6 text-sm">
                You have modified the menu or pricing. Please export the updated JSON file to keep the POS app in sync.
             </p>
             <div className="flex gap-3 justify-center">
                <button 
                  onClick={() => setShowExportPrompt(false)} 
                  className="px-5 py-2.5 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                >
                  Later
                </button>
                <button 
                  onClick={openExportModal} 
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md flex items-center gap-2 transition-colors"
                >
                  <FileJson size={18} /> View Export Data
                </button>
             </div>
          </div>
        </div>
      )}

      {/* JSON Preview Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col h-[75vh] md:h-[80vh] overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
                       <FileJson size={20} />
                    </div>
                    <div>
                       <h3 className="text-lg font-bold text-slate-800">Export Configuration</h3>
                       <p className="text-xs text-slate-500">Copy or download this JSON for the POS App.</p>
                    </div>
                 </div>
                 <button onClick={() => setShowJsonModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={24} />
                 </button>
              </div>

              {/* Code Body */}
              <div className="relative flex-1 bg-slate-900 overflow-hidden group">
                 {/* Mac-like Window Header */}
                 <div className="absolute top-0 left-0 w-full h-8 bg-slate-800 border-b border-slate-700 flex items-center px-4 space-x-2 z-10">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                    <span className="ml-2 text-[10px] font-mono text-slate-400 select-none">pakaja_config.json</span>
                 </div>
                 
                 <textarea 
                    readOnly
                    value={jsonData}
                    className="w-full h-full bg-slate-900 text-blue-300 font-mono text-xs p-4 pt-12 resize-none focus:outline-none custom-scrollbar"
                    spellCheck={false}
                 />
                 <button 
                    onClick={handleCopyJson}
                    className="absolute top-10 right-6 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                 >
                    {jsonCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {jsonCopied ? 'Copied!' : 'Copy JSON'}
                 </button>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-white">
                 <button 
                    onClick={() => setShowJsonModal(false)}
                    className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                 >
                    Close
                 </button>
                 <button 
                    onClick={handleCopyJson}
                    className="px-5 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors flex items-center gap-2"
                 >
                    {jsonCopied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                    Copy Code
                 </button>
                 <button 
                    onClick={handleDownload}
                    className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md transition-colors flex items-center gap-2"
                 >
                    <Download size={18} /> Download .json
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default MenuManagement;
