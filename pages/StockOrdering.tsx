
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Truck, Plus, Trash2, Edit2, Snowflake, X, Box, Calculator, Cuboid, Settings, BarChart2, CheckSquare, Square } from 'lucide-react';
import { StorageUnit, TransactionType, SKUCategory } from '../types';

const StockOrdering: React.FC = () => {
  const { storageUnits, addStorageUnit, updateStorageUnit, deleteStorageUnit, appSettings, updateAppSetting, skus, transactions } = useStore();
  
  // Local State for Calculation - initialized from AppSettings or default 2.3
  const [litresPerPacket, setLitresPerPacket] = useState<string>(
      appSettings.stock_ordering_litres_per_packet?.toString() || '2.3'
  ); 
  
  const [enabledCategories, setEnabledCategories] = useState<string[]>(
      appSettings.deep_freezer_categories || []
  );

  const [isCategoryConfigOpen, setIsCategoryConfigOpen] = useState(false);

  // Sync state if appSettings updates externally (e.g. initial load)
  useEffect(() => {
      if (appSettings.stock_ordering_litres_per_packet && appSettings.stock_ordering_litres_per_packet.toString() !== litresPerPacket) {
          setLitresPerPacket(appSettings.stock_ordering_litres_per_packet.toString());
      }
      if (appSettings.deep_freezer_categories) {
          setEnabledCategories(appSettings.deep_freezer_categories);
      }
  }, [appSettings.stock_ordering_litres_per_packet, appSettings.deep_freezer_categories]);

  // Save to AppSettings on change (debounced or onBlur would be better, but simple update here)
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value;
      setLitresPerPacket(newVal);
  };

  const saveVolumeSetting = () => {
      if (litresPerPacket) {
          updateAppSetting('stock_ordering_litres_per_packet', litresPerPacket);
      }
  };

  const toggleCategory = (cat: string) => {
      const newCats = enabledCategories.includes(cat) 
          ? enabledCategories.filter(c => c !== cat)
          : [...enabledCategories, cat];
      
      setEnabledCategories(newCats);
      updateAppSetting('deep_freezer_categories', newCats);
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Partial<StorageUnit>>({});

  const handleAddNew = () => {
    setEditingUnit({ name: '', capacityLitres: 0, type: 'DEEP_FREEZER' });
    setIsModalOpen(true);
  };

  const handleEdit = (unit: StorageUnit) => {
    setEditingUnit({ ...unit });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to remove this freezer?")) {
        deleteStorageUnit(id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit.name || !editingUnit.capacityLitres) return;

    if (editingUnit.id) {
        await updateStorageUnit(editingUnit as StorageUnit);
    } else {
        await addStorageUnit(editingUnit as Omit<StorageUnit, 'id'>);
    }
    setIsModalOpen(false);
    setEditingUnit({});
  };

  // --- Calculations ---

  // 1. Total Litres
  const totalCapacityLitres = useMemo(() => {
      return storageUnits.reduce((acc, unit) => acc + (unit.isActive ? unit.capacityLitres : 0), 0);
  }, [storageUnits]);

  // 2. Max Packets
  const maxPackets = useMemo(() => {
      const perPacket = parseFloat(litresPerPacket);
      if (!perPacket || perPacket <= 0) return 0;
      return Math.floor(totalCapacityLitres / perPacket);
  }, [totalCapacityLitres, litresPerPacket]);

  // 3. Current Stock & Consumption Logic
  const { currentStockPackets, recommendedOrders, availablePackets } = useMemo(() => {
      // A. Calculate Current Stock (Only for Enabled Categories)
      const relevantSkus = skus.filter(s => enabledCategories.includes(s.category));
      const stockMap: Record<string, number> = {}; // SKU ID -> Packet Count
      
      // Calculate Stock Levels locally (similar to Inventory page but scoped)
      const levels: Record<string, number> = {};
      relevantSkus.forEach(s => levels[s.id] = 0);

      transactions.forEach(t => {
          if (levels[t.skuId] === undefined) return;
          if (t.type === TransactionType.RESTOCK || t.type === TransactionType.CHECK_IN || (t.type === TransactionType.ADJUSTMENT && t.quantityPieces > 0)) {
              levels[t.skuId] += t.quantityPieces;
          } else if (t.type === TransactionType.CHECK_OUT || (t.type === TransactionType.ADJUSTMENT && t.quantityPieces < 0) || (t.type === TransactionType.WASTE && t.branchId === 'FRIDGE')) {
              levels[t.skuId] -= Math.abs(t.quantityPieces);
          }
      });

      let usedPackets = 0;
      Object.keys(levels).forEach(skuId => {
          const sku = relevantSkus.find(s => s.id === skuId);
          if (sku) {
              const pktSize = sku.piecesPerPacket > 0 ? sku.piecesPerPacket : 1;
              const pkts = Math.max(0, levels[skuId]) / pktSize; // Fractional packets count towards volume
              stockMap[skuId] = pkts;
              usedPackets += pkts;
          }
      });

      const available = Math.max(0, maxPackets - Math.ceil(usedPackets));

      // B. Calculate 3-Month Consumption
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      const cutoffStr = cutoffDate.toISOString().slice(0, 10);

      const consumptionMap: Record<string, number> = {};
      let totalConsumption = 0;

      transactions.forEach(t => {
          if (t.date >= cutoffStr && (t.type === TransactionType.CHECK_OUT || t.type === TransactionType.WASTE)) {
              if (stockMap[t.skuId] !== undefined) {
                  consumptionMap[t.skuId] = (consumptionMap[t.skuId] || 0) + t.quantityPieces;
                  totalConsumption += t.quantityPieces;
              }
          }
      });

      // C. Generate Recommendations
      const recommendations: { sku: any, currentPkts: number, consumptionShare: number, recommendPkts: number }[] = [];
      
      if (totalConsumption > 0 && available > 0) {
          relevantSkus.forEach(sku => {
              const consumed = consumptionMap[sku.id] || 0;
              const share = consumed / totalConsumption; // % of total volume
              const recommended = Math.floor(available * share);
              
              if (recommended > 0) {
                  recommendations.push({
                      sku,
                      currentPkts: stockMap[sku.id] || 0,
                      consumptionShare: share,
                      recommendPkts: recommended
                  });
              }
          });
      }

      return { 
          currentStockPackets: Math.ceil(usedPackets), 
          availablePackets: available,
          recommendedOrders: recommendations.sort((a,b) => b.recommendPkts - a.recommendPkts) 
      };

  }, [skus, transactions, enabledCategories, maxPackets]);


  return (
    <div className="pb-24 max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <Truck className="text-indigo-600" size={28} /> Stock Ordering
        </h2>
        <p className="text-slate-500 mt-1">Manage base storage and plan orders.</p>
      </div>

      {/* Capacity Calculation Dashboard */}
      <section className="mb-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl">
         <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-white/10 rounded-lg">
                <Calculator size={24} className="text-indigo-300" />
            </div>
            <div>
                <h3 className="text-lg font-bold">Capacity Calculator</h3>
                <p className="text-xs text-slate-400">Estimate total storage capability based on volume.</p>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
             {/* Total Volume */}
             <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Fridge Volume</p>
                 <div className="flex items-baseline gap-1">
                     <span className="text-3xl font-mono font-bold text-indigo-400">{totalCapacityLitres}</span>
                     <span className="text-sm font-medium text-slate-500">Litres</span>
                 </div>
                 <p className="text-[10px] text-slate-500 mt-1">Sum of {storageUnits.length} configured units</p>
             </div>

             {/* Calculation Factor */}
             <div className="flex flex-col justify-center">
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Cuboid size={14} /> Volume per Packet
                 </label>
                 <div className="relative">
                    <input 
                       type="number"
                       min="0.1"
                       step="0.1"
                       value={litresPerPacket}
                       onChange={handleVolumeChange}
                       onBlur={saveVolumeSetting}
                       className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-lg font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-center"
                    />
                    <span className="absolute right-4 top-4 text-xs text-slate-500 font-bold">Litres</span>
                 </div>
                 <p className="text-[10px] text-center text-slate-500 mt-2">Avg space taken by 1 packet</p>
             </div>

             {/* Result */}
             <div className="bg-indigo-600/20 rounded-xl p-4 border border-indigo-500/50 flex flex-col items-center justify-center text-center">
                 <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1">Max Packet Capacity</p>
                 <div className="flex items-baseline gap-1">
                     <span className="text-4xl font-bold text-white">{maxPackets}</span>
                     <span className="text-sm font-medium text-indigo-300">Packets</span>
                 </div>
                 <p className="text-[10px] text-indigo-300/60 mt-1">Theoretical Maximum</p>
             </div>
         </div>
      </section>

      {/* Category Configuration */}
      <section className="mb-8">
          <button 
            onClick={() => setIsCategoryConfigOpen(!isCategoryConfigOpen)}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 hover:text-slate-700 transition-colors"
          >
              <Settings size={16} /> Storage Categories {isCategoryConfigOpen ? '(Hide)' : '(Show)'}
          </button>
          
          {isCategoryConfigOpen && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-fade-in">
                  <p className="text-sm text-slate-600 mb-4">Select which categories are stored in the deep freezer. Only enabled categories will be used for capacity calculations.</p>
                  <div className="flex flex-wrap gap-3">
                      {Object.values(SKUCategory).map(cat => {
                          const isEnabled = enabledCategories.includes(cat);
                          return (
                              <button
                                key={cat}
                                onClick={() => toggleCategory(cat)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-bold transition-all ${isEnabled ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                              >
                                  {isEnabled ? <CheckSquare size={18} className="text-indigo-600"/> : <Square size={18} />}
                                  {cat}
                              </button>
                          )
                      })}
                  </div>
              </div>
          )}
      </section>

      {/* Order Recommendation Engine */}
      <section className="mb-8">
         <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 mb-4">
            <BarChart2 size={20} className="text-emerald-500" /> Smart Order Recommendation
         </h3>
         
         <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center text-sm">
                 <div className="flex gap-4">
                     <div>
                         <span className="text-slate-500">Current Stock: </span>
                         <span className="font-bold text-slate-800">{currentStockPackets} pkts</span>
                     </div>
                     <div>
                         <span className="text-slate-500">Available Space: </span>
                         <span className="font-bold text-emerald-600">{availablePackets} pkts</span>
                     </div>
                 </div>
                 <div className="text-xs text-slate-400">Based on last 90 days sales</div>
             </div>

             {recommendedOrders.length === 0 ? (
                 <div className="p-8 text-center text-slate-400 italic">
                     {availablePackets <= 0 
                        ? "Fridge is full! No space to order more stock." 
                        : "No sales history found for enabled categories to generate recommendations."}
                 </div>
             ) : (
                 <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm">
                         <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                             <tr>
                                 <th className="p-4">Item Name</th>
                                 <th className="p-4 text-center">Current Stock</th>
                                 <th className="p-4 text-center">Sales Share</th>
                                 <th className="p-4 text-right">Recommended Order</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {recommendedOrders.map((rec, idx) => (
                                 <tr key={idx} className="hover:bg-slate-50">
                                     <td className="p-4 font-bold text-slate-700">{rec.sku.name}</td>
                                     <td className="p-4 text-center text-slate-500">{Math.round(rec.currentPkts)} pkts</td>
                                     <td className="p-4 text-center text-slate-500">{(rec.consumptionShare * 100).toFixed(1)}%</td>
                                     <td className="p-4 text-right">
                                         <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold text-xs border border-emerald-200">
                                             +{rec.recommendPkts} pkts
                                         </span>
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
             )}
         </div>
      </section>

      {/* Storage Configuration Section */}
      <section>
         <div className="flex justify-between items-center mb-4">
            <div>
               <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                  <Box size={20} className="text-slate-400" /> Base Storage Configuration
               </h3>
               <p className="text-xs text-slate-500">Define the capacity of your base deep freezers.</p>
            </div>
            <button 
               onClick={handleAddNew}
               className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
            >
               <Plus size={16} /> Add Deep Freezer
            </button>
         </div>

         {storageUnits.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-10 text-center flex flex-col items-center">
               <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-300 mb-4">
                  <Snowflake size={32} />
               </div>
               <h4 className="text-lg font-bold text-slate-600">No Freezers Configured</h4>
               <p className="text-slate-400 max-w-xs mx-auto mb-6">Add your base deep freezers and their capacity to start calculating stock requirements.</p>
               <button onClick={handleAddNew} className="text-indigo-600 font-bold hover:underline">Add your first freezer</button>
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {storageUnits.map(unit => (
                  <div key={unit.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative">
                     <div className="flex items-start justify-between mb-2">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                           <Snowflake size={24} />
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => handleEdit(unit)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg"><Edit2 size={16}/></button>
                           <button onClick={() => handleDelete(unit.id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={16}/></button>
                        </div>
                     </div>
                     <h4 className="font-bold text-slate-800 text-lg mb-1">{unit.name}</h4>
                     <p className="text-sm text-slate-500 font-medium">Capacity: <span className="font-bold text-slate-700">{unit.capacityLitres} Litres</span></p>
                     
                     <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Type</span>
                        <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">DEEP FREEZER</span>
                     </div>
                  </div>
               ))}
            </div>
         )}
      </section>

      {/* Add/Edit Modal */}
      {isModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
               <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-800">{editingUnit.id ? 'Edit Freezer' : 'Add New Freezer'}</h3>
                  <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
               </div>
               <form onSubmit={handleSubmit} className="p-5 space-y-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Freezer Name</label>
                     <input 
                        type="text"
                        required
                        autoFocus
                        value={editingUnit.name || ''}
                        onChange={(e) => setEditingUnit({...editingUnit, name: e.target.value})}
                        className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                        placeholder="e.g. Base Chest Freezer 1"
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Capacity (Litres)</label>
                     <input 
                        type="number"
                        required
                        min="1"
                        value={editingUnit.capacityLitres || ''}
                        onChange={(e) => setEditingUnit({...editingUnit, capacityLitres: parseInt(e.target.value)})}
                        className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                        placeholder="e.g. 300"
                     />
                  </div>
                  
                  <button 
                     type="submit"
                     className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 mt-2"
                  >
                     Save Configuration
                  </button>
               </form>
            </div>
         </div>
      )}
    </div>
  );
};

export default StockOrdering;
