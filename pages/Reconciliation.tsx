import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { SalesPlatform, TransactionType, SKU } from '../types';
import { parseSalesReportImage } from '../services/geminiService';
import { getLocalISOString } from '../constants';
import { 
  Scale, Camera, Loader2, Info, ShoppingCart, FileText, 
  AlertCircle, Calendar, CalendarDays, ChevronRight, 
  TrendingDown, TrendingUp, CheckCircle2, AlertTriangle, ArrowRight, Code2, Database, Share2
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
  
  // Input State for Manual Entry
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick Date Presets
  const setPreset = (days: number) => {
      const start = new Date();
      if (days > 1) {
          start.setDate(start.getDate() - (days - 1));
          setStartDate(getLocalISOString(start));
      } else {
          setStartDate(today);
      }
      setEndDate(today);
  };

  // --- Aggregated Calculations for Variance ---
  const varianceData = useMemo(() => {
    const physicalUsage: Record<string, number> = {};
    const totalSold: Record<string, { qty: number, source: 'LOG' | 'RECIPE' | 'MIXED' }> = {};
    
    // 1. Calculate Physical Usage (Transactions Table)
    transactions.filter(t => t.date >= startDate && t.date <= endDate && t.branchId === branchId).forEach(t => {
      if (t.type === TransactionType.CHECK_OUT) {
        physicalUsage[t.skuId] = (physicalUsage[t.skuId] || 0) + t.quantityPieces;
      } else if (t.type === TransactionType.CHECK_IN) {
        physicalUsage[t.skuId] = (physicalUsage[t.skuId] || 0) - t.quantityPieces;
      } else if (t.type === TransactionType.WASTE) {
        physicalUsage[t.skuId] = (physicalUsage[t.skuId] || 0) - t.quantityPieces;
      }
    });

    // 2. Calculate Sold Pieces (The Logic Engine)
    const platforms: SalesPlatform[] = ['POS', 'ZOMATO', 'SWIGGY'];
    
    skus.forEach(sku => {
        let skuPlatformSum = 0;
        let sources: Set<'LOG' | 'RECIPE'> = new Set();

        platforms.forEach(p => {
            // Priority #1: Check if DIRECT LOGS exist in sales_records table
            const logs = salesRecords.filter(r => 
                r.platform === p && 
                r.skuId === sku.id && 
                r.branchId === branchId && 
                r.date >= startDate && 
                r.date <= endDate
            );

            if (logs.length > 0) {
                const logQty = logs.reduce((sum, r) => sum + r.quantitySold, 0);
                skuPlatformSum += logQty;
                sources.add('LOG');
            } else if (p === 'POS') {
                // Priority #2: For POS, check for 'consumed' data INSIDE the orders table
                let totalConsumedFromOrders = 0;
                let foundDirectConsumedData = false;

                const filteredOrders = orders.filter(o => 
                    o.platform === 'POS' && 
                    o.branchId === branchId && 
                    o.date >= startDate && 
                    o.date <= endDate
                );

                filteredOrders.forEach(o => {
                    // Check standard items
                    o.items.forEach(item => {
                        if (item.consumed) {
                            // Data exists inside the order item!
                            // This handles both the Android object format and the Web array format
                            foundDirectConsumedData = true;
                            if (Array.isArray(item.consumed)) {
                                const match = item.consumed.find(c => c.skuId === sku.id);
                                if (match) totalConsumedFromOrders += match.quantity;
                            } else if (item.consumed.skuId === sku.id) {
                                totalConsumedFromOrders += item.consumed.quantity;
                            }
                        } else {
                            // No direct consumption data, fallback to Recipe Lookup
                            const menu = menuItems.find(m => m.id === item.menuItemId);
                            if (menu) {
                                let ings = (item.variant === 'HALF' && menu.halfIngredients && menu.halfIngredients.length > 0)
                                    ? menu.halfIngredients
                                    : (item.variant === 'HALF' ? menu.ingredients.map(i => ({ ...i, quantity: i.quantity * 0.5 })) : menu.ingredients);
                                
                                const match = ings.find(i => i.skuId === sku.id);
                                if (match) totalConsumedFromOrders += (match.quantity * item.quantity);
                            }
                        }
                    });

                    // Also check custom raw items added to orders
                    const customMatch = o.customSkuItems?.find(cs => cs.skuId === sku.id);
                    if (customMatch) {
                        totalConsumedFromOrders += customMatch.quantity;
                        foundDirectConsumedData = true;
                    }
                });

                if (totalConsumedFromOrders > 0) {
                    skuPlatformSum += totalConsumedFromOrders;
                    // If we found direct "consumed" data inside the item object, mark it as LOG level accuracy
                    sources.add(foundDirectConsumedData ? 'LOG' : 'RECIPE');
                }
            }
        });

        const finalSource = sources.size > 1 ? 'MIXED' : (sources.has('LOG') ? 'LOG' : 'RECIPE');
        totalSold[sku.id] = { qty: skuPlatformSum, source: finalSource };
    });

    return skus.map(sku => {
      const used = physicalUsage[sku.id] || 0;
      const sold = totalSold[sku.id]?.qty || 0;
      const source = totalSold[sku.id]?.source || 'RECIPE';
      const diff = sold - used;
      
      return { sku, used, totalSold: sold, diff, source };
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
        const result = (event.target as FileReader).result;
        if (typeof result === 'string') {
            try {
              const parsedData = await parseSalesReportImage(result, skus);
              setInputs((prev: Record<string, string>) => {
                const newInputs: Record<string, string> = { ...prev };
                Object.entries(parsedData).forEach(([skuId, qty]) => {
                    const quantity = Number(qty);
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
      setSuccessMsg(`Saved to ${endDate}.`);
      setInputs({});
    }
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="pb-16 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Scale className="text-indigo-600" /> Sales Reconciliation
          </h2>
          <p className="text-slate-500">Comparing physical consumption vs recorded sales data.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
           <button onClick={() => setPreset(1)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${startDate === today && endDate === today ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Today</button>
           <button onClick={() => setPreset(7)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${startDate !== today && (new Date(endDate).getTime() - new Date(startDate).getTime() < 8 * 24 * 60 * 60 * 1000) && (new Date(endDate).getTime() - new Date(startDate).getTime() > 1 * 24 * 60 * 60 * 1000) ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Last 7 Days</button>
           <button onClick={() => setPreset(30)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${startDate !== today && (new Date(endDate).getTime() - new Date(startDate).getTime() > 25 * 24 * 60 * 60 * 1000) ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Last 30 Days</button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Items Used (Physical)</p>
             <h4 className="text-2xl font-mono font-bold text-slate-800">{Math.round(totals.used)}</h4>
             <p className="text-[10px] text-slate-400 mt-1">From Operations: Check-out - returns</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Items Sold (Billing)</p>
             <h4 className="text-2xl font-mono font-bold text-indigo-600">{Math.round(totals.sold)}</h4>
             <p className="text-[10px] text-slate-400 mt-1">From Direct App Data & Recipes</p>
          </div>
          <div className={`p-5 rounded-xl border shadow-sm ${totals.diff < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
             <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${totals.diff < 0 ? 'text-red-500' : 'text-emerald-500'}`}>Variance</p>
             <div className="flex items-center gap-2">
                {totals.diff < 0 ? <TrendingDown size={20} className="text-red-500"/> : <TrendingUp size={20} className="text-emerald-500"/>}
                <h4 className={`text-2xl font-mono font-bold ${totals.diff < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {totals.diff > 0 ? '+' : ''}{Math.round(totals.diff)}
                </h4>
             </div>
             <p className="text-[10px] text-slate-400 mt-1">Net stock difference</p>
          </div>
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg text-white">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Inventory Accuracy</p>
             <h4 className={`text-2xl font-mono font-bold ${totals.variancePercent < -2 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {(100 - Math.abs(totals.variancePercent)).toFixed(1)}%
             </h4>
             <p className="text-[10px] text-slate-500 mt-1">Target: > 98% Accuracy</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left: Settings */}
         <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
               <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Calendar size={16} className="text-indigo-500"/> Filter Period
               </h3>
               <div className="space-y-4">
                  <div>
                     <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Branch</label>
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
                         <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">From</label>
                         <input 
                           type="date"
                           value={startDate}
                           onChange={(e) => setStartDate(e.target.value)}
                           className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                         />
                      </div>
                      <div>
                         <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">To</label>
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
                    <h3 className="font-bold text-slate-700 text-sm">Sync Third-Party Sales</h3>
                    <div className="bg-indigo-100 px-2 py-0.5 rounded text-[10px] font-bold text-indigo-700 border border-indigo-200 uppercase">Manual Entry</div>
                </div>
                
                <div className="p-4 space-y-4">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {(['POS', 'ZOMATO', 'SWIGGY'] as SalesPlatform[]).map(p => (
                            <button
                                key={p}
                                onClick={() => { setActivePlatform(p); setInputs({}); }}
                                className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${activePlatform === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                        <span className="text-xs font-bold text-indigo-800">Scan Bill/Screenshot</span>
                        <div>
                            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessing}
                                className="text-[10px] bg-white text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 border border-indigo-200 shadow-sm"
                            >
                                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                                AI Sync
                            </button>
                        </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
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

                    <button onClick={handleSave} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg text-xs font-bold shadow-sm transition-colors mt-2">
                        Save {activePlatform} Entry for {endDate}
                    </button>
                    {successMsg && <p className="text-center text-[11px] font-bold text-emerald-600 mt-2 animate-fade-in">{successMsg}</p>}
                </div>
            </div>
         </div>

         {/* Right: Variance Table */}
         <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-fit">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-slate-800">Variance Audit Report</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{startDate} to {endDate}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] bg-white border border-slate-200 px-2 py-1 rounded font-bold text-slate-500">
                    <Info size={12} className="text-indigo-500" /> Multi-Source Aggregation
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-slate-400 bg-slate-50 uppercase font-bold sticky top-0 border-b border-slate-200">
                        <tr>
                            <th className="p-4 w-1/3">SKU Details</th>
                            <th className="p-4 text-center">Billed (Total Sold)</th>
                            <th className="p-4 text-center">Physical (Total Used)</th>
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
                                        <div className="text-[10px] text-slate-400 uppercase">{row.sku.category}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="font-mono font-bold text-slate-800">{Math.round(row.totalSold)}</span>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                {row.source === 'LOG' && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 rounded font-bold uppercase border border-emerald-200">Direct App Data</span>}
                                                {row.source === 'RECIPE' && <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded font-bold uppercase border border-blue-200">Recipe Math</span>}
                                                {row.source === 'MIXED' && <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded font-bold uppercase border border-amber-200">Hybrid</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center text-slate-500 font-mono">
                                        {Math.round(row.used)}
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs inline-block ${
                                            isMatch ? 'text-slate-300' : 
                                            isLoss ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                                        }`}>
                                            {row.diff > 0 ? '+' : ''}{Math.round(row.diff)}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
         </div>
      </div>

      {/* Developer Integration Section */}
      <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-xl">
         <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                  <Code2 size={20}/>
               </div>
               <div>
                  <h3 className="font-bold text-white">Android POS Integration Guide</h3>
                  <p className="text-xs text-slate-400">Technical specs for synchronizing direct SKU consumption logs.</p>
               </div>
            </div>
            <button className="text-xs text-indigo-400 font-bold hover:text-indigo-300 flex items-center gap-1">
               <Share2 size={12}/> Share with Dev
            </button>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5">
            <div className="p-6 space-y-4">
               <div className="flex items-start gap-3">
                  <Database size={16} className="text-indigo-400 mt-1"/>
                  <div>
                     <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Target Table: sales_records</h4>
                     <p className="text-xs text-slate-400 leading-relaxed">
                        To bypass web-side recipe calculations and ensure accuracy, the Android app should insert raw pieces directly into this table.
                     </p>
                  </div>
               </div>
               
               <div className="bg-black/40 p-4 rounded-lg font-mono text-[10px] text-indigo-300 overflow-x-auto">
                  <pre>{`// Expected Row Format:
{
  "platform": "POS",
  "sku_id": "sku-veg-steam", // Use internal SKU IDs
  "quantity_sold": 10,        // Raw pieces used
  "branch_id": "branch-1",
  "date": "2024-03-25",      // YYYY-MM-DD
  "timestamp": 1711382400000 
}`}</pre>
               </div>
            </div>

            <div className="p-6 space-y-4 border-l border-white/5">
               <div className="flex items-start gap-3">
                  <AlertCircle size={16} className="text-amber-400 mt-1"/>
                  <div>
                     <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">How Logic Merges</h4>
                     <p className="text-xs text-slate-400 leading-relaxed">
                        If the system finds <strong>any</strong> rows in <code className="text-indigo-300">sales_records</code> for a specific platform, it ignores the <code className="text-indigo-300">orders</code> table (Recipe Math) for that platform to prevent double-counting.
                     </p>
                  </div>
               </div>
               
               <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase">Source Priorities</div>
                  <div className="flex items-center justify-between text-xs p-2 bg-white/5 rounded">
                     <span className="text-slate-400">Direct Consumption</span>
                     <span className="text-emerald-400 font-bold">Priority #1</span>
                  </div>
                  <div className="flex items-center justify-between text-xs p-2 bg-white/5 rounded opacity-50">
                     <span className="text-slate-400">Recipe Math (Orders)</span>
                     <span className="text-blue-400 font-bold italic">Fallback</span>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Reconciliation;