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
  
  const today = getLocalISOString();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const [startDate, setStartDate] = useState<string>(getLocalISOString(thirtyDaysAgo));
  const [endDate, setEndDate] = useState<string>(today);
  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
  const [activePlatform, setActivePlatform] = useState<SalesPlatform>('POS');
  
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const varianceData = useMemo(() => {
    const physicalUsage: Record<string, number> = {};
    const totalSold: Record<string, { qty: number, source: 'LOG' | 'RECIPE' | 'MIXED' }> = {};
    
    // 1. Calculate Physical Usage (Pre-filter for performance)
    const filteredTxs = transactions.filter(t => t.date >= startDate && t.date <= endDate && t.branchId === branchId);
    filteredTxs.forEach(t => {
      if (t.type === TransactionType.CHECK_OUT) {
        physicalUsage[t.skuId] = (physicalUsage[t.skuId] || 0) + t.quantityPieces;
      } else if (t.type === TransactionType.CHECK_IN || t.type === TransactionType.WASTE) {
        physicalUsage[t.skuId] = (physicalUsage[t.skuId] || 0) - t.quantityPieces;
      }
    });

    // 2. Pre-filter orders and records for efficiency
    const filteredOrders = orders.filter(o => 
        o.platform === 'POS' && 
        o.branchId === branchId && 
        o.date >= startDate && 
        o.date <= endDate
    );

    const filteredLogs = salesRecords.filter(r => 
        r.branchId === branchId && 
        r.date >= startDate && 
        r.date <= endDate
    );

    // 3. Process each SKU
    const platforms: SalesPlatform[] = ['POS', 'ZOMATO', 'SWIGGY'];
    
    skus.forEach(sku => {
        let skuPlatformSum = 0;
        let sources: Set<'LOG' | 'RECIPE'> = new Set();

        platforms.forEach(p => {
            // Priority #1: Check direct logs in sales_records
            const logs = filteredLogs.filter(r => r.platform === p && r.skuId === sku.id);
            if (logs.length > 0) {
                skuPlatformSum += logs.reduce((sum, r) => sum + r.quantitySold, 0);
                sources.add('LOG');
            } else if (p === 'POS') {
                // Priority #2: For POS, check for 'consumed' data INSIDE the orders
                let totalConsumedFromOrders = 0;
                let foundDirectConsumedData = false;

                filteredOrders.forEach(o => {
                    o.items.forEach(item => {
                        if (item.consumed) {
                            foundDirectConsumedData = true;
                            if (Array.isArray(item.consumed)) {
                                const match = item.consumed.find(c => c.skuId === sku.id);
                                if (match) totalConsumedFromOrders += match.quantity;
                            } else {
                                const consumedObj = item.consumed as { skuId: string; quantity: number };
                                if (consumedObj.skuId === sku.id) totalConsumedFromOrders += consumedObj.quantity;
                            }
                        } else {
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

                    const customMatch = o.customSkuItems?.find(cs => cs.skuId === sku.id);
                    if (customMatch) {
                        totalConsumedFromOrders += customMatch.quantity;
                        foundDirectConsumedData = true;
                    }
                });

                if (totalConsumedFromOrders > 0) {
                    skuPlatformSum += totalConsumedFromOrders;
                    sources.add(foundDirectConsumedData ? 'LOG' : 'RECIPE');
                }
            }
        });

        const finalSource = sources.size > 1 ? 'MIXED' : (sources.has('LOG') ? 'LOG' : 'RECIPE');
        totalSold[sku.id] = { qty: skuPlatformSum, source: finalSource };
    });

    return skus.map(sku => ({
      sku,
      used: physicalUsage[sku.id] || 0,
      totalSold: totalSold[sku.id]?.qty || 0,
      diff: (totalSold[sku.id]?.qty || 0) - (physicalUsage[sku.id] || 0),
      source: totalSold[sku.id]?.source || 'RECIPE'
    }));
  }, [transactions, salesRecords, orders, menuItems, startDate, endDate, branchId, skus]);

  const totals = useMemo(() => {
      const sold = varianceData.reduce((acc, curr) => acc + curr.totalSold, 0);
      const used = varianceData.reduce((acc, curr) => acc + curr.used, 0);
      const diff = sold - used;
      const variancePercent = used > 0 ? (diff / used) * 100 : 0;
      return { sold, used, diff, variancePercent };
  }, [varianceData]);

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
              setInputs((prev) => {
                const newInputs = { ...prev };
                Object.entries(parsedData).forEach(([skuId, qty]) => {
                    const quantity = Number(qty);
                    const current = parseInt(newInputs[skuId] || '0');
                    if (!isNaN(quantity)) newInputs[skuId] = (current + quantity).toString();
                });
                return newInputs;
              });
              setSuccessMsg('Report analyzed! Review and save below.');
            } catch (err) { alert("Analysis failed."); }
            finally { setIsProcessing(false); }
        }
      };
      reader.readAsDataURL(file);
    } catch (err) { setIsProcessing(false); }
  };

  const handleSave = () => {
    deleteSalesRecordsForDate(endDate, branchId, activePlatform);
    const recordsToSave = Object.entries(inputs).filter(([_, val]) => parseInt(val) > 0).map(([skuId, val]) => ({
      date: endDate, branchId, platform: activePlatform, skuId, quantitySold: parseInt(val)
    }));
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
          <p className="text-slate-500">Physical consumption vs billing data.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
           <button onClick={() => setPreset(1)} className={`px-4 py-2 rounded-lg text-xs font-bold ${startDate === today && endDate === today ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Today</button>
           <button onClick={() => setPreset(7)} className={`px-4 py-2 rounded-lg text-xs font-bold ${startDate !== today && (new Date(endDate).getTime() - new Date(startDate).getTime() < 8 * 24 * 60 * 60 * 1000) ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Last 7 Days</button>
           <button onClick={() => setPreset(30)} className={`px-4 py-2 rounded-lg text-xs font-bold ${startDate !== today && (new Date(endDate).getTime() - new Date(startDate).getTime() > 25 * 24 * 60 * 60 * 1000) ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Last 30 Days</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Physical Usage</p>
             <h4 className="text-2xl font-mono font-bold text-slate-800">{Math.round(totals.used)}</h4>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Billed Items</p>
             <h4 className="text-2xl font-mono font-bold text-indigo-600">{Math.round(totals.sold)}</h4>
          </div>
          <div className={`p-5 rounded-xl border shadow-sm ${totals.diff < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
             <p className={`text-[10px] font-bold uppercase mb-1 ${totals.diff < 0 ? 'text-red-500' : 'text-emerald-500'}`}>Variance</p>
             <div className="flex items-center gap-2">
                {totals.diff < 0 ? <TrendingDown size={20} className="text-red-500"/> : <TrendingUp size={20} className="text-emerald-500"/>}
                <h4 className={`text-2xl font-mono font-bold ${totals.diff < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {totals.diff > 0 ? '+' : ''}{Math.round(totals.diff)}
                </h4>
             </div>
          </div>
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg text-white">
             <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Accuracy</p>
             <h4 className={`text-2xl font-mono font-bold ${totals.variancePercent < -2 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {(100 - Math.abs(totals.variancePercent)).toFixed(1)}%
             </h4>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
               <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Calendar size={16} className="text-indigo-500"/> Filters</h3>
               <div className="space-y-4">
                  <div>
                     <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Branch</label>
                     <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50">
                       {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                     </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">From</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-lg px-2 py-2 text-xs"/></div>
                      <div><label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">To</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded-lg px-2 py-2 text-xs"/></div>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 text-sm">Sync Zomato/Swiggy</h3>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {(['POS', 'ZOMATO', 'SWIGGY'] as SalesPlatform[]).map(p => (
                            <button key={p} onClick={() => { setActivePlatform(p); setInputs({}); }} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold ${activePlatform === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{p}</button>
                        ))}
                    </div>
                    <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                        <span className="text-xs font-bold text-indigo-800">Scan Bill</span>
                        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
                        <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="text-[10px] bg-white text-indigo-700 px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5">
                            {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />} AI Sync
                        </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {skus.map(sku => (
                            <div key={sku.id} className="flex justify-between items-center"><span className="text-[11px] text-slate-500 truncate mr-2">{sku.name}</span><input type="number" placeholder="0" value={inputs[sku.id] || ''} onChange={(e) => setInputs(prev => ({ ...prev, [sku.id]: e.target.value }))} className="w-12 text-center border rounded py-0.5 text-xs"/></div>
                        ))}
                    </div>
                    <button onClick={handleSave} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg text-xs font-bold shadow-sm">Save Entry</button>
                    {successMsg && <p className="text-center text-[11px] font-bold text-emerald-600 mt-2">{successMsg}</p>}
                </div>
            </div>
         </div>

         <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-fit">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Variance Report</h3>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{startDate} to {endDate}</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-slate-400 bg-slate-50 uppercase font-bold sticky top-0 border-b">
                        <tr>
                            <th className="p-4 w-1/3">SKU</th>
                            <th className="p-4 text-center">Billed</th>
                            <th className="p-4 text-center">Physical</th>
                            <th className="p-4 text-right">Variance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {varianceData.filter(r => r.used !== 0 || r.totalSold !== 0).map(row => (
                            <tr key={row.sku.id} className="hover:bg-slate-50">
                                <td className="p-4">
                                    <div className="font-bold text-slate-700">{row.sku.name}</div>
                                    <div className="text-[10px] text-slate-400 uppercase">{row.sku.category}</div>
                                </td>
                                <td className="p-4 text-center">
                                    <span className="font-mono font-bold text-slate-800">{Math.round(row.totalSold)}</span>
                                    <div className="flex justify-center mt-0.5">
                                        {row.source === 'LOG' && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 rounded font-bold border border-emerald-200">APP</span>}
                                        {row.source === 'RECIPE' && <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded font-bold border border-blue-200">MATH</span>}
                                    </div>
                                </td>
                                <td className="p-4 text-center text-slate-500 font-mono">{Math.round(row.used)}</td>
                                <td className="p-4 text-right">
                                    <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs inline-block ${row.diff === 0 ? 'text-slate-300' : (row.diff < 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600')}`}>
                                        {row.diff > 0 ? '+' : ''}{Math.round(row.diff)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
         </div>
      </div>

      <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-xl p-6">
         <div className="flex items-start gap-4">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Code2 size={24}/></div>
            <div>
               <h3 className="font-bold text-white">Android Integration Spec</h3>
               <p className="text-xs text-slate-400 mt-1">To ensure 100% accuracy, the Android app sends piece counts inside the <code className="text-indigo-400">consumed</code> field of the order items. The dashboard prioritized this data over recipe math.</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Reconciliation;