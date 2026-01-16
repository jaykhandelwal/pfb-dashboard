import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { SKU, SKUCategory, SKUDietary } from '../types';
import { Plus, Edit2, Trash2, Save, X, Package, Ruler, IndianRupee, Tag } from 'lucide-react';

const SkuManagement: React.FC = () => {
  const { skus, addSku, updateSku, deleteSku, reorderSku } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [currentSku, setCurrentSku] = useState<Partial<SKU>>({});

  const handleAddNew = () => {
    setCurrentSku({
      name: '',
      category: SKUCategory.STEAM,
      dietary: SKUDietary.VEG,
      piecesPerPacket: 50,
      order: skus.length,
      isDeepFreezerItem: true,
      costPrice: 0
    });
    setIsEditing(true);
  };

  const handleEdit = (sku: SKU) => {
    setCurrentSku({ ...sku });
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this SKU? It may affect Menu Items and History.')) {
      deleteSku(id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSku.name) return;

    // Ensure numeric values
    const payload = {
        ...currentSku,
        piecesPerPacket: Number(currentSku.piecesPerPacket),
        costPrice: currentSku.costPrice ? Number(currentSku.costPrice) : undefined,
        volumePerPacketLitres: currentSku.volumePerPacketLitres ? Number(currentSku.volumePerPacketLitres) : undefined
    };

    if (currentSku.id) {
      await updateSku(payload as SKU);
    } else {
      await addSku(payload as Omit<SKU, 'id' | 'order'>);
    }
    setIsEditing(false);
    setCurrentSku({});
  };

  const getCategoryColor = (category: SKUCategory) => {
    switch (category) {
      case SKUCategory.STEAM: return 'bg-blue-100 text-blue-800';
      case SKUCategory.KURKURE: return 'bg-amber-100 text-amber-800';
      case SKUCategory.WHEAT: return 'bg-orange-100 text-orange-800';
      case SKUCategory.ROLL: return 'bg-purple-100 text-purple-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="pb-16 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Package className="text-indigo-600" /> SKU Management
           </h2>
           <p className="text-slate-500 text-sm md:text-base">Manage Raw Materials and Inventory Items.</p>
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
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-2">
            <h3 className="text-lg font-bold text-slate-800">
              {currentSku.id ? 'Edit SKU' : 'New SKU'}
            </h3>
            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">SKU Name</label>
                <input 
                  type="text" 
                  required
                  value={currentSku.name || ''}
                  onChange={e => setCurrentSku({...currentSku, name: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. Veg Steam Momos (Raw)"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Category</label>
                    <select 
                        value={currentSku.category}
                        onChange={e => setCurrentSku({...currentSku, category: e.target.value as SKUCategory})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                        {Object.values(SKUCategory).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Dietary Type</label>
                    <select 
                        value={currentSku.dietary}
                        onChange={e => setCurrentSku({...currentSku, dietary: e.target.value as SKUDietary})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                        {Object.values(SKUDietary).map(diet => (
                            <option key={diet} value={diet}>{diet}</option>
                        ))}
                    </select>
                  </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Pieces per Packet</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={currentSku.piecesPerPacket || ''}
                    onChange={e => setCurrentSku({...currentSku, piecesPerPacket: Number(e.target.value)})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <p className="text-xs text-slate-400 mt-1">Used for stock calculations.</p>
               </div>

               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1">
                     <Ruler size={14} /> Volume (Litres)
                  </label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={currentSku.volumePerPacketLitres || ''}
                    onChange={e => setCurrentSku({...currentSku, volumePerPacketLitres: Number(e.target.value)})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="e.g. 2.3"
                  />
                  <p className="text-xs text-slate-400 mt-1">For fridge capacity planning.</p>
               </div>

               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1">
                     <IndianRupee size={14} /> Cost Price (Per Pkt)
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={currentSku.costPrice || ''}
                    onChange={e => setCurrentSku({...currentSku, costPrice: Number(e.target.value)})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="0.00"
                  />
               </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-bold"
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
                <th className="p-4">Category</th>
                <th className="p-4 text-center">Config</th>
                <th className="p-4 text-right">Cost</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {skus.map((sku, index) => (
                <tr key={sku.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-center text-slate-400 text-sm">
                    {index + 1}
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-700">{sku.name}</div>
                    {sku.dietary !== SKUDietary.NA && (
                        <div className="flex items-center gap-1 mt-1">
                            <div className={`w-2 h-2 rounded-full ${sku.dietary === SKUDietary.VEG ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className="text-xs text-slate-400">{sku.dietary}</span>
                        </div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${getCategoryColor(sku.category)}`}>
                        {sku.category}
                    </span>
                  </td>
                  <td className="p-4 text-center text-sm text-slate-600">
                    <div className="flex flex-col items-center">
                        <span className="font-mono font-bold">{sku.piecesPerPacket} pcs</span>
                        {sku.volumePerPacketLitres && (
                            <span className="text-xs text-slate-400">{sku.volumePerPacketLitres} L</span>
                        )}
                    </div>
                  </td>
                  <td className="p-4 text-right font-medium text-slate-700 font-mono">
                    {sku.costPrice ? `₹${Number(sku.costPrice).toFixed(2)}` : '-'}
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
              {skus.length === 0 && (
                  <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 italic">No SKUs defined yet.</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SkuManagement;