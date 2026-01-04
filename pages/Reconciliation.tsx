import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { SalesPlatform, TransactionType } from '../types';
import { parseSalesReportImage } from '../services/geminiService';
import { getLocalISOString } from '../constants';
import { Scale, Upload, Store, Calendar, CheckCircle2, AlertTriangle, Plus, Trash2, Camera, Loader2 } from 'lucide-react';

const Reconciliation: React.FC = () => {
  const { branches, skus, salesRecords, addSalesRecords, deleteSalesRecordsForDate, transactions } = useStore();
  const [date, setDate] = useState<string>(getLocalISOString());
  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
  const [activePlatform, setActivePlatform] = useState<SalesPlatform>('POS');
  
  // Input State
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // File Upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Calculations for Variance ---
  const varianceData = useMemo(() => {
    // 1. Calculate Actual Usage (From Operations: Checkout - Returns - Waste)
    // Note: Waste is counted as "Used" from Fridge perspective, but here we want to match Sales.
    // If an item is wasted, it wasn't sold. So Actual Consumption for Sales = Checkout - Returns - Waste.
    const usage: Record<string, number> = {};
    
    transactions.filter(t => t.date === date && t.branchId === branchId).forEach(t => {
      if (t.type === TransactionType.CHECK_OUT) {
        usage[t.skuId] = (usage[t.skuId] || 0) + t.quantityPieces;
      } else if (t.type === TransactionType.CHECK_IN) {
        usage[t.skuId] = (usage[t.skuId] || 0) - t.quantityPieces;
      } else if (t.type === TransactionType.WASTE) {
        // We subtract waste because we are comparing "Sold" vs "Available to Sell".
        // If 50 taken, 5 wasted, 45 should have been sold.
        usage[t.skuId] = (usage[t.skuId] || 0) - t.quantityPieces;
      }
    });

    // 2. Calculate Total Sales (From Derived Sales Records)
    const sales: Record<string, number> = {};
    salesRecords.filter(r => r.date === date && r.branchId === branchId).forEach(r => {
      sales[r.skuId] = (sales[r.skuId] || 0) + r.quantitySold;
    });

    // 3. Combine
    return skus.map(sku => {
      const used = usage[sku.id] || 0;
      const sold = sales[sku.id] || 0;
      const diff = sold - used; // Positive means Sold > Used (Impossible? Or Entry Error). Negative means Used > Sold (Theft/Loss).
      
      return {
        sku,
        used, // Theoretical Consumption based on inventory movement
        sold, // Actual Sales recorded (From Orders + Manual Entry)
        diff
      };
    });
  }, [transactions, salesRecords, date, branchId, skus]);

  // Handle Image Upload & AI Parsing
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result;
        // Explicitly check for string to satisfy TypeScript and narrow type
        if (typeof result === 'string') {
            try {
              const parsedData = await parseSalesReportImage(result as string, skus);
              
              // Merge parsed data into inputs
              setInputs(prev => {
                const newInputs = { ...prev };
                Object.entries(parsedData).forEach(([skuId, qty]) => {
                    const quantity = Number(qty);
                    const current = parseInt(newInputs[skuId] || '0');
                    if (!isNaN(quantity)) {
                        newInputs[skuId] = (current + quantity).toString();
                    }
                });
                return newInputs;
              });
              setSuccessMsg('Report analyzed! Please review quantities below.');
            } catch (err) {
              alert("Failed to analyze image. Please try again or enter manually.");
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

  const handleInputChange = (skuId: string, val: string) => {
    setInputs(prev => ({ ...prev, [skuId]: val }));
  };

  const handleSave = () => {
    // 1. Delete existing manual records for this platform/date/branch to avoid duplicates if re-saving
    deleteSalesRecordsForDate(date, branchId, activePlatform);

    // 2. Add new records
    const recordsToSave: any[] = [];
    Object.entries(inputs).forEach(([skuId, val]) => {
      const qty = parseInt(val);
      if (qty > 0) {
        recordsToSave.push({
          date,
          branchId,
          platform: activePlatform,
          skuId,
          quantitySold: qty
        });
      }
    });

    if (recordsToSave.length > 0) {
      addSalesRecords(recordsToSave);
      setSuccessMsg(`Saved ${recordsToSave.length} items for ${activePlatform}.`);
      setInputs({});
    } else {
       setSuccessMsg('No data entered.');
    }

    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Helper to get total sales recorded for a platform today (for UI feedback)
  const getExistingSalesCount = (platform: SalesPlatform) => {
     return salesRecords
       .filter(r => r.date === date && r.branchId === branchId && r.platform === platform)
       .reduce((acc, curr) => acc + curr.quantitySold, 0);
  };

  return (
    <div className="pb-16 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Scale className="text-indigo-600" /> Sales Reconciliation
        </h2>
        <p className="text-slate-500">Compare inventory usage against POS & Zomato/Swiggy sales.</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 mb-6">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
               <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Store & Date</label>
               <div className="flex gap-2">
                  <select 
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none flex-1"
                  >
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
            </div>
         </div>

         {/* Platform Tabs */}
         <div className="flex flex-col md:flex-row gap-4">
             <div className="flex-1 flex flex-col gap-4">
                 <div className="flex bg-slate-100 p-1 rounded-lg">
                    {(['POS', 'ZOMATO', 'SWIGGY'] as SalesPlatform[]).map(p => {
                       const count = getExistingSalesCount(p);
                       return (
                        <button
                          key={p}
                          onClick={() => { setActivePlatform(p); setInputs({}); setSuccessMsg(''); }}
                          className={`flex-1 py-2 rounded-md text-xs md:text-sm font-bold transition-all relative ${
                            activePlatform === p 
                            ? 'bg-white text-indigo-600 shadow-sm' 
                            : 'text-slate-500 hover:text-indigo-500'
                          }`}
                        >
                          {p}
                          {count > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full"></span>}
                        </button>
                       );
                    })}
                 </div>

                 {/* Input Area */}
                 <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                    <div className="flex justify-between items-center mb-4">
                       <h3 className="font-bold text-slate-700">{activePlatform} Sales Entry</h3>
                       
                       {/* AI Uploader */}
                       <div>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleImageUpload}
                          />
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isProcessing}
                            className="text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
                          >
                            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                            {isProcessing ? 'Analyzing...' : 'Scan Report (AI)'}
                          </button>
                       </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                       {skus.map(sku => (
                         <div key={sku.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                            <span className="text-sm font-medium text-slate-600">{sku.name}</span>
                            <div className="flex items-center gap-2">
                               <input 
                                 type="number"
                                 placeholder="0"
                                 value={inputs[sku.id] || ''}
                                 onChange={(e) => handleInputChange(sku.id, e.target.value)}
                                 className="w-16 text-center border border-slate-300 rounded-md py-1 text-sm focus:outline-none focus:border-indigo-500"
                               />
                               <span className="text-xs text-slate-400 w-6">pcs</span>
                            </div>
                         </div>
                       ))}
                    </div>

                    <div className="mt-4 flex justify-end">
                       <button 
                         onClick={handleSave}
                         className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
                       >
                         Save {activePlatform} Data
                       </button>
                    </div>
                    
                    {successMsg && <p className="text-center text-xs font-bold text-emerald-600 mt-2 animate-fade-in">{successMsg}</p>}
                 </div>
             </div>

             {/* Variance Report Table */}
             <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                 <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-700">Variance Report</h3>
                    <p className="text-xs text-slate-500">Comparison: Inventory Used vs. Total Sold</p>
                 </div>
                 <div className="flex-1 overflow-y-auto max-h-[500px]">
                    <table className="w-full text-sm text-left">
                       <thead className="text-xs text-slate-400 bg-slate-50 uppercase font-semibold sticky top-0">
                          <tr>
                             <th className="p-3">Item</th>
                             <th className="p-3 text-center">Used</th>
                             <th className="p-3 text-center">Sold</th>
                             <th className="p-3 text-right">Diff</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {varianceData.map(row => {
                             // Only show items with activity
                             if (row.used === 0 && row.sold === 0) return null;
                             
                             const isLoss = row.diff < 0; // Sold < Used
                             const isGain = row.diff > 0; // Sold > Used (Data Entry Error?)
                             const isMatch = row.diff === 0;

                             return (
                               <tr key={row.sku.id} className="hover:bg-slate-50">
                                  <td className="p-3 font-medium text-slate-700">{row.sku.name}</td>
                                  <td className="p-3 text-center text-slate-500">{row.used}</td>
                                  <td className="p-3 text-center text-slate-500">{row.sold}</td>
                                  <td className="p-3 text-right">
                                     <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                                        isMatch ? 'text-slate-300' : 
                                        isLoss ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                     }`}>
                                        {row.diff > 0 ? '+' : ''}{row.diff}
                                     </span>
                                  </td>
                               </tr>
                             );
                          })}
                       </tbody>
                    </table>
                 </div>
                 <div className="p-3 bg-red-50 text-red-700 text-xs border-t border-red-100">
                    <p><strong>Negative Diff (Red):</strong> Potential Theft/Loss. Items were removed from fridge but not recorded in sales.</p>
                 </div>
             </div>
         </div>
      </div>
    </div>
  );
};

export default Reconciliation;