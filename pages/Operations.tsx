
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { TransactionType, SKUCategory, SKUDietary, SKU } from '../types';
import { ArrowDownCircle, ArrowUpCircle, Save, Plus, Calendar, Store, AlertTriangle, X, CheckCircle2, Clock, Calculator, PackageCheck, Utensils, WifiOff } from 'lucide-react';
import { getLocalISOString } from '../constants';

const Operations: React.FC = () => {
  const { branches, skus, addBatchTransactions, transactions, menuItems } = useStore();
  const { currentUser } = useAuth();

  // Form State
  const [date, setDate] = useState<string>(getLocalISOString());
  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
  const [type, setType] = useState<TransactionType>(TransactionType.CHECK_OUT);

  // Store quantities as { skuId: { packets: number, loose: number } }
  const [inputs, setInputs] = useState<Record<string, { packets: string, loose: string }>>({});
  // Track if the return value has been applied to hide the button
  const [appliedReturns, setAppliedReturns] = useState<Record<string, boolean>>({});
  const [successMsg, setSuccessMsg] = useState('');
  const [warningMsg, setWarningMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Confirmation Modal State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Smart Date Logic ---
  // Ensure we use Local Time to avoid UTC shift
  const todayStr = getLocalISOString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = getLocalISOString(yesterdayDate);

  const [dateAutoReason, setDateAutoReason] = useState<string>('');

  // Update date automatically when Transaction Type changes
  useEffect(() => {
    const currentHour = new Date().getHours();

    if (type === TransactionType.CHECK_OUT) {
      // Checkouts are usually for the current trading day
      setDate(todayStr);
      setDateAutoReason('');
    } else if (type === TransactionType.CHECK_IN) {
      // Returns Logic:
      // If it's before 6 PM (18:00), assume we are entering returns for Yesterday's shift.
      if (currentHour < 18) {
        setDate(yesterdayStr);
        setDateAutoReason('Auto-selected Yesterday (Before 6 PM rule)');
      } else {
        setDate(todayStr);
        setDateAutoReason('');
      }
    }
  }, [type, todayStr, yesterdayStr]);

  const formatDateLabel = (dateString: string) => {
    // Parse using string manipulation to ensure visual date matches input (ignore timezone)
    if (!dateString) return '';
    const [y, m, d] = dateString.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d); // Local date constructor
    return dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };
  // ------------------------

  // Helper to calculate total quantity from inputs
  const getCalculatedTotal = (skuId: string, packetSize: number) => {
    const packets = parseInt(inputs[skuId]?.packets || '0');
    const loose = parseInt(inputs[skuId]?.loose || '0');
    // Handle NaN
    return (isNaN(packets) ? 0 : packets) * packetSize + (isNaN(loose) ? 0 : loose);
  };

  // Helper to find "Standard Plate Size" for an SKU based on Category defaults
  // HARDCODED CONFIGURATION: Edit values here to change plate calculation logic
  const getPlateSize = (sku: SKU) => {
    // Priority 1: Category Defaults (Hardcoded)
    if (sku.category === SKUCategory.STEAM) return 8;   // 8 pcs per plate
    if (sku.category === SKUCategory.KURKURE) return 6; // 6 pcs per plate
    if (sku.category === SKUCategory.ROLL) return 2;    // 2 pcs per plate

    // Priority 2: Menu Lookup (Fallback for other categories)
    const menuItem = menuItems.find(m => m.ingredients && m.ingredients.some(i => i.skuId === sku.id));
    if (menuItem) {
      const ingredient = menuItem.ingredients.find(i => i.skuId === sku.id);
      return ingredient?.quantity || 0;
    }
    return 0;
  };

  // Fetch the last return transaction for each SKU for the selected Branch (Only for Check Out enhancements)
  const latestReturns = useMemo(() => {
    const returns: Record<string, { qty: number, date: string }> = {};
    if (type !== TransactionType.CHECK_OUT) return returns;

    // Fix: Strictly look for returns from the PREVIOUS DAY relative to selected date
    // This prevents showing stale returns from 2+ days ago if yesterday had 0 returns.
    const [y, m, d] = date.split('-').map(Number);
    const prevDateObj = new Date(y, m - 1, d - 1);
    const targetDate = getLocalISOString(prevDateObj);

    skus.forEach(sku => {
      // STRICT FILTER: Only consider returns for the currently selected branchId AND targetDate
      const lastTx = transactions.find(t =>
        t.type === TransactionType.CHECK_IN &&
        t.skuId === sku.id &&
        t.branchId === branchId &&
        t.date === targetDate
      );
      if (lastTx) {
        returns[sku.id] = {
          qty: lastTx.quantityPieces,
          date: lastTx.date
        };
      }
    });
    return returns;
  }, [transactions, branchId, skus, type, date]);

  // Calculate Limits (Total Taken per SKU for this Date/Branch)
  const maxTransactionLimits = useMemo(() => {
    const limits: Record<string, number> = {};

    // We need limits for BOTH calculations now (not just limits)
    // For Check-out: used for history? (Not really needed)
    // For Check-in: needed for "Total Taken" display

    skus.forEach(sku => {
      const totalTaken = transactions
        .filter(t =>
          t.date === date &&
          t.branchId === branchId &&
          t.skuId === sku.id &&
          t.type === TransactionType.CHECK_OUT
        )
        .reduce((sum, t) => sum + t.quantityPieces, 0);
      limits[sku.id] = totalTaken;
    });
    return limits;
  }, [transactions, date, branchId, skus, type]);

  const handleInputChange = (skuId: string, field: 'packets' | 'loose', value: string) => {
    setInputs(prev => ({
      ...prev,
      [skuId]: {
        ...prev[skuId],
        [field]: value
      }
    }));

    // Clear error when user types
    if (errorMsg) setErrorMsg('');

    if (field === 'loose' && (!value || value === '0')) {
      setAppliedReturns(prev => ({
        ...prev,
        [skuId]: false
      }));
    }
  };

  const useLastReturn = (skuId: string, qty: number) => {
    const currentVal = parseInt(inputs[skuId]?.loose || '0');
    const safeCurrent = isNaN(currentVal) ? 0 : currentVal;
    const newVal = safeCurrent + qty;

    setInputs(prev => ({
      ...prev,
      [skuId]: {
        ...prev[skuId],
        loose: newVal.toString()
      }
    }));

    setAppliedReturns(prev => ({
      ...prev,
      [skuId]: true
    }));
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setWarningMsg('');
    setErrorMsg('');

    // Validation: Ensure Returns do not exceed Stock Taken
    if (type === TransactionType.CHECK_IN) {
      const errors: string[] = [];

      skus.forEach(sku => {
        const qtyToTransact = getCalculatedTotal(sku.id, sku.piecesPerPacket);
        if (qtyToTransact > 0) {
          const totalTaken = maxTransactionLimits[sku.id] || 0;
          if (qtyToTransact > totalTaken) {
            errors.push(`${sku.name}: Limit ${totalTaken} pcs (Checked Out).`);
          }
        }
      });

      if (errors.length > 0) {
        setErrorMsg(errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} other items exceed limit)` : ''));
        return; // Stop submission
      }
    }

    // Check if at least one item has value
    const hasItems = skus.some(sku => getCalculatedTotal(sku.id, sku.piecesPerPacket) > 0);
    if (!hasItems) {
      setErrorMsg("Please enter quantity for at least one item.");
      return;
    }

    // Open Confirmation Modal
    setIsConfirmOpen(true);
  };

  const confirmSubmit = async () => {
    setIsSubmitting(true);
    const transactionsToSave: any[] = [];

    skus.forEach(sku => {
      const totalPieces = getCalculatedTotal(sku.id, sku.piecesPerPacket);
      if (totalPieces > 0) {
        transactionsToSave.push({
          date,
          branchId,
          skuId: sku.id,
          type,
          quantityPieces: totalPieces,
          userId: currentUser?.id,
          userName: currentUser?.name
        });
      }
    });

    if (transactionsToSave.length > 0) {
      const cloudSuccess = await addBatchTransactions(transactionsToSave);

      if (cloudSuccess) {
        setSuccessMsg(`Successfully recorded ${transactionsToSave.length} items.`);
      } else {
        setWarningMsg(`Saved to DEVICE ONLY. Internet sync failed. Check connection.`);
      }

      setInputs({});
      setAppliedReturns({});
      setIsConfirmOpen(false);
      setTimeout(() => {
        setSuccessMsg('');
        setWarningMsg('');
      }, 4000);
    }
    setIsSubmitting(false);
  };

  const getCategoryColor = (category: SKUCategory) => {
    switch (category) {
      case SKUCategory.STEAM: return 'bg-blue-100 text-blue-800 border-blue-200';
      case SKUCategory.KURKURE: return 'bg-amber-100 text-amber-800 border-amber-200';
      case SKUCategory.WHEAT: return 'bg-orange-100 text-orange-800 border-orange-200';
      case SKUCategory.ROLL: return 'bg-purple-100 text-purple-800 border-purple-200';
      case SKUCategory.CONSUMABLES: return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const activeBorderColor = type === TransactionType.CHECK_OUT ? 'border-emerald-500' : 'border-blue-500';
  const activeTextColor = type === TransactionType.CHECK_OUT ? 'text-emerald-600' : 'text-blue-600';
  const activeBgColor = type === TransactionType.CHECK_OUT ? 'bg-emerald-50' : 'bg-blue-50';

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Inventory Operations</h2>
        <p className="text-slate-500 text-sm md:text-base">Log stock check-outs and returns.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Branch Selector (Top Level) */}
        <div className="p-4 md:p-6 bg-slate-50 border-b border-slate-200">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Store size={14} /> Select Branch
          </label>
          {branches.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {branches.map(branch => (
                <button
                  key={branch.id}
                  onClick={() => setBranchId(branch.id)}
                  className={`flex-shrink-0 px-5 py-2.5 rounded-full font-medium text-sm transition-all whitespace-nowrap border ${branchId === branch.id
                    ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-105'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-white hover:border-slate-400'
                    }`}
                >
                  {branch.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-red-500 italic">No branches found. Please add a branch in Branch Management.</div>
          )}
        </div>

        {/* Type Selector Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => { setType(TransactionType.CHECK_OUT); setErrorMsg(''); }}
            className={`flex-1 py-3 md:py-4 text-center font-medium transition-colors flex items-center justify-center gap-2 text-sm md:text-base ${type === TransactionType.CHECK_OUT
              ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500'
              : 'text-slate-400 hover:bg-slate-50'
              }`}
          >
            <ArrowUpCircle size={18} className="md:w-5 md:h-5" />
            Check Out
          </button>
          <button
            onClick={() => { setType(TransactionType.CHECK_IN); setErrorMsg(''); }}
            className={`flex-1 py-3 md:py-4 text-center font-medium transition-colors flex items-center justify-center gap-2 text-sm md:text-base ${type === TransactionType.CHECK_IN
              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
              : 'text-slate-400 hover:bg-slate-50'
              }`}
          >
            <ArrowDownCircle size={18} className="md:w-5 md:h-5" />
            Returns
          </button>
        </div>

        <form onSubmit={handlePreSubmit} className="p-4 md:p-6 space-y-6">

          {/* Smart Date Selector */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Calendar size={14} /> Trading Date
            </label>
            <div className="flex flex-col md:flex-row gap-3">
              <button
                type="button"
                onClick={() => { setDate(yesterdayStr); setDateAutoReason(''); }}
                className={`flex-1 p-3 rounded-lg border flex flex-col items-center justify-center transition-all ${date === yesterdayStr
                  ? 'bg-slate-800 text-white border-slate-800 shadow-md ring-2 ring-slate-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
              >
                <span className="text-xs uppercase opacity-70 font-semibold tracking-wider">Yesterday</span>
                <span className="font-bold text-lg">{formatDateLabel(yesterdayStr)}</span>
              </button>

              <button
                type="button"
                onClick={() => { setDate(todayStr); setDateAutoReason(''); }}
                className={`flex-1 p-3 rounded-lg border flex flex-col items-center justify-center transition-all ${date === todayStr
                  ? 'bg-slate-800 text-white border-slate-800 shadow-md ring-2 ring-slate-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
              >
                <span className="text-xs uppercase opacity-70 font-semibold tracking-wider">Today</span>
                <span className="font-bold text-lg">{formatDateLabel(todayStr)}</span>
              </button>

              {/* Hidden / Custom Date Fallback */}
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => { setDate(e.target.value); setDateAutoReason(''); }}
                  className="h-full px-4 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm font-medium w-full md:w-auto"
                />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-end pr-3 md:hidden">
                  <Clock size={16} className="text-slate-400" />
                </div>
              </div>
            </div>

            {dateAutoReason && (
              <div className="mt-2 text-xs text-blue-600 font-medium flex items-center gap-1.5 animate-fade-in">
                <Clock size={12} />
                {dateAutoReason}
              </div>
            )}
          </div>

          {/* Desktop Headers */}
          <div className="hidden md:grid grid-cols-12 gap-4 mb-2 px-2 text-xs font-semibold text-slate-400 uppercase">
            <div className="col-span-4">Product Details</div>
            <div className="col-span-3 text-center">
              New Packets
            </div>
            <div className="col-span-3 text-center">
              {type === TransactionType.CHECK_OUT ? 'Loose / Carryover' : 'Loose Returns'}
            </div>
            <div className="col-span-2 text-right">Total Pcs</div>
          </div>

          <div className="space-y-3">
            {skus.map(sku => {
              const total = getCalculatedTotal(sku.id, sku.piecesPerPacket);
              const hasValue = total > 0;

              // Return Data for Recovery
              const lastReturnInfo = latestReturns[sku.id];
              const lastReturnQty = lastReturnInfo?.qty || 0;
              const isApplied = appliedReturns[sku.id];

              // Max Limit Data (Check Out Limit for Returns)
              const maxLimit = maxTransactionLimits[sku.id] || 0;
              const isReturnOverLimit = (type === TransactionType.CHECK_IN) && total > maxLimit && maxLimit > 0;

              const categoryColor = getCategoryColor(sku.category);

              // Plate Calculation Logic (Only for Returns View)
              const plateSize = getPlateSize(sku);
              const netConsumed = Math.max(0, maxLimit - total); // Taken - Returned
              const platesSold = plateSize > 0 ? Math.floor(netConsumed / plateSize) : 0;
              const pcsSold = plateSize > 0 ? netConsumed % plateSize : netConsumed;

              // Packet Calculation for Green Bar
              const checkedOutPkts = Math.floor(maxLimit / sku.piecesPerPacket);
              const checkedOutLoose = maxLimit % sku.piecesPerPacket;

              return (
                <div key={sku.id} className={`rounded-xl border transition-all ${hasValue ? (isReturnOverLimit ? 'bg-red-50 border-red-200' : `${activeBgColor} ${activeBorderColor}`) : 'bg-white border-slate-200'} p-3 md:p-3 shadow-sm`}>

                  {/* Desktop Layout */}
                  <div className="hidden md:grid md:grid-cols-12 md:gap-4 md:items-center">
                    <div className="col-span-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${categoryColor}`}>
                          {sku.category}
                        </span>
                        {sku.dietary !== SKUDietary.NA && (
                          <div className={`w-2 h-2 rounded-full ${sku.dietary === 'Veg' ? 'bg-green-500' : 'bg-red-500'}`} />
                        )}
                      </div>
                      <p className="font-bold text-slate-700">{sku.name}</p>
                    </div>

                    {/* INPUT SECTION (Merged cols for cleaner UI in Returns mode) */}
                    <div className="col-span-6 px-2">
                      {/* GREEN BAR: Checked Out (Only in Returns Mode) */}
                      {type === TransactionType.CHECK_IN && maxLimit > 0 && (
                        <div className="mb-2 bg-emerald-50 border border-emerald-100 rounded-md py-1 px-3 text-xs text-emerald-800 flex justify-between items-center font-medium">
                          <div className="flex items-center gap-1.5"><PackageCheck size={12} /> Checked Out</div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-[10px] font-normal opacity-80">{checkedOutPkts} pkts, {checkedOutLoose} loose</span>
                            <span className="font-bold">{maxLimit} pcs</span>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 items-center">
                        <div className="flex-1 relative">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={inputs[sku.id]?.packets || ''}
                            onChange={(e) => handleInputChange(sku.id, 'packets', e.target.value)}
                            className={`w-full text-center border rounded-lg h-10 focus:outline-none focus:ring-2 focus:ring-slate-400 ${hasValue ? `${activeBorderColor} bg-white` : 'border-slate-200'}`}
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-slate-400 pointer-events-none">pkts</span>
                        </div>

                        <div className="flex-1 relative">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={inputs[sku.id]?.loose || ''}
                            onChange={(e) => handleInputChange(sku.id, 'loose', e.target.value)}
                            className={`w-full text-center border rounded-lg h-10 focus:outline-none focus:ring-2 focus:ring-slate-400 ${hasValue ? `${activeBorderColor} bg-white` : 'border-slate-200'}`}
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-slate-400 pointer-events-none">pcs</span>

                          {/* Smart Return Button (Desktop) - Only for Check Out */}
                          {type === TransactionType.CHECK_OUT && lastReturnQty > 0 && !isApplied && (
                            <button
                              type="button"
                              onClick={() => useLastReturn(sku.id, lastReturnQty)}
                              className="absolute -top-7 right-0 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors whitespace-nowrap z-10 shadow-sm"
                              title="Add return from yesterday"
                            >
                              <Plus size={10} /> Add Return: {lastReturnQty}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* RED BAR: Approx Plates (Only in Returns Mode) */}
                      {type === TransactionType.CHECK_IN && maxLimit > 0 && (
                        <div className="mt-2 bg-red-50 border border-red-100 rounded-md py-1 px-3 text-xs text-red-800 flex justify-between items-center font-medium">
                          <div className="flex items-center gap-1.5"><Utensils size={12} /> Sold</div>
                          <div className="font-bold flex gap-1">
                            <span>{platesSold} Plates</span>
                            {pcsSold > 0 && <span className="opacity-70 text-[10px] mt-0.5">+{pcsSold} pcs</span>}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="col-span-2 text-right">
                      <p className={`font-mono font-bold text-lg ${isReturnOverLimit ? 'text-red-600' : (hasValue ? activeTextColor : 'text-slate-300')}`}>
                        {total}
                      </p>
                    </div>
                  </div>

                  {/* Mobile Layout (Compact) */}
                  <div className="md:hidden">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex flex-col overflow-hidden w-full mr-2">
                        <div className="flex items-center gap-2 mb-1">
                          {/* Dot Indicator */}
                          {sku.dietary !== SKUDietary.NA ? (
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sku.dietary === 'Veg' ? 'bg-green-500' : 'bg-red-500'}`} />
                          ) : (
                            <div className="w-2 h-2 rounded-full flex-shrink-0 bg-slate-400" />
                          )}
                          {/* Category Badge */}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wide leading-none ${categoryColor}`}>
                            {sku.category}
                          </span>
                        </div>

                        {/* SKU Name */}
                        <div className="flex justify-between items-end">
                          <div>
                            <h3 className="font-bold text-slate-700 text-base truncate leading-tight">{sku.name}</h3>
                          </div>
                          <div className={`font-mono font-bold text-lg ${isReturnOverLimit ? 'text-red-600' : (hasValue ? activeTextColor : 'text-transparent')}`}>
                            {total}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Green Bar (Mobile) */}
                    {type === TransactionType.CHECK_IN && maxLimit > 0 && (
                      <div className="mb-2 bg-emerald-50 border border-emerald-100 rounded-md py-1 px-3 text-xs text-emerald-800 flex justify-between items-center font-medium">
                        <div className="flex items-center gap-1.5"><PackageCheck size={12} /> Checked Out</div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[10px] font-normal opacity-80">{checkedOutPkts} pkts, {checkedOutLoose} loose</span>
                          <span className="font-bold">{maxLimit} pcs</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            placeholder="Packets"
                            value={inputs[sku.id]?.packets || ''}
                            onChange={(e) => handleInputChange(sku.id, 'packets', e.target.value)}
                            className={`w-full text-center border rounded-lg h-10 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 ${hasValue ? `${activeBorderColor} bg-white` : 'border-slate-200 bg-slate-50/50'}`}
                          />
                          <span className="absolute right-2 top-2.5 text-[10px] text-slate-400 pointer-events-none uppercase">Pkts</span>
                        </div>
                      </div>
                      <div>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            placeholder="Loose"
                            value={inputs[sku.id]?.loose || ''}
                            onChange={(e) => handleInputChange(sku.id, 'loose', e.target.value)}
                            className={`w-full text-center border rounded-lg h-10 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 ${hasValue ? `${activeBorderColor} bg-white` : 'border-slate-200 bg-slate-50/50'}`}
                          />
                          <span className="absolute right-2 top-2.5 text-[10px] text-slate-400 pointer-events-none uppercase">Pcs</span>
                        </div>
                      </div>
                    </div>

                    {/* Red Bar (Mobile) */}
                    {type === TransactionType.CHECK_IN && maxLimit > 0 && (
                      <div className="mt-2 bg-red-50 border border-red-100 rounded-md py-1 px-3 text-xs text-red-800 flex justify-between items-center font-medium">
                        <div className="flex items-center gap-1.5"><Utensils size={12} /> Sold</div>
                        <div className="font-bold flex gap-1">
                          <span>{platesSold} Plates</span>
                          {pcsSold > 0 && <span className="opacity-70 text-[10px] mt-0.5">+{pcsSold} pcs</span>}
                        </div>
                      </div>
                    )}

                    {/* Mobile Smart Return Button */}
                    {type === TransactionType.CHECK_OUT && lastReturnQty > 0 && !isApplied && (
                      <button
                        type="button"
                        onClick={() => useLastReturn(sku.id, lastReturnQty)}
                        className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 py-1.5 rounded-lg font-medium active:bg-blue-100 transition-colors"
                      >
                        <Plus size={12} /> Add Return: {lastReturnQty}
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>

          {errorMsg && (
            <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 z-50">
              <div className="bg-red-600 text-white px-6 py-3 rounded-xl shadow-lg text-center font-medium animate-fade-in-up flex items-center justify-center gap-2">
                <AlertTriangle size={18} />
                {errorMsg}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 z-50">
              <div className="bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg text-center font-medium animate-fade-in-up">
                {successMsg}
              </div>
            </div>
          )}

          {warningMsg && (
            <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 z-50">
              <div className="bg-amber-500 text-white px-6 py-3 rounded-xl shadow-lg text-center font-medium animate-fade-in-up flex items-center justify-center gap-2">
                <WifiOff size={18} />
                {warningMsg}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 sticky bottom-0 bg-white md:static p-4 md:p-0 -mx-4 md:mx-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:shadow-none z-40">
            <button
              type="submit"
              disabled={branches.length === 0 || isSubmitting}
              className={`w-full md:w-auto ml-auto px-8 py-3.5 md:py-3 rounded-xl text-white font-bold shadow-lg transition-all flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${type === TransactionType.CHECK_OUT
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
              <Save size={20} />
              {isSubmitting ? 'Saving...' : 'Review & Submit'}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className={`p-5 border-b border-slate-100 flex justify-between items-center rounded-t-xl ${type === TransactionType.CHECK_OUT ? 'bg-emerald-50' : 'bg-blue-50'}`}>
              <div>
                <h3 className={`text-lg font-bold ${type === TransactionType.CHECK_OUT ? 'text-emerald-800' : 'text-blue-800'}`}>
                  Confirm {type === TransactionType.CHECK_OUT ? 'Check Out' : 'Return'}
                </h3>
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-slate-500">
                    Branch: <span className="font-bold">{branches.find(b => b.id === branchId)?.name || 'Unknown'}</span>
                  </p>
                  <p className="text-sm text-slate-500">
                    Date: <span className="font-bold">{formatDateLabel(date)}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setIsConfirmOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <div className="space-y-2">
                {(() => {
                  const activeItems = skus.filter(sku => getCalculatedTotal(sku.id, sku.piecesPerPacket) > 0);
                  const missedItems = skus.filter(sku => {
                    const qty = getCalculatedTotal(sku.id, sku.piecesPerPacket);
                    const maxLimit = maxTransactionLimits[sku.id] || 0;
                    return qty === 0 && maxLimit > 0;
                  });

                  return (
                    <>
                      {/* Active Items List */}
                      {activeItems.map(sku => {
                        const qty = getCalculatedTotal(sku.id, sku.piecesPerPacket);
                        const isZero = false;

                        return (
                          <div
                            key={sku.id}
                            className={`flex justify-between items-center p-3 rounded-lg border ${type === TransactionType.CHECK_OUT ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'
                              }`}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${type === TransactionType.CHECK_OUT ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                              <span className="font-medium truncate text-slate-700">{sku.name}</span>
                            </div>

                            <div className="text-right flex-shrink-0 ml-2">
                              <div className={`font-mono font-bold leading-none ${type === TransactionType.CHECK_OUT ? 'text-emerald-700' : 'text-blue-700'}`}>
                                {type === TransactionType.CHECK_IN ? (
                                  <span>
                                    {(() => {
                                      const maxLimit = maxTransactionLimits[sku.id] || 0;
                                      const netConsumed = Math.max(0, maxLimit - qty);
                                      const plateSize = getPlateSize(sku);
                                      const platesSold = plateSize > 0 ? Math.floor(netConsumed / plateSize) : 0;
                                      const pcsSold = plateSize > 0 ? netConsumed % plateSize : netConsumed;

                                      return (
                                        <span className="flex flex-col items-end">
                                          <span>{platesSold} Plates</span>
                                          {pcsSold > 0 && <span className="text-xs font-normal opacity-80">+{pcsSold} pcs</span>}
                                        </span>
                                      );
                                    })()}
                                  </span>
                                ) : (
                                  <>
                                    {qty} <span className="text-xs font-sans font-normal opacity-60">pcs</span>
                                  </>
                                )}
                              </div>
                              <div className="text-[10px] mt-0.5 text-slate-500">
                                {type === TransactionType.CHECK_OUT ? (
                                  <>{inputs[sku.id]?.packets || 0} pkts + {inputs[sku.id]?.loose || 0} pcs</>
                                ) : (
                                  <span className="text-blue-600 font-medium opacity-80">Partial Return</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Implied Full Sales (No Return Entered) - Only for Returns Mode */}
                      {type === TransactionType.CHECK_IN && missedItems.length > 0 && (
                        <>
                          <div className="mt-4 mb-2 flex items-center gap-2">
                            <div className="h-px bg-slate-200 flex-1"></div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Sales (No Returns)</span>
                            <div className="h-px bg-slate-200 flex-1"></div>
                          </div>

                          <div className="space-y-2 opacity-80 hover:opacity-100 transition-opacity">
                            {missedItems.map(sku => {
                              const maxLimit = maxTransactionLimits[sku.id] || 0;
                              const plateSize = getPlateSize(sku);
                              const platesSold = plateSize > 0 ? Math.floor(maxLimit / plateSize) : 0;
                              const pcsSold = plateSize > 0 ? maxLimit % plateSize : maxLimit;

                              return (
                                <div key={sku.id} className="flex justify-between items-center p-2 rounded-lg border border-slate-200 bg-slate-50/50">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-slate-400" />
                                    <span className="text-sm font-medium truncate text-slate-600">{sku.name}</span>
                                  </div>
                                  <div className="text-right flex-shrink-0 ml-2">
                                    <div className="font-mono text-sm font-bold text-slate-600 leading-none">
                                      {platesSold} Plates
                                      {pcsSold > 0 && <span className="text-[10px] font-normal opacity-80 ml-1">+{pcsSold} pcs</span>}
                                    </div>
                                    <div className="text-[9px] text-slate-400 mt-0.5">
                                      All {maxLimit} pcs Sold
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {/* No items case */}
                      {activeItems.length === 0 && missedItems.length === 0 && (
                        <div className="text-center py-8 text-slate-400 italic">
                          No items selected.
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-white transition-colors"
                disabled={isSubmitting}
              >
                Back to Edit
              </button>
              <button
                onClick={confirmSubmit}
                disabled={isSubmitting}
                className={`px-6 py-2.5 rounded-lg text-white font-bold transition-colors shadow-sm flex items-center gap-2 ${type === TransactionType.CHECK_OUT ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                <CheckCircle2 size={18} />
                {isSubmitting ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Operations;
