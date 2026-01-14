
import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { SalesPlatform, TransactionType, SKU, MenuItem, OrderItem } from '../types';
import { parseSalesReportImage } from '../services/geminiService';
import { getLocalISOString } from '../constants';
import { 
  Scale, Camera, Loader2, Info, ShoppingCart, FileText, 
  AlertCircle, Calendar, ChevronRight, 
  TrendingDown, TrendingUp, Code2, Database, Share2, Utensils, Package, AlertTriangle, ListChecks, History
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

  const getSkuName = (id: string) => skus.find(s => s.id === id)?.name || id;

  // --- RECONCILIATION ENGINE (GROUPED BY SKU) ---
  const auditGroups = useMemo(() => {
    const results: Record<string, {
        sku: SKU,
        physicalNetUsed: number,    // Checkout - Return
        billedSold: number,         // From Orders
        reportedWaste: number,      // From branch-level Waste transactions
        menuItemsInvolved: Record<string, { name: string, qty: number, variant: string }>
    }> = {};

    // Initialize groups for all SKUs
    skus.forEach(sku => {
        results[sku.id] = {
            sku,
            physicalNetUsed: 0,
            billedSold: 0,
            reportedWaste: 0,
            menuItemsInvolved: {}
        };
    });

    // 1. PHYSICAL LOGIC (Transactions)
    const filteredTxs = transactions.filter(t => t.date >= startDate && t.date <= endDate && t.branchId === branchId);
    filteredTxs.forEach(t => {
        if (!results[t.skuId]) return;
        if (t.type === TransactionType.CHECK_OUT) {
            results[t.skuId].physicalNetUsed += t.quantityPieces;
        } else if (t.type === TransactionType.CHECK_IN) {
            results[t.skuId].physicalNetUsed -= t.quantityPieces;
        } else if (t.type === TransactionType.WASTE) {
            // This is "Accounted For" waste reported by staff
            results[t.skuId].reportedWaste += t.quantityPieces;
        }
    });

    // 2. BILLED LOGIC (Orders)
    const filteredOrders = orders.filter(o => o.branchId === branchId && o.date >= startDate && o.date <= endDate);
    filteredOrders.forEach(order => {
        order.items.forEach(item => {
            const menu = menuItems.find(m => m.id === item.menuItemId);
            if (!menu) return;

            // Determine ingredients used (Full vs Half)
            const ingredients = (item.variant === 'HALF' && menu.halfIngredients && menu.halfIngredients.length > 0)
                ? menu.halfIngredients
                : (item.variant === 'HALF' ? menu.ingredients.map(i => ({ ...i, quantity: i.quantity * 0.5 })) : menu.ingredients);

            ingredients.forEach(ing => {
                if (results[ing.skuId]) {
                    const piecesSold = ing.quantity * item.quantity;
                    results[ing.skuId].billedSold += piecesSold;
                    
                    // Track which menu item caused this consumption for the drill-down UI
                    const menuKey = `${item.menuItemId}-${item.variant || 'FULL'}`;
                    if (!results[ing.skuId].menuItemsInvolved[menuKey]) {
                        results[ing.skuId].menuItemsInvolved[menuKey] = { name: item.name, qty: 0, variant: item.variant || 'FULL' };
                    }
                    results[ing.skuId].menuItemsInvolved[menuKey].qty += item.quantity;
                }
            });
        });

        // Add custom raw SKU items added to orders
        order.customSkuItems?.forEach(cs => {
            if (results[cs.skuId]) {
                results[cs.skuId].billedSold += cs.quantity;
            }
        });
    });

    // Convert to sorted array (only items with activity)
    return Object.values(results)
        .filter(group => group.physicalNetUsed !== 0 || group.billedSold !== 0 || group.reportedWaste !== 0)
        .sort((a, b) => b.physicalNetUsed - a.physicalNetUsed);

  }, [transactions, orders, skus, menuItems, startDate, endDate, branchId]);

  const totals = useMemo(() => {
      const totalPhysical = auditGroups.reduce((acc, curr) => acc + curr.physicalNetUsed, 0);
      const totalAccounted = auditGroups.reduce((acc, curr) => acc + (curr.billedSold + curr.reportedWaste), 0);
      const diff = totalAccounted - totalPhysical;
      const accuracy = totalPhysical > 0 ? (totalAccounted / totalPhysical) * 100 : 100;
      return { totalPhysical, totalAccounted, diff, accuracy };
  }, [auditGroups]);

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
                const current = parseInt(newInputs[skuId] || '0');
                newInputs[skuId] = (current + Number(qty)).toString();
              });
              return newInputs;
            });
            setSuccessMsg('Report analyzed!');
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
      setSuccessMsg(`Saved manual entries for ${endDate}.`);
      setInputs({});
    }
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="pb-16 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Scale className="text-indigo-600" /> Sales Reconciliation
          </h2>
          <p className="text-slate-500">Net physical inventory usage vs. Billed items + Wastage.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm">
          <button onClick={() => setPreset(1)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${startDate === today && endDate === today ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Today</button>
          <button onClick={() => setPreset(7)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${startDate !== today && (new Date(endDate).getTime() - new Date(startDate).getTime() < 8 * 24 * 60 * 60 * 1000) ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Last 7 Days</button>
          <button onClick={() => setPreset(30)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${startDate !== today && (new Date(endDate).getTime() - new Date(startDate).getTime() > 25 * 24 * 60 * 60 * 1000) ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Last 30 Days</button>
        </div>
      </div>

      {/* High-Level Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Physical Pieces Used</p>
             <h4 className="text-2xl font-mono font-bold text-slate-800">{Math.round(totals.totalPhysical)}</h4>
             <p className="text-[9px] text-slate-400 mt-1">Total (CheckOut - Returns)</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Accounted Pieces</p>
             <h4 className="text-2xl font-mono font-bold text-indigo-600">{Math.round(totals.totalAccounted)}</h4>
             <p className="text-[9px] text-slate-400 mt-1">Total (Sales + Reported Waste)</p>
          </div>
          <div className={`p-5 rounded-2xl border shadow-sm ${totals.diff < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
             <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${totals.diff < 0 ? 'text-red-500' : 'text-emerald-500'}`}>Net Variance</p>
             <div className="flex items-center gap-2">
                {totals.diff < 0 ? <TrendingDown size={20} className="text-red-500"/> : <TrendingUp size={20} className="text-emerald-500"/>}
                <h4 className={`text-2xl font-mono font-bold ${totals.diff < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {totals.diff > 0 ? '+' : ''}{Math.round(totals.diff)}
                </h4>
             </div>
             <p className="text-[9px] text-slate-400 mt-1">Difference in raw pieces</p>
          </div>
          <div className="bg-slate-900 p-5 rounded-2xl shadow-lg text-white">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stock Accuracy</p>
             <h4 className={`text-2xl font-mono font-bold ${totals.accuracy < 98 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {totals.accuracy.toFixed(1)}%
             </h4>
             <p className="text-[9px] text-slate-500 mt-1">Target: > 98% Accuracy</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Filters Sidebar */}
         <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
               <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Calendar size={16} className="text-indigo-500"/> Report Parameters
               </h3>
               <div className="space-y-4">
                  <div>
                     <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Select Branch</label>
                     <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-slate-700 bg-slate-50">
                       {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                     </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">From Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-lg px-2 py-2 text-xs font-medium"/></div>
                      <div><label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">To Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded-lg px-2 py-2 text-xs font-medium"/></div>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 text-sm">External Platform Sync</h3>
                    <div className="bg-indigo-100 px-2 py-0.5 rounded text-[9px] font-bold text-indigo-700 uppercase">Zomato / Swiggy</div>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {(['POS', 'ZOMATO', 'SWIGGY'] as SalesPlatform[]).map(p => (
                            <button key={p} onClick={() => { setActivePlatform(p); setInputs({}); }} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${activePlatform === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{p}</button>
                        ))}
                    </div>
                    <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                        <span className="text-xs font-bold text-indigo-800">Scan Statement</span>
                        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
                        <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="text-[10px] bg-white text-indigo-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-sm border border-indigo-200 hover:bg-indigo-50 transition-colors">
                            {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />} AI Sync
                        </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {skus.map(sku => (
                            <div key={sku.id} className="flex justify-between items-center p-1 rounded hover:bg-slate-50">
                                <span className="text-[11px] text-slate-500 truncate mr-2">{sku.name}</span>
                                <div className="flex items-center gap-1">
                                    <input type="number" placeholder="0" value={inputs[sku.id] || ''} onChange={(e) => setInputs(prev => ({ ...prev, [sku.id]: e.target.value }))} className="w-12 text-center border rounded py-0.5 text-xs focus:ring-2 focus:ring-indigo-200 outline-none"/>
                                    <span className="text-[8px] text-slate-300 font-bold uppercase">pcs</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleSave} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95">Save {activePlatform} Totals</button>
                    {successMsg && <p className="text-center text-[11px] font-bold text-emerald-600 mt-2 animate-fade-in">{successMsg}</p>}
                </div>
            </div>
         </div>

         {/* Detailed Audit Table */}
         <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <ListChecks size={20}/>
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm">Detailed Inventory Audit (Grouped by SKU)</h3>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-slate-400 bg-slate-50 uppercase font-bold border-b">
                            <tr>
                                <th className="p-4">Raw Material / Menu Items</th>
                                <th className="p-4 text-center">Accounted (Billed+Waste)</th>
                                <th className="p-4 text-center">Physical (Net Provided)</th>
                                <th className="p-4 text-right">Missing Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {auditGroups.map(group => {
                                const accounted = group.billedSold + group.reportedWaste;
                                const diff = accounted - group.physicalNetUsed;
                                const isLoss = diff < -0.1; // Float threshold
                                const isMatch = Math.abs(diff) < 0.5;

                                // Determine plate size for "Missing Plates" label
                                // Fallback to 10 if not found
                                const standardRecipe = group.sku.category === 'Steam' ? 10 : (group.sku.category === 'Kurkure' ? 6 : 10);
                                const missingPlates = isLoss ? Math.floor(Math.abs(diff) / standardRecipe) : 0;

                                return (
                                    <React.Fragment key={group.sku.id}>
                                        <tr className="bg-slate-50/30">
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <Package size={14} className="text-slate-400" />
                                                    <span className="font-bold text-slate-800">{group.sku.name}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 uppercase ml-6">{group.sku.category}</div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="font-mono font-bold text-slate-800">{Math.round(accounted)}</span>
                                                    <div className="flex gap-1 mt-0.5">
                                                        <span className="text-[8px] bg-blue-50 text-blue-600 px-1 rounded border border-blue-100">Sold: {Math.round(group.billedSold)}</span>
                                                        {group.reportedWaste > 0 && <span className="text-[8px] bg-red-50 text-red-600 px-1 rounded border border-red-100">Waste: {Math.round(group.reportedWaste)}</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center font-mono font-bold text-slate-500">
                                                {Math.round(group.physicalNetUsed)}
                                            </td>
                                            <td className="p-4 text-right">
                                                {isLoss ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg border border-red-100 flex items-center gap-1">
                                                            <AlertTriangle size={12}/> {Math.abs(Math.round(diff))} pcs missing
                                                        </span>
                                                        {missingPlates > 0 && (
                                                            <span className="text-[9px] font-bold text-red-400 mt-1 uppercase">≈ {missingPlates} Plates Lost</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isMatch ? 'text-slate-400 bg-slate-100' : 'text-emerald-600 bg-emerald-50 border border-emerald-100'}`}>
                                                        {isMatch ? 'Balanced' : 'Surplus Stock'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                        {/* Sub-rows for involved menu items */}
                                        {Object.values(group.menuItemsInvolved).map((menu, mIdx) => (
                                            <tr key={mIdx} className="hover:bg-slate-50 group border-none">
                                                <td className="py-2 pl-12 pr-4" colSpan={4}>
                                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                                        <div className="flex items-center gap-2">
                                                            <Utensils size={10} className="text-slate-300" />
                                                            <span>{menu.name}</span>
                                                            <span className={`text-[9px] px-1 rounded ${menu.variant === 'HALF' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>{menu.variant}</span>
                                                        </div>
                                                        <span className="font-bold text-slate-400 italic">x {menu.qty} sold</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                            {auditGroups.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-slate-400 italic bg-white">
                                        <History size={40} className="mx-auto mb-2 opacity-10" />
                                        No transactions or sales records found for this period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
         </div>
      </div>

      {/* Audit Guide */}
      <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl p-6">
         <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400"><Code2 size={24}/></div>
            <div>
               <h3 className="font-bold text-white text-lg">Reconciliation Logic Explained</h3>
               <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                  The dashboard groups data by <strong>Raw SKU</strong> to handle items that share ingredients (e.g., Steamed vs Fried momos).
                  <br /><br />
                  <span className="text-white font-bold">Accounted For:</span> (Pieces calculated from POS Sales) + (Pieces reported as Waste by staff). 
                  <br />
                  <span className="text-white font-bold">Physical Usage:</span> (Total Pieces Check-Out) - (Total Pieces Returned to Fridge).
                  <br /><br />
                  If <code className="text-indigo-400">Accounted</code> is lower than <code className="text-indigo-400">Physical</code>, stock has been lost without a record.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Reconciliation;
