
import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { SalesPlatform, TransactionType, SKU } from '../types';
import { parseSalesReportImage } from '../services/geminiService';
import { getLocalISOString } from '../constants';
import { 
  Scale, Camera, Loader2, Info, ShoppingCart, FileText, 
  AlertCircle, Calendar, CalendarDays, ChevronRight, 
  TrendingDown, TrendingUp, CheckCircle2, AlertTriangle, ArrowRight 
} from 'lucide-react';

const Reconciliation: React.FC = () => {
  const { branches, skus, salesRecords, addSalesRecords, deleteSalesRecordsForDate, transactions, orders, menuItems } = useStore();
  
  // --- Date Range State ---
  const today = getLocalISOString();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const [startDate, setStartDate] = useState<string>(getLocalISOString(thirtyDaysAgo));
  const [endDate, setEndDate] = useState<string>(today);
  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
  const [activePlatform, setActivePlatform] = useState<SalesPlatform>('POS');
  
  // Input State for Manual Entry (Uses endDate for saving)
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick Date Presets
  const setPreset = (days: number) => {
      const start = new Date();
      if (days > 0) {
          start.setDate(start.getDate() - (days - 1));
      }
      setStartDate(getLocalISOString(start));
      setEndDate(today);
  };

  // --- Aggregated Calculations for Variance ---
  const varianceData = useMemo(() => {
    const physicalUsage: Record<string, number> = {};
    const soldInternal: Record<string, number> = {};
    const soldExternal: Record<string, number> = {};

    // 1. Filter Physical Usage for Range
    transactions.filter(t => t.date >= startDate && t.date <= endDate && t.branchId === branchId).forEach(t => {
      if (t.type === TransactionType.CHECK_OUT) {
        physicalUsage[t.skuId] = (physicalUsage[t.skuId] || 0) + t.quantityPieces;
      } else if (t.type === TransactionType.CHECK_IN) {
        physicalUsage[t.skuId] = (physicalUsage[t.skuId] || 0) - t.quantityPieces;
      } else if (t.type === TransactionType.WASTE) {
        physicalUsage[t.skuId] = (physicalUsage[t.skuId] || 0) - t.quantityPieces;
      }
    });

    // 2. Filter Internal Orders for Range
    orders.filter(o => o.date >= startDate && o.date <= endDate && o.branchId === branchId).forEach(o => {
      o.items.forEach(item => {
        const menu = menuItems.find(m => m.id === item.menuItemId);
        if (menu) {
           let ings = menu.ingredients || [];
           if (item.variant === 'HALF') {
               ings = (menu.halfIngredients && menu.halfIngredients.length > 0) 
                 ? menu.halfIngredients 
                 : menu.ingredients.map(i => ({ ...i, quantity: i.quantity * 0.5 }));
           }
           ings.forEach(ing => {
             soldInternal[ing.skuId] = (soldInternal[ing.skuId] || 0) + (ing.quantity * item.quantity);
           });
        }
      });
      if (o.customSkuItems) {
        o.customSkuItems.forEach(cs => {
          soldInternal[cs.skuId] = (soldInternal[cs.skuId] || 0) + cs.quantity;
        });
      }
    });

    // 3. Filter External Sales Records for Range
    salesRecords.filter(r => r.date >= startDate && r.date <= endDate && r.branchId === branchId).forEach(r => {
      soldExternal[r.skuId] = (soldExternal[r.skuId] || 0) + r.quantitySold;
    });

    return skus.map(sku => {
      const used = physicalUsage[sku.id] || 0;
      const si = soldInternal[sku.id] || 0;
      const se = soldExternal[sku.id] || 0;
      const totalSold = si + se;
      const diff = totalSold - used;
      
      return {
        sku,
        used,
        soldInternal: si,
        soldExternal: se,
        totalSold,
        diff
      };
    });
  }, [transactions, salesRecords, orders, menuItems, startDate, endDate, branchId, skus]);

  // Derived Stats
  const totals = useMemo(() => {
      const sold = varianceData.reduce((acc, curr) => acc + curr.totalSold, 0);
      const used = varianceData.reduce((acc, curr) => acc + curr.used, 0);
      const diff = sold - used;
      const variancePercent = used > 0 ? (diff / used) * 100 : 0;
      return { sold, used, diff, variancePercent };
  }, [varianceData]);

  // Handle Image Upload & AI Parsing
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result;
        if (typeof result === 'string') {
            try {
              const parsedData = await parseSalesReportImage(result, skus);
              // Added explicit type to prev to avoid 'unknown' inference error during async execution
              setInputs((prev: Record<string, string>) => {
                const newInputs: Record<string, string> = { ...prev };
                Object.entries(parsedData).forEach(([skuId, qty]) => {
                    const quantity = Number(qty);
                    // Explicitly safe access for Record indexing
                    const currentVal: string = newInputs[skuId] || '0';
                    const current = parseInt(currentVal);
                    if (!isNaN(quantity)) {
                        newInputs[skuId] = (current + quantity).toString();
                    }
                });
                return newInputs;
              });
              setSuccessMsg('Report analyzed! Review and save below.');
            } catch (err) {
              alert("Failed to analyze image.");
            } finally {
              setIsProcessing(false);
            }
        } else {
             setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsProcessing(false);
    }
  };

  const handleSave = () => {
    // For saving, we use the END DATE as the reference for where to attach these manual entries
    deleteSalesRecordsForDate(endDate, branchId, activePlatform);

    const recordsToSave: any[] = [];
    Object.entries(inputs).forEach(([skuId, val]) => {
      const qty = parseInt(val);
      if (qty > 0) {
        recordsToSave.push({
          date: endDate,
          branchId,
          platform: activePlatform,
          skuId,
          quantitySold: qty
        });
      }
    });

    if (recordsToSave.length > 0) {
      addSalesRecords(recordsToSave);
      setSuccessMsg(`Saved entry to ${endDate}.`);
      setInputs({});
    }
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const getExistingSalesCount = (platform: SalesPlatform) => {
     // Check if ANY sales records exist in the current range for a platform indicator
     return salesRecords
       .filter(r => r.date >= startDate && r.date <= endDate && r.branchId === branchId && r.platform === platform)
       .reduce((acc, curr) => acc + curr.quantitySold, 0);
  };

  return (
    <div className="pb-16 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Scale className="text-indigo-600" /> Sales Reconciliation
          </h2>
          <p className="text-slate-500">Comparing usage vs billing across the selected period.</p>
        </div>
        
        {/* Quick Range Selector */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
           <button onClick={() => setPreset(1)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${startDate === today && endDate === today ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Today</button>
           <button onClick={() => setPreset(7)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${startDate !== today && (new Date(endDate).getTime() - new Date(startDate).getTime() < 8 * 24 * 60 * 60 * 1000) && (new Date(endDate).getTime() - new Date(startDate).getTime() > 1 * 24 * 60 * 60 * 1000) ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Last 7 Days</button>
           <button onClick={() => setPreset(30)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${startDate !== today && (new Date(endDate).getTime() - new Date(startDate).getTime() > 25 * 24 * 60 * 60 * 1000) ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Last 30 Days</button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Items Used</p>
             <h4 className="text-2xl font-mono font-bold text-slate-800">{Math.round(totals.used)}</h4>
             <p className="text-[10px] text-slate-400 mt-1">Physical inventory movement</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Items Billed</p>
             <h4 className="text-2xl font-mono font-bold text-indigo-600">{Math.round(totals.sold)}</h4>
             <p className="text-[10px] text-slate-400 mt-1">Sum of POS + Manual Entry</p>
          </div>
          <div className={`p-5 rounded-xl border shadow-sm ${totals.diff < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
             <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${totals.diff < 0 ? 'text-red-500' : 'text-emerald-500'}`}>Net Variance</p>
             <div className="flex items-center gap-2">
                {totals.diff < 0 ? <TrendingDown size={20} className="text-red-500"/> : <TrendingUp size={20} className="text-emerald-500"/>}
                <h4 className={`text-2xl font-mono font-bold ${totals.diff < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {totals.diff > 0 ? '+' : ''}{Math.round(totals.diff)}
                </h4>
             </div>
             <p className="text-[10px] text-slate-400 mt-1">Missing or excess pieces</p>
          </div>
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg text-white">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Loss Rate</p>
             <h4 className={`text-2xl font-mono font-bold ${totals.variancePercent < -2 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {totals.variancePercent.toFixed(1)}%
             </h4>
             <p className="text-[10px] text-slate-500 mt-1">Target: Less than -2%</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left: Context & Sync */}
         <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
               <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Calendar size={16} className="text-indigo-500"/> Range Settings
               </h3>
               <div className="space-y-4">
                  <div>
                     <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Store Branch</label>
                     <select 
                       value={branchId}
                       onChange={(e) => setBranchId(e.target.value)}
                       className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                     >
                       {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                     </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                      <div>
                         <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Start Date</label>
                         <input 
                           type="date"
                           value={startDate}
                           onChange={(e) => setStartDate(e.target.value)}
                           className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                         />
                      </div>
                      <div>
                         <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">End Date</label>
                         <input 
                           type="date"
                           value={endDate}
                           onChange={(e) => setEndDate(e.target.value)}
                           className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                         />
                      </div>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 text-sm">Sync Online Sales</h3>
                    <div className="bg-indigo-100 px-2 py-0.5 rounded text-[10px] font-bold text-indigo-700 border border-indigo-200 uppercase">Manual Entry</div>
                </div>
                
                <div className="p-4 space-y-4">
                    <p className="text-[11px] text-slate-400 leading-relaxed italic">
                        Select a platform to manually enter sales for <strong>{endDate}</strong>.
                    </p>
                    
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {(['POS', 'ZOMATO', 'SWIGGY'] as SalesPlatform[]).map(p => {
                        const hasSales = getExistingSalesCount(p) > 0;
                        return (
                            <button
                            key={p}
                            onClick={() => { setActivePlatform(p); setInputs({}); setSuccessMsg(''); }}
                            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all relative ${
                                activePlatform === p 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-slate-500 hover:text-indigo-500'
                            }`}
                            >
                            {p}
                            {hasSales && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-white"></span>}
                            </button>
                        );
                        })}
                    </div>

                    <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                        <span className="text-xs font-bold text-indigo-800">Scan Statement</span>
                        <div>
                            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessing}
                                className="text-[10px] bg-white text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 transition-colors border border-indigo-200 shadow-sm"
                            >
                                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                                AI Sync
                            </button>
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {skus.map(sku => (
                            <div key={sku.id} className="flex justify-between items-center group">
                                <span className="text-[11px] text-slate-500 truncate mr-2">{sku.name}</span>
                                <div className="flex items-center gap-1">
                                    <input 
                                        type="number"
                                        placeholder="0"
                                        value={inputs[sku.id] || ''}
                                        onChange={(e) => setInputs(prev => ({ ...prev, [sku.id]: e.target.value }))}
                                        className="w-12 text-center border border-slate-200 rounded py-0.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                    <span className="text-[10px] text-slate-300">pcs</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={handleSave}
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg text-xs font-bold shadow-sm transition-colors mt-2"
                    >
                        Save for {endDate}
                    </button>
                    
                    {successMsg && <p className="text-center text-[11px] font-bold text-emerald-600 mt-2 animate-fade-in">{successMsg}</p>}
                </div>
            </div>
         </div>

         {/* Right: Variance Table */}
         <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-fit">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        Aggregated Variance Report
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{startDate}</span>
                        <ArrowRight size={10} className="text-slate-300" />
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{endDate}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] bg-white border border-slate-200 px-2 py-1 rounded font-bold text-slate-500">
                    <Info size={12} className="text-indigo-500" /> Multi-Day Audit
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-slate-400 bg-slate-50 uppercase font-bold sticky top-0 border-b border-slate-200">
                        <tr>
                            <th className="p-4 w-1/3">Product</th>
                            <th className="p-4 text-center">System Sales</th>
                            <th className="p-4 text-center">Platform Sales</th>
                            <th className="p-4 text-center bg-slate-100/30">Total Sold</th>
                            <th className="p-4 text-center">Total Used</th>
                            <th className="p-4 text-right">Variance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {varianceData.map(row => {
                            if (row.used === 0 && row.totalSold === 0) return null;
                            const isLoss = row.diff < 0; 
                            const isMatch = Math.abs(row.diff) < 0.01;

                            return (
                                <tr key={row.sku.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-700">{row.sku.name}</div>
                                        <div className="text-[10px] text-slate-400 uppercase tracking-tighter">{row.sku.category}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col">
                                            <span className={`font-mono text-xs ${row.soldInternal > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{Math.round(row.soldInternal)}</span>
                                            {row.soldInternal > 0 && <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">Internal</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col">
                                            <span className={`font-mono text-xs ${row.soldExternal > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{Math.round(row.soldExternal)}</span>
                                            {row.soldExternal > 0 && <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">External</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center bg-slate-50 font-bold text-slate-800 font-mono">
                                        {Math.round(row.totalSold)}
                                    </td>
                                    <td className="p-4 text-center text-slate-500 font-mono text-xs">
                                        {Math.round(row.used)}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs inline-block ${
                                                isMatch ? 'text-slate-300' : 
                                                isLoss ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                                            }`}>
                                                {row.diff > 0 ? '+' : ''}{Math.round(row.diff)}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {varianceData.every(r => r.used === 0 && r.totalSold === 0) && (
                            <tr>
                                <td colSpan={6} className="p-20 text-center text-slate-400">
                                    <AlertCircle size={40} className="mx-auto mb-4 opacity-10" />
                                    <p className="font-bold text-slate-400">No activity recorded for this period.</p>
                                    <p className="text-xs mt-1">Change the date range or select a different branch.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-start gap-4">
                <div className="p-2 bg-slate-800 rounded-lg text-amber-500">
                    <AlertTriangle size={18} />
                </div>
                <div className="text-[11px] text-slate-400 space-y-1">
                    <p className="text-slate-200 font-bold uppercase tracking-widest text-[9px]">Audit Information</p>
                    <p>• <strong>Variance</strong> represents the difference between pieces physically removed from storage and total pieces recorded as sold.</p>
                    <p>• Significant negative values indicate potential stock theft, waste not being recorded, or unbilled orders.</p>
                    <p>• Target Variance should always be within ±2% of total volume for healthy operations.</p>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Reconciliation;
