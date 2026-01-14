import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { SalesPlatform, TransactionType, SKU, MenuItem, OrderItem } from '../types';
import { parseSalesReportImage } from '../services/geminiService';
import { getLocalISOString } from '../constants';
import { 
  Scale, Camera, Loader2, Info, ShoppingCart, FileText, 
  AlertCircle, Calendar, ChevronRight, 
  TrendingDown, TrendingUp, Code2, Database, Share2, Utensils, Package, AlertTriangle
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

  // --- CORE CALCULATION ENGINE ---
  const auditData = useMemo(() => {
    const physicalUsage: Record<string, number> = {};
    // Fix: Updated billedMenuTotals type to include menuItemId
    const billedMenuTotals: Record<string, { qty: number, name: string, variant: string, menuItemId: string }> = {};
    const skuBilledQty: Record<string, number> = {};

    // 1. Filter Transactions & Orders once for speed
    const filteredTxs = transactions.filter(t => t.date >= startDate && t.date <= endDate && t.branchId === branchId);
    const filteredOrders = orders.filter(o => o.branchId === branchId && o.date >= startDate && o.date <= endDate);

    // 2. Physical Usage (Raw SKUs)
    filteredTxs.forEach(t => {
      if (t.type === TransactionType.CHECK_OUT) {
        physicalUsage[t.skuId] = (physicalUsage[t.skuId] || 0) + t.quantityPieces;
      } else if (t.type === TransactionType.CHECK_IN || t.type === TransactionType.WASTE) {
        physicalUsage[t.skuId] = (physicalUsage[t.skuId] || 0) - t.quantityPieces;
      }
    });

    // 3. Process Sales (Menu Items)
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const key = `${item.menuItemId}-${item.variant || 'FULL'}`;
        if (!billedMenuTotals[key]) {
          // Fix: Initializing billedMenuTotals with menuItemId
          billedMenuTotals[key] = { qty: 0, name: item.name, variant: item.variant || 'FULL', menuItemId: item.menuItemId };
        }
        billedMenuTotals[key].qty += item.quantity;

        // Calculate expected raw SKU usage for this sold item
        const menu = menuItems.find(m => m.id === item.menuItemId);
        if (menu) {
          const ingredients = (item.variant === 'HALF' && menu.halfIngredients && menu.halfIngredients.length > 0)
            ? menu.halfIngredients
            : (item.variant === 'HALF' ? menu.ingredients.map(i => ({ ...i, quantity: i.quantity * 0.5 })) : menu.ingredients);
          
          ingredients.forEach(ing => {
            skuBilledQty[ing.skuId] = (skuBilledQty[ing.skuId] || 0) + (ing.quantity * item.quantity);
          });
        }
      });
    });

    // 4. Final calculation for raw variance
    const rawVariance = skus.map(sku => {
      const used = physicalUsage[sku.id] || 0;
      const sold = skuBilledQty[sku.id] || 0;
      return { sku, used, sold, diff: sold - used };
    });

    return { 
      rawVariance, 
      menuSales: Object.values(billedMenuTotals).sort((a,b) => b.qty - a.qty) 
    };
  }, [transactions, orders, skus, menuItems, startDate, endDate, branchId]);

  const totals = useMemo(() => {
    const sold = auditData.rawVariance.reduce((acc, curr) => acc + curr.sold, 0);
    const used = auditData.rawVariance.reduce((acc, curr) => acc + curr.used, 0);
    const diff = sold - used;
    const variancePercent = used > 0 ? (diff / used) * 100 : 0;
    return { sold, used, diff, variancePercent };
  }, [auditData]);

  // --- RENDERING HELPERS ---

  // Fix: Added missing getSkuName helper
  const getSkuName = (id: string) => skus.find(s => s.id === id)?.name || id;

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
      setSuccessMsg(`Saved to ${endDate}.`);
      setInputs({});
    }
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="pb-16 max-w-7xl mx-auto space-y-6">
      {/* Header & Quick Presets */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Scale className="text-indigo-600" /> Sales Reconciliation
          </h2>
          <p className="text-slate-500">Inventory usage vs Billed menu items.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button onClick={() => setPreset(1)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${startDate === today && endDate === today ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Today</button>
          <button onClick={() => setPreset(7)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${startDate !== today && (new Date(endDate).getTime() - new Date(startDate).getTime() < 8 * 24 * 60 * 60 * 1000) ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>7 Days</button>
          <button onClick={() => setPreset(30)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${startDate !== today && (new Date(endDate).getTime() - new Date(startDate).getTime() > 25 * 24 * 60 * 60 * 1000) ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>30 Days</button>
        </div>
      </div>

      {/* High-Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Physical Usage</p>
             <h4 className="text-2xl font-mono font-bold text-slate-800">{Math.round(totals.used)} <span className="text-xs font-sans text-slate-400 font-normal">pcs</span></h4>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Billed (Calculated)</p>
             <h4 className="text-2xl font-mono font-bold text-indigo-600">{Math.round(totals.sold)} <span className="text-xs font-sans text-slate-400 font-normal">pcs</span></h4>
          </div>
          <div className={`p-5 rounded-xl border shadow-sm ${totals.diff < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
             <p className={`text-[10px] font-bold uppercase mb-1 ${totals.diff < 0 ? 'text-red-500' : 'text-emerald-500'}`}>Raw Variance</p>
             <div className="flex items-center gap-2">
                {totals.diff < 0 ? <TrendingDown size={20} className="text-red-500"/> : <TrendingUp size={20} className="text-emerald-500"/>}
                <h4 className={`text-2xl font-mono font-bold ${totals.diff < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {totals.diff > 0 ? '+' : ''}{Math.round(totals.diff)}
                </h4>
             </div>
          </div>
          <div className="bg-slate-900 p-5 rounded-xl shadow-lg text-white">
             <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Inventory Accuracy</p>
             <h4 className={`text-2xl font-mono font-bold ${Math.abs(totals.variancePercent) > 2 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {(100 - Math.abs(totals.variancePercent)).toFixed(1)}%
             </h4>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Sidebar: Filters & Manual Sync */}
         <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
               <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Calendar size={16} className="text-indigo-500"/> Report Filter</h3>
               <div className="space-y-4">
                  <div>
                     <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Branch Location</label>
                     <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 font-bold text-slate-700">
                       {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                     </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">From</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-lg px-2 py-2 text-xs font-medium"/></div>
                      <div><label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">To</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded-lg px-2 py-2 text-xs font-medium"/></div>
                  </div>
               </div>
            </div>

            {/* Manual Syncing for Zomato/Swiggy */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <h3 className="font-bold text-slate-700 text-sm">Sync Zomato/Swiggy Reports</h3>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {(['POS', 'ZOMATO', 'SWIGGY'] as SalesPlatform[]).map(p => (
                            <button key={p} onClick={() => { setActivePlatform(p); setInputs({}); }} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${activePlatform === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{p}</button>
                        ))}
                    </div>
                    <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                        <span className="text-xs font-bold text-indigo-800">Scan Statement</span>
                        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
                        <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="text-[10px] bg-white text-indigo-700 px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 shadow-sm border border-indigo-200">
                            {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />} AI Sync
                        </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {skus.map(sku => (
                            <div key={sku.id} className="flex justify-between items-center group">
                                <span className="text-[11px] text-slate-500 truncate mr-2 group-hover:text-slate-900 transition-colors">{sku.name}</span>
                                <div className="flex items-center gap-1">
                                    <input type="number" placeholder="0" value={inputs[sku.id] || ''} onChange={(e) => setInputs(prev => ({ ...prev, [sku.id]: e.target.value }))} className="w-12 text-center border rounded py-0.5 text-xs focus:ring-2 focus:ring-indigo-200 outline-none"/>
                                    <span className="text-[9px] text-slate-300 font-bold uppercase">pcs</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleSave} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-lg text-xs font-bold shadow-md transition-all active:scale-95">Save {activePlatform} Totals</button>
                    {successMsg && <p className="text-center text-[11px] font-bold text-emerald-600 mt-2 animate-fade-in">{successMsg}</p>}
                </div>
            </div>
         </div>

         {/* Main Content: Audit Report */}
         <div className="lg:col-span-2 space-y-6">
            
            {/* New: Menu Item Level Audit */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <Utensils size={18}/>
                        </div>
                        <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">Menu Sales & Missing Plates</h3>
                    </div>
                    <div className="text-[10px] bg-white border px-2 py-1 rounded font-bold text-slate-400">POS Sales Level</div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-slate-400 bg-slate-50 uppercase font-bold border-b">
                            <tr>
                                <th className="p-4">Menu Item</th>
                                <th className="p-4 text-center">Total Sold</th>
                                <th className="p-4 text-right">Inventory Audit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {auditData.menuSales.map(menu => {
                                // Find associated SKU and its variance to determine "Missing"
                                // Fix: Property 'menuItemId' now exists on menu object
                                const menuItemObj = menuItems.find(m => m.id === menu.menuItemId);
                                if (!menuItemObj) return null;

                                // Use primary ingredient for variance calculation
                                const primaryIng = menuItemObj.ingredients[0];
                                if (!primaryIng) return null;

                                const rawVar = auditData.rawVariance.find(v => v.sku.id === primaryIng.skuId);
                                const missingPieces = rawVar ? rawVar.diff : 0;
                                
                                // How many plates does the missing piece count equal?
                                // Important: We divide by the recipe quantity
                                const piecesPerPlate = (menu.variant === 'HALF' && menuItemObj.halfIngredients && menuItemObj.halfIngredients.length > 0)
                                    ? menuItemObj.halfIngredients[0].quantity
                                    : (menu.variant === 'HALF' ? primaryIng.quantity * 0.5 : primaryIng.quantity);
                                
                                const missingPlates = piecesPerPlate > 0 ? Math.floor(Math.abs(Math.min(0, missingPieces)) / piecesPerPlate) : 0;

                                return (
                                    // Fix: Property 'menuItemId' now exists on menu object
                                    <tr key={`${menu.menuItemId}-${menu.variant}`} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-slate-700">{menu.name}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                                                {menu.variant === 'HALF' ? <span className="text-orange-500">Half Plate</span> : <span className="text-blue-500">Full Plate</span>}
                                                <span>• {getSkuName(primaryIng.skuId)}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="inline-flex items-center justify-center bg-slate-100 rounded-lg px-3 py-1 font-bold text-slate-700">
                                                x {menu.qty}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            {missingPlates > 0 ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 flex items-center gap-1">
                                                        <AlertTriangle size={12}/> {missingPlates} missing
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 mt-1">Based on raw SKU loss</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">No loss</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {auditData.menuSales.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-12 text-center text-slate-400 italic">No menu items sold in this period.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Raw Inventory Variance Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-200 rounded-lg text-slate-600">
                            <Package size={18}/>
                        </div>
                        <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">Raw Material (SKU) Reconciliation</h3>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-slate-400 bg-slate-50 uppercase font-bold border-b">
                            <tr>
                                <th className="p-4 w-1/3">Raw Material</th>
                                <th className="p-4 text-center">Billed (Calculated)</th>
                                <th className="p-4 text-center">Physical (Net used)</th>
                                <th className="p-4 text-right">Variance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {auditData.rawVariance.filter(r => r.used !== 0 || r.sold !== 0).map(row => (
                                <tr key={row.sku.id} className="hover:bg-slate-50">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-700">{row.sku.name}</div>
                                        <div className="text-[10px] text-slate-400 uppercase">{row.sku.category}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="font-mono font-bold text-slate-800">{Math.round(row.sold)}</span>
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
      </div>

      {/* Dev Info */}
      <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl p-6">
         <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400"><Code2 size={24}/></div>
            <div>
               <h3 className="font-bold text-white text-lg">Audit Logic Guide</h3>
               <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                  The dashboard calculates "Missing Plates" by dividing the total raw SKU pieces lost by the quantity required per plate. 
                  <br /><br />
                  <code className="text-indigo-400 bg-black/40 px-2 py-1 rounded">Shared SKUs:</code> If "Veg Steam" and "Veg Fried" share the same raw SKU, the system attributes the loss back to the menu items based on the primary raw material they consume.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Reconciliation;