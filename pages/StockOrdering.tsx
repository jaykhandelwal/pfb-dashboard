
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Truck, Plus, Trash2, Edit2, Snowflake, X, Box, Calculator, Cuboid, Settings, BarChart2, Calendar, ArrowRight, ClipboardCopy, CheckCircle2, AlertCircle, IndianRupee, Info } from 'lucide-react';
import { StorageUnit, TransactionType, SKUCategory, SKU } from '../types';
import { getLocalISOString } from '../constants';

const StockOrdering: React.FC = () => {
  const { storageUnits, addStorageUnit, updateStorageUnit, deleteStorageUnit, appSettings, updateAppSetting, skus, transactions } = useStore();
  
  // Local State for Calculation - initialized from AppSettings or default 2.3
  const [litresPerPacket, setLitresPerPacket] = useState<string>(
      appSettings.stock_ordering_litres_per_packet?.toString() || '2.3'
  ); 
  
  // Sync state if appSettings updates externally (e.g. initial load)
  useEffect(() => {
      if (appSettings.stock_ordering_litres_per_packet && appSettings.stock_ordering_litres_per_packet.toString() !== litresPerPacket) {
          setLitresPerPacket(appSettings.stock_ordering_litres_per_packet.toString());
      }
  }, [appSettings.stock_ordering_litres_per_packet]);

  // Save to AppSettings on change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value;
      setLitresPerPacket(newVal);
  };

  const saveVolumeSetting = () => {
      if (litresPerPacket) {
          updateAppSetting('stock_ordering_litres_per_packet', litresPerPacket);
      }
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Partial<StorageUnit>>({});

  // Generator State
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [arrivalDate, setArrivalDate] = useState<string>('');
  const [generatedOrder, setGeneratedOrder] = useState<any[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);

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

  // --- Volume Logic Helper (SIMPLIFIED) ---
  // Returns estimated Litres for a single packet of a specific SKU
  const getVolumePerPacket = (sku: SKU): number => {
      // 1. Chutney / Consumables Exception
      // Assumes Chutney/Sauce packets are ~1 Litre
      if (sku.category === SKUCategory.CONSUMABLES) {
          return 1.0; 
      }
      
      // 2. Global Average for Everything Else
      // Default: 2.3L per bag
      return parseFloat(litresPerPacket) || 2.3;
  };

  // --- Calculations ---

  // 1. Total Litres Capacity
  const totalCapacityLitres = useMemo(() => {
      return storageUnits.reduce((acc, unit) => acc + (unit.isActive ? unit.capacityLitres : 0), 0);
  }, [storageUnits]);

  // 2. Current Stock & Consumption Logic
  const { currentStockLitres, recommendedOrders, availableLitres, stockMapPackets } = useMemo(() => {
      // A. Calculate Current Stock (Only for Enabled SKUs)
      const relevantSkus = skus.filter(s => s.isDeepFreezerItem);
      
      const skuSizeMap: Record<string, number> = {};
      relevantSkus.forEach(s => skuSizeMap[s.id] = (s.piecesPerPacket > 0 ? s.piecesPerPacket : 1));

      const sMapPkts: Record<string, number> = {}; // SKU ID -> Packet Count
      
      // Calculate Stock Levels locally (Pieces)
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

      let usedLitres = 0;
      Object.keys(levels).forEach(skuId => {
          const sku = relevantSkus.find(s => s.id === skuId);
          if (!sku) return;

          const pktSize = skuSizeMap[skuId] || 1;
          const pkts = Math.max(0, levels[skuId]) / pktSize; // Fractional packets count towards volume
          
          sMapPkts[skuId] = pkts;
          
          // VOLUME CALCULATION
          const volPerPkt = getVolumePerPacket(sku);
          usedLitres += (pkts * volPerPkt);
      });

      const availableL = Math.max(0, totalCapacityLitres - usedLitres);

      // B. Calculate 90-Day Consumption (In LITRES)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      const cutoffStr = cutoffDate.toISOString().slice(0, 10);

      const consumptionLitresMap: Record<string, number> = {}; 
      let totalLitresConsumed = 0;

      transactions.forEach(t => {
          if (t.date >= cutoffStr && sMapPkts[t.skuId] !== undefined) {
              const sku = relevantSkus.find(s => s.id === t.skuId);
              if (!sku) return;

              const pktSize = skuSizeMap[t.skuId] || 1;
              const packets = t.quantityPieces / pktSize;
              const volPerPkt = getVolumePerPacket(sku);
              const litres = packets * volPerPkt;

              if (t.type === TransactionType.CHECK_OUT || (t.type === TransactionType.WASTE && t.branchId === 'FRIDGE')) {
                  consumptionLitresMap[t.skuId] = (consumptionLitresMap[t.skuId] || 0) + litres;
                  totalLitresConsumed += litres;
              } else if (t.type === TransactionType.CHECK_IN) {
                  consumptionLitresMap[t.skuId] = (consumptionLitresMap[t.skuId] || 0) - litres;
                  totalLitresConsumed -= litres;
              }
          }
      });

      totalLitresConsumed = Math.max(0, totalLitresConsumed);

      // C. Generate Recommendations (Fill based on Volume Share)
      const recommendations: { sku: any, currentPkts: number, consumptionShare: number, recommendPkts: number }[] = [];
      
      relevantSkus.forEach(sku => {
          const consumedL = Math.max(0, consumptionLitresMap[sku.id] || 0);
          let share = 0;
          let recommendedPkts = 0;

          if (totalLitresConsumed > 0) {
              share = consumedL / totalLitresConsumed; // % of total VOLUME consumed
              
              if (availableL > 0) {
                  // Litres to add for this SKU
                  const litresToAdd = availableL * share;
                  // Convert Litres back to Packets (FLOOR to be safe)
                  const volPerPkt = getVolumePerPacket(sku);
                  recommendedPkts = Math.floor(litresToAdd / volPerPkt);
              }
          }
          
          recommendations.push({
              sku,
              currentPkts: sMapPkts[sku.id] || 0,
              consumptionShare: share,
              recommendPkts: recommendedPkts
          });
      });

      return { 
          currentStockLitres: Math.ceil(usedLitres), 
          availableLitres: Math.floor(availableL),
          recommendedOrders: recommendations.sort((a,b) => b.recommendPkts - a.recommendPkts),
          stockMapPackets: sMapPkts
      };

  }, [skus, transactions, totalCapacityLitres, litresPerPacket]);

  // --- SMART GENERATOR LOGIC (Physical Constraint Aware) ---
  const handleGenerateOrder = () => {
      if (!arrivalDate) {
          alert("Please select an expected arrival date.");
          return;
      }

      // 1. Lead Time
      const today = new Date();
      today.setHours(0,0,0,0);
      const arrival = new Date(arrivalDate);
      arrival.setHours(0,0,0,0);
      
      const diffTime = arrival.getTime() - today.getTime();
      const daysUntilArrival = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (daysUntilArrival < 0) {
          alert("Arrival date cannot be in the past.");
          return;
      }

      // 2. Velocity (LITRES per Day) - Last 7 Days
      const d7 = new Date();
      d7.setDate(d7.getDate() - 7);
      const d7Str = d7.toISOString().slice(0,10);

      const velocityLitresMap: Record<string, number> = {}; 
      let totalWeeklyLitresVolume = 0;

      const relevantSkus = skus.filter(s => s.isDeepFreezerItem);
      const skuSizeMap: Record<string, number> = {};
      relevantSkus.forEach(s => skuSizeMap[s.id] = (s.piecesPerPacket > 0 ? s.piecesPerPacket : 1));

      relevantSkus.forEach(s => velocityLitresMap[s.id] = 0);

      transactions.forEach(t => {
          if (t.date >= d7Str && velocityLitresMap[t.skuId] !== undefined) {
              const sku = relevantSkus.find(s => s.id === t.skuId);
              if(!sku) return;

              const pktSize = skuSizeMap[t.skuId] || 1;
              const packets = t.quantityPieces / pktSize;
              const volPerPkt = getVolumePerPacket(sku);
              const litres = packets * volPerPkt;

              if (t.type === TransactionType.CHECK_OUT || (t.type === TransactionType.WASTE && t.branchId === 'FRIDGE')) {
                  velocityLitresMap[t.skuId] += litres;
                  totalWeeklyLitresVolume += litres;
              } else if (t.type === TransactionType.CHECK_IN) {
                  velocityLitresMap[t.skuId] -= litres;
                  totalWeeklyLitresVolume -= litres;
              }
          }
      });

      // 3. True Physical Availability Calculation
      const projectedStocks: Record<string, number> = {};
      let totalProjectedOccupiedLitres = 0;

      // First pass: Calculate projected stock at arrival date for ALL items
      relevantSkus.forEach(sku => {
          const volPerPkt = getVolumePerPacket(sku);
          const weeklyLitres = Math.max(0, velocityLitresMap[sku.id] || 0);
          const dailyAvgLitres = weeklyLitres / 7;

          const currentPkts = stockMapPackets[sku.id] || 0;
          const currentLitres = currentPkts * volPerPkt;
          const projectedBurnLitres = dailyAvgLitres * daysUntilArrival;
          
          // Project Stock cannot be less than 0
          const projStock = Math.max(0, currentLitres - projectedBurnLitres);
          projectedStocks[sku.id] = projStock;
          
          totalProjectedOccupiedLitres += projStock;
      });

      // 4. Calculate True Free Space
      // This accounts for "Dead Space" occupied by slow-moving overstocked items
      let trueFreeLitres = Math.max(0, totalCapacityLitres - totalProjectedOccupiedLitres);

      const generated: any[] = [];

      // 5. Distribute Free Space based on Velocity Share
      // Only items with velocity get a share of the free space
      relevantSkus.forEach(sku => {
          const volPerPkt = getVolumePerPacket(sku);
          const weeklyLitres = Math.max(0, velocityLitresMap[sku.id] || 0);
          
          // Share of ACTIVE velocity (only items that move)
          const share = totalWeeklyLitresVolume > 0 ? weeklyLitres / totalWeeklyLitresVolume : 0;

          // Ideal addition is a share of the TRUE free space
          const litresToAdd = trueFreeLitres * share;
          
          // Convert to Packets (FLOOR to ensure we fit)
          const suggestPkts = Math.floor(litresToAdd / volPerPkt);

          // Meta data for display
          const dailyAvgLitres = weeklyLitres / 7;
          const projectedBurnLitres = dailyAvgLitres * daysUntilArrival;
          const currentPkts = stockMapPackets[sku.id] || 0;

          if (suggestPkts > 0 || currentPkts === 0) {
              generated.push({
                  sku,
                  dailyAvgPackets: (dailyAvgLitres / volPerPkt).toFixed(1),
                  daysUntil: daysUntilArrival,
                  projectedBurnPackets: Math.ceil(projectedBurnLitres / volPerPkt),
                  suggestPkts,
                  isOOS: currentPkts === 0,
                  volPerPkt
              });
          }
      });

      setGeneratedOrder(generated.sort((a,b) => b.suggestPkts - a.suggestPkts));
  };

  const copyOrderToClipboard = () => {
      const text = generatedOrder.map(i => `${i.sku.name}: ${i.suggestPkts} pkts`).join('\n');
      const header = `Order for ${new Date(arrivalDate).toDateString()}\n------------------\n`;
      navigator.clipboard.writeText(header + text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
  };

  const totalOrderValue = useMemo(() => {
      return generatedOrder.reduce((acc, item) => acc + (item.suggestPkts * (item.sku.costPrice || 0)), 0);
  }, [generatedOrder]);

  return (
    <div className="pb-24 max-w-5xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Truck className="text-indigo-600" size={28} /> Stock Ordering
            </h2>
            <p className="text-slate-500 mt-1">Average-volume based ordering system.</p>
        </div>
        <button 
            onClick={() => {
                setArrivalDate(getLocalISOString());
                setIsGeneratorOpen(true);
                setGeneratedOrder([]);
            }}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
            <BarChart2 size={18} /> Generate Smart Order
        </button>
      </div>

      {/* Capacity Calculation Dashboard */}
      <section className="mb-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl">
         <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-white/10 rounded-lg">
                <Calculator size={24} className="text-indigo-300" />
            </div>
            <div>
                <h3 className="text-lg font-bold">Capacity Calculator</h3>
                <p className="text-xs text-slate-400">Total volume available for stock.</p>
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
                    <Cuboid size={14} /> Standard Bag Volume
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
                    <span className="absolute right-4 top-4 text-xs text-slate-500 font-bold">L/pkt</span>
                 </div>
                 <div className="flex items-center justify-center gap-1 mt-2">
                    <Info size={10} className="text-indigo-300"/>
                    <p className="text-[10px] text-center text-slate-500">
                        Applies to all Momos. Consumables fixed at 1.0L.
                    </p>
                 </div>
             </div>

             {/* Result */}
             <div className="bg-indigo-600/20 rounded-xl p-4 border border-indigo-500/50 flex flex-col items-center justify-center text-center">
                 <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1">Usage Status</p>
                 <div className="flex items-baseline gap-1">
                     <span className="text-3xl font-bold text-white">{Math.round(totalCapacityLitres - availableLitres)}</span>
                     <span className="text-sm font-medium text-indigo-300">/ {totalCapacityLitres} L</span>
                 </div>
                 <p className="text-[10px] text-indigo-300/60 mt-1">
                    {Math.round((totalCapacityLitres - availableLitres) / totalCapacityLitres * 100)}% Full
                 </p>
             </div>
         </div>
      </section>

      {/* Order Recommendation Engine (Standard) */}
      <section className="mb-8">
         <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 mb-4">
            <Settings size={20} className="text-slate-400" /> Stock Analysis (90 Day Trend)
         </h3>
         
         <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center text-sm">
                 <div className="flex gap-4">
                     <div>
                         <span className="text-slate-500">Current Volume: </span>
                         <span className="font-bold text-slate-800">{currentStockLitres} L</span>
                     </div>
                     <div>
                         <span className="text-slate-500">Free Space: </span>
                         <span className="font-bold text-emerald-600">{availableLitres} L</span>
                     </div>
                 </div>
             </div>

             {recommendedOrders.length === 0 ? (
                 <div className="p-8 text-center text-slate-400 italic">
                     {availableLitres <= 0 
                        ? "Fridge is physically full (0 Litres available). No space to order." 
                        : "No items configured for deep freezer. Go to SKU Management to enable items."}
                 </div>
             ) : (
                 <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm">
                         <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                             <tr>
                                 <th className="p-4">Item Name</th>
                                 <th className="p-4 text-center">Current Stock</th>
                                 <th className="p-4 text-center">Volume Share</th>
                                 <th className="p-4 text-right">Recommended</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {recommendedOrders.map((rec, idx) => (
                                 <tr key={idx} className="hover:bg-slate-50">
                                     <td className="p-4">
                                         <div className="font-bold text-slate-700">{rec.sku.name}</div>
                                         <div className="text-[10px] text-slate-400">{getVolumePerPacket(rec.sku)} L / pkt</div>
                                     </td>
                                     <td className="p-4 text-center text-slate-500">{Math.round(rec.currentPkts)} pkts</td>
                                     <td className="p-4 text-center text-slate-500">{(rec.consumptionShare * 100).toFixed(1)}%</td>
                                     <td className="p-4 text-right">
                                         {rec.recommendPkts > 0 ? (
                                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold text-xs border border-emerald-200">
                                                +{rec.recommendPkts} pkts
                                            </span>
                                         ) : (
                                            <span className="text-slate-300 text-xs font-bold px-3">0 pkts</span>
                                         )}
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
             )}
         </div>
         <p className="text-xs text-slate-400 mt-2 italic px-1">
            * Logic: Consumables = 1L. All other items = {litresPerPacket}L.
         </p>
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

      {/* Add/Edit Freezer Modal */}
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

      {/* Generator Modal */}
      {isGeneratorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
                      <div>
                          <h3 className="font-bold text-indigo-900 flex items-center gap-2"><BarChart2 size={18}/> Smart Order Generator</h3>
                          <p className="text-xs text-indigo-700">Predictive logic based on 7-day velocity (Short Term Trend)</p>
                      </div>
                      <button onClick={() => setIsGeneratorOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                  </div>
                  
                  <div className="p-6 flex-1 overflow-y-auto">
                      <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
                          <div className="flex-1 w-full">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Expected Stock Arrival Date</label>
                              <div className="flex items-center border border-slate-300 rounded-xl px-3 py-2 bg-slate-50">
                                  <Calendar size={16} className="text-slate-400 mr-2"/>
                                  <input 
                                      type="date"
                                      value={arrivalDate}
                                      onChange={(e) => setArrivalDate(e.target.value)}
                                      className="bg-transparent w-full text-sm font-bold text-slate-700 outline-none"
                                  />
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1">
                                  Logic: Fills the <strong>True Available Space</strong> (Total Capacity - Projected Stock of ALL items). Does not over-order.
                              </p>
                          </div>
                          <button 
                              onClick={handleGenerateOrder}
                              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-colors w-full md:w-auto flex items-center justify-center gap-2"
                          >
                              Generate Suggestion <ArrowRight size={16} />
                          </button>
                      </div>

                      {generatedOrder.length > 0 ? (
                          <div className="space-y-4 animate-fade-in">
                              <div className="overflow-hidden border border-slate-200 rounded-xl">
                                  <table className="w-full text-left text-sm">
                                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                                          <tr>
                                              <th className="p-3">Item</th>
                                              <th className="p-3 text-center">Daily Burn (7d)</th>
                                              <th className="p-3 text-center">Proj. Stock (Arrival)</th>
                                              <th className="p-3 text-right bg-emerald-50 text-emerald-700">Order Qty</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                          {generatedOrder.map((item, idx) => (
                                              <tr key={idx} className="hover:bg-slate-50">
                                                  <td className="p-3 font-bold text-slate-700">
                                                      {item.sku.name}
                                                      <span className="block text-[9px] text-slate-400 font-normal">{item.volPerPkt}L / pkt</span>
                                                      {item.isOOS && (
                                                          <span className="ml-2 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase">OOS</span>
                                                      )}
                                                  </td>
                                                  <td className="p-3 text-center text-slate-500">{item.dailyAvgPackets} pkts</td>
                                                  <td className="p-3 text-center">
                                                      {item.projectedBurnPackets > 0 ? (
                                                          <span className="text-red-500 font-bold">-{item.projectedBurnPackets} used</span>
                                                      ) : (
                                                          <span className="text-slate-400">-</span>
                                                      )}
                                                  </td>
                                                  <td className="p-3 text-right bg-emerald-50/50">
                                                      <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-bold text-xs">
                                                          {item.suggestPkts} pkts
                                                      </span>
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                                  <div className="flex gap-6 items-center">
                                      <div>
                                          <span className="text-xs font-bold text-slate-500 uppercase">Total Order</span>
                                          <p className="text-xl font-bold text-slate-800">
                                              {generatedOrder.reduce((acc, i) => acc + i.suggestPkts, 0)} pkts
                                          </p>
                                      </div>
                                      <div className="h-8 w-px bg-slate-200"></div>
                                      <div>
                                          <span className="text-xs font-bold text-slate-500 uppercase">Est. Value</span>
                                          <p className="text-xl font-bold text-emerald-600 flex items-center gap-0.5">
                                              <IndianRupee size={16} />{totalOrderValue.toLocaleString()}
                                          </p>
                                      </div>
                                  </div>
                                  <button 
                                      onClick={copyOrderToClipboard}
                                      className="text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors border border-indigo-100"
                                  >
                                      {copySuccess ? <CheckCircle2 size={18}/> : <ClipboardCopy size={18}/>}
                                      {copySuccess ? 'Copied!' : 'Copy List'}
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                              <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
                              <p>Select a date and click Generate.</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default StockOrdering;
