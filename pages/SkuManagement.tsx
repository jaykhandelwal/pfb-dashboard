
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { SKU, SKUCategory, SKUDietary } from '../types';
import { Plus, Edit2, Trash2, X, Save, Box, ArrowUp, ArrowDown, Copy, Check } from 'lucide-react';

const SkuManagement: React.FC = () => {
  const { skus, addSku, updateSku, deleteSku, reorderSku } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [currentSku, setCurrentSku] = useState<Partial<SKU>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const initialFormState: Partial<SKU> = {
    name: '',
    category: SKUCategory.STEAM,
    dietary: SKUDietary.VEG,
    piecesPerPacket: 50
  };

  const handleAddNew = () => {
    setCurrentSku(initialFormState);
    setIsEditing(true);
  };

  const handleEdit = (sku: SKU) => {
    setCurrentSku({ ...sku });
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this SKU?')) {
      deleteSku(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSku.name) return;

    if (currentSku.id) {
      updateSku(currentSku as SKU);
    } else {
      addSku(currentSku as Omit<SKU, 'id' | 'order'>);
    }
    setIsEditing(false);
    setCurrentSku({});
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
           <h2 className="text-2xl font-bold text-slate-800">SKU Management</h2>
           <p className="text-slate-500 text-sm md:text-base">Configure raw inventory items.</p>
        </div>
        {!isEditing && (
          <button 
            onClick={handleAddNew}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-medium"
          >
            <Plus size={18} />
            <span className="hidden md:inline">Add New SKU</span>
            <span className="md:hidden">Add</span>
          </button>
        )}
      </div>

      {isEditing && (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 mb-8 animate-fade-in">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <h3 className="text-lg font-bold text-slate-800">
              {currentSku.id ? 'Edit SKU' : 'New SKU'}
            </h3>
            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU Name</label>
              <input 
                type="text" 
                required
                value={currentSku.name || ''}
                onChange={e => setCurrentSku({...currentSku, name: e.target.value})}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="e.g. Steamed Chicken Momos"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select 
                value={currentSku.category}
                onChange={e => {
                  const newCategory = e.target.value as SKUCategory;
                  const newDietary = newCategory === SKUCategory.CONSUMABLES ? SKUDietary.NA : currentSku.dietary;
                  setCurrentSku({...currentSku, category: newCategory, dietary: newDietary});
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {Object.values(SKUCategory).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {currentSku.category !== SKUCategory.CONSUMABLES && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Dietary Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentSku({...currentSku, dietary: SKUDietary.VEG})}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      currentSku.dietary === SKUDietary.VEG 
                        ? 'bg-green-100 text-green-700 border-green-200' 
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Veg
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentSku({...currentSku, dietary: SKUDietary.NON_VEG})}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      currentSku.dietary === SKUDietary.NON_VEG 
                        ? 'bg-red-100 text-red-700 border-red-200' 
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Non-Veg
                  </button>
                </div>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
               <label className="block text-sm font-medium text-slate-700 mb-1">Packet Size (Pcs)</label>
               <div className="text-xs text-slate-500 mb-2">Pieces per sealed packet (or 1 for loose items)</div>
               <input 
                type="number" 
                required
                min="1"
                value={currentSku.piecesPerPacket || ''}
                onChange={e => setCurrentSku({...currentSku, piecesPerPacket: parseInt(e.target.value)})}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 pt-4">
              <button 
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <Save size={18} />
                Save SKU
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
                <th className="p-4">SKU Name</th>
                <th className="p-4">System ID</th>
                <th className="hidden md:table-cell p-4">Dietary</th>
                <th className="hidden md:table-cell p-4">Category</th>
                <th className="hidden sm:table-cell p-4">Packet Size</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {skus.map((sku, index) => (
                <tr key={sku.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      <button 
                        onClick={() => reorderSku(sku.id, 'up')}
                        disabled={index === 0}
                        className="text-slate-300 hover:text-emerald-600 disabled:opacity-20 disabled:hover:text-slate-300"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button 
                        onClick={() => reorderSku(sku.id, 'down')}
                        disabled={index === skus.length - 1}
                        className="text-slate-300 hover:text-emerald-600 disabled:opacity-20 disabled:hover:text-slate-300"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  </td>
                  <td className="p-4 font-medium text-slate-700">
                    <div>{sku.name}</div>
                    <div className="md:hidden flex flex-wrap items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        sku.category === 'Steam' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        sku.category === 'Kurkure' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        sku.category === 'Consumables' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {sku.category}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                     <button 
                        onClick={() => copyToClipboard(sku.id)}
                        className="group flex items-center gap-2 text-xs font-mono bg-slate-100 hover:bg-slate-200 text-slate-500 px-2 py-1 rounded transition-colors"
                        title="Click to copy ID for POS"
                     >
                        {sku.id}
                        {copiedId === sku.id ? (
                           <Check size={12} className="text-emerald-600" />
                        ) : (
                           <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                     </button>
                  </td>
                  <td className="hidden md:table-cell p-4">
                    {sku.dietary !== SKUDietary.NA && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        sku.dietary === SKUDietary.VEG 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {sku.dietary}
                      </span>
                    )}
                  </td>
                  <td className="hidden md:table-cell p-4">
                     <span className="text-xs font-semibold text-slate-500">{sku.category}</span>
                  </td>
                  <td className="hidden sm:table-cell p-4">
                    <span className="flex items-center gap-2 text-slate-500">
                      <Box size={16} />
                      {sku.piecesPerPacket} pcs
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(sku)}
                        className="p-2 md:p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} className="md:w-4 md:h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(sku.id)}
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

export default SkuManagement;
