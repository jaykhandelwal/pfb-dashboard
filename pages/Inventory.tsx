
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { TransactionType, SKUCategory } from '../types';
import { Snowflake, PackagePlus, AlertCircle, Box, ClipboardCheck, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getLocalISOString } from '../constants';

const Inventory: React.FC = () => {
  const { skus, transactions, addBatchTransactions, appSettings } = useStore();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'view' | 'restock' | 'stocktake'>('view');

  // Form State for Restocking / Stocktake
  const [date, setDate] = useState<string>(getLocalISOString());
  const [inputs, setInputs] = useState<Record<string, { packets: string, loose: string }>>({});
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [isReviewOpen, setIsReviewOpen] = useState(false); // Stocktake
  const [isRestockConfirmOpen, setIsRestockConfirmOpen] = useState(false); // Restock
  const [isDebugOpen, setIsDebugOpen] = useState(false); // Debug Stock
  const [ignoreCheckouts, setIgnoreCheckouts] = useState(false); // Toggle for ignoring checkouts

  // Calculate Current Stock Levels (Fridge Only)
  const stockLevels = useMemo(() => {
    const levels: Record<string, { in: number, out: number, balance: number }> = {};

    // Initialize
    skus.forEach(sku => {
      levels[sku.id] = { in: 0, out: 0, balance: 0 };
    });

    // Process all transactions
    transactions.forEach(t => {
      if (!levels[t.skuId]) return;

      if (t.type === TransactionType.RESTOCK || t.type === TransactionType.CHECK_IN || (t.type === TransactionType.ADJUSTMENT && t.quantityPieces > 0)) {
        // Stock coming INTO the fridge
        levels[t.skuId].in += t.quantityPieces;
      } else if (t.type === TransactionType.CHECK_OUT || (t.type === TransactionType.ADJUSTMENT && t.quantityPieces < 0)) {
        // Stock going OUT of the fridge (or negative adjustment)
        levels[t.skuId].out += Math.abs(t.quantityPieces);
      } else if (t.type === TransactionType.WASTE && t.branchId === 'FRIDGE') {
        // SPECIAL CASE: If wastage is reported specifically for the 'FRIDGE' location,
        // it means the items were spoiled/lost inside the storage and never checked out.
        // Therefore, we must deduct them from the fridge balance.
        levels[t.skuId].out += t.quantityPieces;
      }
    });

    // Calculate Balance
    Object.keys(levels).forEach(skuId => {
      levels[skuId].balance = levels[skuId].in - levels[skuId].out;
    });

    return levels;
  }, [skus, transactions]);

  // Memoize checkouts for the selected date to optimize list rendering
  const checkoutQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.type === TransactionType.CHECK_OUT && t.date === date) {
        map[t.skuId] = (map[t.skuId] || 0) + t.quantityPieces;
      }
    });
    return map;
  }, [transactions, date]);

  const handleInputChange = (skuId: string, field: 'packets' | 'loose', value: string) => {
    setInputs(prev => ({
      ...prev,
      [skuId]: {
        ...prev[skuId],
        [field]: value
      }
    }));
  };

  const getCalculatedTotal = (skuId: string, packetSize: number) => {
    const packets = parseInt(inputs[skuId]?.packets || '0');
    const loose = parseInt(inputs[skuId]?.loose || '0');
    return (isNaN(packets) ? 0 : packets) * packetSize + (isNaN(loose) ? 0 : loose);
  };

  const handleRestockPreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setIsRestockConfirmOpen(true);
  };

  const confirmRestock = () => {
    const transactionsToSave: any[] = [];

    skus.forEach(sku => {
      const totalPieces = getCalculatedTotal(sku.id, sku.piecesPerPacket);
      if (totalPieces > 0) {
        transactionsToSave.push({
          date,
          branchId: 'FRIDGE', // System ID for main storage
          skuId: sku.id,
          type: TransactionType.RESTOCK,
          quantityPieces: totalPieces,
          userId: currentUser?.id,
          userName: currentUser?.name
        });
      }
    });

    if (transactionsToSave.length > 0) {
      addBatchTransactions(transactionsToSave);
      setSuccessMsg(`Successfully added stock for ${transactionsToSave.length} items.`);
      setInputs({});
      setIsRestockConfirmOpen(false);
      setTimeout(() => {
        setSuccessMsg('');
        setActiveTab('view'); // Switch back to view after adding
      }, 1500);
    } else {
      setIsRestockConfirmOpen(false); // No items to save
    }
  };

  const calculateDiscrepancies = () => {
    const discrepancies: any[] = [];
    skus.forEach(sku => {
      let systemStock = stockLevels[sku.id]?.balance || 0;

      if (ignoreCheckouts) {
        systemStock += (checkoutQtyMap[sku.id] || 0);
      }

      // Get physical count from inputs
      const physicalPackets = parseInt(inputs[sku.id]?.packets || '0');
      const physicalLoose = parseInt(inputs[sku.id]?.loose || '0');

      const hasEntry = inputs[sku.id]?.packets !== undefined || inputs[sku.id]?.loose !== undefined;

      if (hasEntry) {
        const physicalTotal = (isNaN(physicalPackets) ? 0 : physicalPackets) * sku.piecesPerPacket + (isNaN(physicalLoose) ? 0 : physicalLoose);
        const diff = physicalTotal - systemStock;

        if (diff !== 0) {
          discrepancies.push({
            sku,
            systemStock,
            physicalTotal,
            diff
          });
        }
      }
    });
    return discrepancies;
  };

  const handleStocktakeSubmit = () => {
    // When submitting, we calculate discrepancies based on the CURRENT VIEW (which might have ignoreCheckouts ON)
    // OR should we ALWAYS save based on TRUE system stock?
    // If ignoreCheckouts is ON, "systemStock" is artificially high.
    // If user enters matching physical count (Total), variance is 0.
    // If we verify, we don't need to adjust anything if variance is 0.
    // However, calculateDiscrepancies() uses the "systemStock" variable.
    // We need to pass the ignoreCheckouts flag to calculateDiscrepancies effectively or update that function.

    // Actually, calculateDiscrepancies accesses `stockLevels` directly. 
    // We should update calculateDiscrepancies to respect the toggle.
    const discrepancies = calculateDiscrepancies();

    const transactionsToSave: any[] = [];
    discrepancies.forEach(d => {
      transactionsToSave.push({
        date,
        branchId: 'FRIDGE',
        skuId: d.sku.id,
        type: TransactionType.ADJUSTMENT,
        quantityPieces: d.diff,
        userId: currentUser?.id,
        userName: currentUser?.name
      });
    });

    if (transactionsToSave.length > 0) {
      addBatchTransactions(transactionsToSave);
      setSuccessMsg(`Inventory corrected. ${transactionsToSave.length} adjustments logged.`);
    } else {
      setSuccessMsg('No discrepancies found. Inventory matches system.');
    }

    setIsReviewOpen(false);
    setInputs({});
    setTimeout(() => {
      setSuccessMsg('');
      setActiveTab('view');
    }, 2000);
  };

  const getCategoryBadgeStyle = (category: SKUCategory) => {
    switch (category) {
      case SKUCategory.STEAM: return 'bg-blue-50 text-blue-700 border-blue-200';
      case SKUCategory.KURKURE: return 'bg-amber-50 text-amber-700 border-amber-200';
      case SKUCategory.WHEAT: return 'bg-orange-50 text-orange-700 border-orange-200';
      case SKUCategory.ROLL: return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="pb-16 relative">
      {/* Header */}
      <div className="mb-8 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Snowflake className="text-violet-600" /> Deep Freezer Stock
          </h2>
          <p className="text-slate-500 mt-1">Manage central stock, track levels, and reconcile inventory.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto">
          <button
            onClick={() => setActiveTab('view')}
            className={`px-4 md:px-6 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'view'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            Stock Overview
          </button>
          <button
            onClick={() => setActiveTab('restock')}
            className={`px-4 md:px-6 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'restock'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-violet-600'
              }`}
          >
            <PackagePlus size={16} /> Add Stock
          </button>
          <button
            onClick={() => setActiveTab('stocktake')}
            className={`px-4 md:px-6 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'stocktake'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-slate-500 hover:text-amber-600'
              }`}
          >
            <ClipboardCheck size={16} /> Inventory Check
          </button>
        </div>
      </div>

      {activeTab === 'view' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/3">Product Details</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Available Stock</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right hidden sm:table-cell">Unit Breakdown</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right hidden md:table-cell">Movement Stats</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {skus.map(sku => {
                  const stats = stockLevels[sku.id];
                  const packetSize = sku.piecesPerPacket;
                  const balancePackets = Math.floor(stats.balance / packetSize);
                  const balanceLoose = stats.balance % packetSize;

                  const isLowStock = stats.balance < (packetSize * 10);
                  const isCritical = stats.balance < (packetSize * 2);

                  return (
                    <tr key={sku.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700 text-base">{sku.name}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase ${getCategoryBadgeStyle(sku.category)}`}>
                              {sku.category}
                            </span>
                            {isLowStock && (
                              <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isCritical ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                <AlertCircle size={10} /> {isCritical ? 'CRITICAL' : 'LOW'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`text-2xl font-mono font-bold ${stats.balance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                            {stats.balance.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">total pieces</span>
                        </div>
                      </td>

                      <td className="p-4 text-right hidden sm:table-cell">
                        <div className="inline-flex flex-col items-end gap-1">
                          <div className="bg-slate-100 px-2 py-1 rounded text-sm font-medium text-slate-700 flex items-center gap-1.5">
                            <Box size={14} className="text-slate-400" />
                            {balancePackets} pkts
                          </div>
                          {balanceLoose !== 0 && (
                            <span className="text-xs text-slate-500 font-medium">
                              + {balanceLoose} loose
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 text-right hidden md:table-cell">
                        <div className="flex flex-col items-end gap-1 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            Total In: <span className="font-semibold text-slate-900">{stats.in}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            Out/Out: <span className="font-semibold text-emerald-600">{stats.out}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'restock' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
          <div className="p-4 bg-violet-50 border-b border-violet-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-lg text-violet-600 shadow-sm">
                <PackagePlus size={20} />
              </div>
              <div>
                <h3 className="font-bold text-violet-900">Incoming Stock Entry</h3>
                <p className="text-xs text-violet-600 hidden sm:block">Record stock arriving from suppliers.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-violet-800 uppercase">Date:</label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="border border-violet-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none bg-white text-slate-700"
              />
            </div>
          </div>

          <form onSubmit={handleRestockPreSubmit}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/3">Product</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-32">New Packets</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-32">Loose Pcs</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right w-32">Total Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {skus.map(sku => {
                    const total = getCalculatedTotal(sku.id, sku.piecesPerPacket);
                    const hasValue = total > 0;

                    return (
                      <tr key={sku.id} className={`transition-colors ${hasValue ? 'bg-violet-50/30' : 'hover:bg-slate-50'}`}>
                        <td className="p-4">
                          <div className="font-medium text-slate-700">{sku.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{sku.piecesPerPacket} pcs/pkt</div>
                        </td>
                        <td className="p-3">
                          <div className="relative max-w-[100px] mx-auto">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={inputs[sku.id]?.packets || ''}
                              onChange={(e) => handleInputChange(sku.id, 'packets', e.target.value)}
                              className={`w-full text-center border rounded-lg h-9 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 ${hasValue ? 'border-violet-300 bg-white' : 'border-slate-200'}`}
                            />
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="relative max-w-[100px] mx-auto">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={inputs[sku.id]?.loose || ''}
                              onChange={(e) => handleInputChange(sku.id, 'loose', e.target.value)}
                              className={`w-full text-center border rounded-lg h-9 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 ${hasValue ? 'border-violet-300 bg-white' : 'border-slate-200'}`}
                            />
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`font-mono font-bold ${hasValue ? 'text-violet-700' : 'text-slate-300'}`}>
                            {total > 0 ? `+${total}` : '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 sticky bottom-0 z-10 flex justify-end">
              <button
                type="submit"
                className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-xl font-bold shadow-md transition-all flex items-center gap-2 transform active:scale-95"
              >
                <PackagePlus size={18} />
                Review & Save
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'stocktake' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
          <div className="p-4 bg-amber-50 border-b border-amber-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-lg text-amber-600 shadow-sm">
                <ClipboardCheck size={20} />
              </div>
              <div>
                <h3 className="font-bold text-amber-900">Inventory Check</h3>
                <p className="text-xs text-amber-700 hidden sm:block">Count physical stock and reconcile discrepancies.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
              {ignoreCheckouts && (
                <div className="px-3 py-1.5 bg-amber-100/50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-1.5 animate-fade-in">
                  <AlertTriangle size={12} />
                  <span>Adding back today's checkout stock</span>
                </div>
              )}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <label htmlFor="ignoreCheckouts" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                  Ignore Today's Checkout
                </label>
                <div
                  onClick={() => setIgnoreCheckouts(!ignoreCheckouts)}
                  className={`w-9 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${ignoreCheckouts ? 'bg-amber-500' : 'bg-slate-300'}`}
                >
                  <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-sm transform transition-transform ${ignoreCheckouts ? 'translate-x-3.5' : 'translate-x-0'}`} />
                </div>
              </div>

              {appSettings?.enable_debug_inventory && (
                <button
                  onClick={() => setIsDebugOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  DEBUG
                </button>
              )}

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-amber-800 uppercase">Audit Date:</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="border border-amber-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/4">Product</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-24">System Qty</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-32">Count Packets</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-32">Count Loose</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right w-24">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {skus.map(sku => {
                  let systemStock = stockLevels[sku.id]?.balance || 0;

                  // Adjustment logic for "Ignore Today's Checkout"
                  if (ignoreCheckouts) {
                    systemStock += (checkoutQtyMap[sku.id] || 0);
                  }
                  const physicalPackets = parseInt(inputs[sku.id]?.packets || '0');
                  const physicalLoose = parseInt(inputs[sku.id]?.loose || '0');

                  const hasEntry = inputs[sku.id]?.packets !== undefined || inputs[sku.id]?.loose !== undefined;

                  let variance = 0;
                  if (hasEntry) {
                    const physicalTotal = (isNaN(physicalPackets) ? 0 : physicalPackets) * sku.piecesPerPacket + (isNaN(physicalLoose) ? 0 : physicalLoose);
                    variance = physicalTotal - systemStock;
                  }

                  return (
                    <tr key={sku.id} className={`transition-colors ${hasEntry ? 'bg-amber-50/30' : 'hover:bg-slate-50'}`}>
                      <td className="p-4">
                        <div className="font-medium text-slate-700">{sku.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{sku.piecesPerPacket} pcs/pkt</div>
                      </td>
                      <td className="p-4 text-center text-slate-500 font-mono">
                        {systemStock}
                      </td>
                      <td className="p-3">
                        <div className="relative max-w-[100px] mx-auto">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={inputs[sku.id]?.packets || ''}
                            onChange={(e) => handleInputChange(sku.id, 'packets', e.target.value)}
                            className={`w-full text-center border rounded-lg h-9 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${hasEntry ? 'border-amber-300 bg-white' : 'border-slate-200'}`}
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="relative max-w-[100px] mx-auto">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={inputs[sku.id]?.loose || ''}
                            onChange={(e) => handleInputChange(sku.id, 'loose', e.target.value)}
                            className={`w-full text-center border rounded-lg h-9 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${hasEntry ? 'border-amber-300 bg-white' : 'border-slate-200'}`}
                          />
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        {hasEntry ? (
                          <span className={`font-mono font-bold ${variance === 0 ? 'text-slate-300' : (variance < 0 ? 'text-red-600' : 'text-emerald-600')}`}>
                            {variance > 0 ? '+' : ''}{variance}
                          </span>
                        ) : (
                          <span className="text-slate-200">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50 sticky bottom-0 z-10 flex justify-end">
            <button
              type="button"
              onClick={() => setIsReviewOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-xl font-bold shadow-md transition-all flex items-center gap-2 transform active:scale-95"
            >
              <ClipboardCheck size={18} />
              Review Differences
            </button>
          </div>
        </div>
      )}

      {/* Restock Confirmation Modal */}
      {isRestockConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center rounded-t-xl bg-violet-50">
              <h3 className="text-lg font-bold text-violet-900">Confirm Restock</h3>
              <button onClick={() => setIsRestockConfirmOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-4">You are about to add stock to the deep freezer inventory.</p>
              <div className="bg-violet-50 p-3 rounded-lg border border-violet-100 mb-4">
                <div className="text-xs font-bold text-violet-800 uppercase mb-2">Summary</div>
                <ul className="text-sm space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                  {skus.map(sku => {
                    const total = getCalculatedTotal(sku.id, sku.piecesPerPacket);
                    if (total === 0) return null;
                    return (
                      <li key={sku.id} className="flex justify-between">
                        <span>{sku.name}</span>
                        <span className="font-bold">+{total} pcs</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsRestockConfirmOpen(false)} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-medium">Cancel</button>
                <button onClick={confirmRestock} className="flex-1 py-2.5 rounded-lg bg-violet-600 text-white font-bold hover:bg-violet-700">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stocktake Review Modal */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center rounded-t-xl bg-amber-50">
              <div>
                <h3 className="text-lg font-bold text-amber-900">Review Inventory Adjustments</h3>
                <p className="text-xs text-amber-700">These changes will be logged as 'Stock Adjustment'.</p>
              </div>
              <button onClick={() => setIsReviewOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {calculateDiscrepancies().length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
                  <h4 className="text-lg font-bold text-slate-800">Perfect Match!</h4>
                  <p className="text-slate-500">Physical count matches system inventory exactly.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {calculateDiscrepancies().map((d: any) => (
                    <div key={d.sku.id} className="flex justify-between items-center p-3 rounded-lg border bg-white border-slate-200">
                      <div>
                        <div className="font-bold text-slate-700">{d.sku.name}</div>
                        <div className="text-xs text-slate-500">
                          System: {d.systemStock} → Count: {d.physicalTotal}
                        </div>
                      </div>
                      <div className={`font-mono font-bold ${d.diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {d.diff > 0 ? '+' : ''}{d.diff}
                      </div>
                    </div>
                  ))}
                  <div className="mt-4 p-3 bg-red-50 rounded-lg text-xs text-red-700 flex items-start gap-2">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    <p>Confirming this will update the system inventory to match your physical count. This cannot be undone.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setIsReviewOpen(false)}
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleStocktakeSubmit}
                className="px-6 py-2.5 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 shadow-sm transition-colors"
              >
                Confirm Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Modal */}
      {isDebugOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center rounded-t-xl bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                Inventory Calculation Debug
              </h3>
              <button onClick={() => setIsDebugOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-xs text-slate-500 mb-4 bg-slate-50 p-2 rounded border border-slate-200">
                <p><strong>Logic:</strong> If 'Ignore Today's Checkout' is ON, we add back quantities checked out on <code>{date}</code>.</p>
                <p>Currently Ignore Checkouts is: <strong>{ignoreCheckouts ? 'ON' : 'OFF'}</strong></p>
              </div>
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="p-2 border border-slate-200">SKU</th>
                    <th className="p-2 border border-slate-200 text-right">Base (Live)</th>
                    <th className="p-2 border border-slate-200 text-right">Checkout Addback</th>
                    <th className="p-2 border border-slate-200 text-right font-bold">Adjusted Total</th>
                  </tr>
                </thead>
                <tbody>
                  {skus.map(sku => {
                    const base = stockLevels[sku.id]?.balance || 0;
                    const checkoutQty = checkoutQtyMap[sku.id] || 0;

                    const adjusted = base + (ignoreCheckouts ? checkoutQty : 0);

                    return (
                      <tr key={sku.id} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-200 font-medium">{sku.name}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono">{base}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-amber-600">
                          {checkoutQty > 0 ? `+${checkoutQty}` : '-'}
                        </td>
                        <td className="p-2 border border-slate-200 text-right font-mono font-bold bg-slate-50">
                          {adjusted}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button onClick={() => setIsDebugOpen(false)} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold">Close Debug</button>
            </div>
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
    </div>
  );
};

export default Inventory;
