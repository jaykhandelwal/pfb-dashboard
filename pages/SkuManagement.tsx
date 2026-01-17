
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { SKU, SKUCategory, SKUDietary } from '../types';
import { Plus, Edit2, Trash2, X, Save, Box, ArrowUp, ArrowDown, Copy, Check, FileJson, Download, Snowflake, IndianRupee, Cuboid } from 'lucide-react';

// Helper to escape regex characters
const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const SkuManagement: React.FC = () => {
  const { skus, addSku, updateSku, deleteSku, reorderSku, menuItems, menuCategories } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [currentSku, setCurrentSku] = useState<Partial<SKU>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Export Prompts & Modal
  const [showExportPrompt, setShowExportPrompt] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonData, setJsonData] = useState('');
  const [jsonCopied, setJsonCopied] = useState(false);

  const initialFormState: Partial<SKU> = {
    name: '',
    category: SKUCategory.STEAM,
    dietary: SKUDietary.VEG,
    piecesPerPacket: 50,
    isDeepFreezerItem: false,
    costPrice: 0,
    volumePerPacketLitres: 0
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
      setShowExportPrompt(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSku.name) return;

    if (currentSku.id) {
      await updateSku(currentSku as SKU);
    } else {
      await addSku(currentSku as Omit<SKU, 'id' | 'order'>);
    }
    setIsEditing(false);
    setCurrentSku({});
    setShowExportPrompt(true);
  };

  // --- Export Logic ---
  const generateAppConfig = () => {
    const exportData: Record<string, any[]> = {};
    const allCategories = new Set([...menuCategories.map(c => c.name), ...menuItems.map(m => m.category || 'Uncategorized')]);
    
    allCategories.forEach(catName => {
        const items = menuItems.filter(m => (m.category || 'Uncategorized') === catName);
        if (items.length > 0) {
            exportData[catName] = items.map(item => {
                const platePieces = item.ingredients?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
                const halfPieces = item.halfIngredients?.reduce((acc, curr) => acc + curr.quantity, 0) || (platePieces / 2);

                // Determine Clean Name
                const cleanName = item.name.replace(catName, '').replace(/ (Full Plate|Plate|Half)/gi, '').trim() || item.name;
                
                const itemEntry: any = {
                    id: item.ingredients?.[0]?.skuId || `sku-${Date.now()}`, 
                    code_name: item.id,
                    label: item.name,
                    name: cleanName,
                    plate: { price: item.price, pieces: platePieces },
                    itemImage: `${item.id}.png` // Use ID as filename
                };

                if (item.halfPrice) {
                    itemEntry.halfPlate = { price: item.halfPrice, pieces: halfPieces };
                }

                if (item.ingredients && item.ingredients.length > 1 && (catName.toLowerCase().includes('platter') || item.name.toLowerCase().includes('platter'))) {
                    const includes: Record<string, any> = {};
                    item.ingredients.forEach(ing => {
                        const sku = skus.find(s => s.id === ing.skuId);
                        const key = sku ? sku.name.replace(/ /g, '_') : ing.skuId;
                        includes[key] = { quantity: ing.quantity, skuId: ing.skuId };
                    });
                    itemEntry.includes = includes;
                }
                return itemEntry;
            });
        }
    });
    return JSON.stringify(exportData, null, 2);
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="pb-16 relative">
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

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex gap-4 flex-wrap">
               <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Packet Size (Pcs)</label>
                  <div className="text-xs text-slate-500 mb-2">Pieces per sealed packet</div>
                  <input 
                    type="number" 
                    required
                    min="1"
                    value={currentSku.piecesPerPacket || ''}
                    onChange={e => setCurrentSku({...currentSku, piecesPerPacket: parseInt(e.target.value)})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
               </div>
               
               <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cost Price (per Pkt)</label>
                  <div className="text-xs text-slate-500 mb-2">Unit cost for reports</div>
                  <div className="relative">
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      value={currentSku.costPrice || ''}
                      onChange={e => setCurrentSku({...currentSku, costPrice: parseFloat(e.target.value)})}
                      className="w-full border border-slate-300 rounded-lg pl-7 pr-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      placeholder="0"
                    />
                    <IndianRupee size={14} className="absolute left-2 top-2.5 text-slate-400" />
                  </div>
               </div>
            </div>

            <div className="flex items-center gap-3">
               <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                  <input 
                     type="checkbox" 
                     name="deepFreezer" 
                     id="deepFreezer" 
                     className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer top-1 left-1 checked:right-1 checked:left-auto"
                     checked={currentSku.isDeepFreezerItem || false}
                     onChange={(e) => setCurrentSku({...currentSku, isDeepFreezerItem: e.target.checked})}
                  />
                  <label htmlFor="deepFreezer" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${currentSku.isDeepFreezerItem ? 'bg-indigo-600' : 'bg-slate-300'}`}></label>
               </div>
               <div>
                  <label htmlFor="deepFreezer" className="text-sm text-slate-700 font-bold cursor-pointer">Store in Deep Freezer?</label>
                  <p className="text-xs text-slate-500">Enable if this item is stocked in the main storage.</p>
               </div>
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
                <th className="hidden sm:table-cell p-4">Size</th>
                <th className="hidden sm:table-cell p-4">Cost Price</th>
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
                    <div className="flex items-center gap-2">
                        {sku.name}
                        {sku.isDeepFreezerItem && (
                            <span title="Deep Freezer Item">
                                <Snowflake size={14} className="text-indigo-400" />
                            </span>
                        )}
                    </div>
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
                    <span className="flex items-center gap-1 text-slate-500 text-xs">
                        <Box size={14} /> {sku.piecesPerPacket} pcs
                    </span>
                  </td>
                  <td className="hidden sm:table-cell p-4">
                    {sku.costPrice ? (
                        <span className="flex items-center gap-1 text-slate-700 font-medium">
                            <IndianRupee size={12} /> {sku.costPrice}
                        </span>
                    ) : (
                        <span className="text-slate-300 text-xs italic">--</span>
                    )}
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

      {/* Export Prompt Modal */}
      {showExportPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md text-center">
             <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                <FileJson size={32} />
             </div>
             <h3 className="text-xl font-bold text-slate-800 mb-2">Raw Material Updated</h3>
             <p className="text-slate-600 mb-6 text-sm">
                You have modified the SKUs. This might affect recipes. Please export the updated JSON file to keep the POS app in sync.
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
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold shadow-md flex items-center gap-2 transition-colors"
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
                    <div className="bg-slate-200 p-2 rounded-lg text-slate-600">
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
                    className="px-6 py-2.5 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-900 shadow-md transition-colors flex items-center gap-2"
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

export default SkuManagement;
