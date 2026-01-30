
import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { SalesPlatform, TransactionType, SKU, MenuItem, OrderItem, Transaction, Order } from '../types';
import { parseSalesReportImage } from '../services/geminiService';
import { getLocalISOString } from '../constants';
import {
    Scale, Camera, Loader2, Info, ShoppingCart, FileText,
    AlertCircle, Calendar, ChevronRight, ChevronLeft,
    TrendingDown, TrendingUp, Code2, Database, Share2, Utensils, Package, AlertTriangle, ListChecks, History, Eye, X, Search, ArrowRight, User
} from 'lucide-react';

const Reconciliation: React.FC = () => {
    const { branches, skus, salesRecords, addSalesRecords, deleteSalesRecordsForDate, transactions, orders, menuItems } = useStore();

    const today = getLocalISOString();
    const [dateMode, setDateMode] = useState<'SINGLE' | 'RANGE'>('SINGLE');
    const [startDate, setStartDate] = useState<string>(today);
    const [endDate, setEndDate] = useState<string>(today);
    const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
    const [activePlatform, setActivePlatform] = useState<SalesPlatform>('POS');

    // Debug State
    const [inspectSkuId, setInspectSkuId] = useState<string | null>(null);

    const [inputs, setInputs] = useState<Record<string, string>>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- DATE NAVIGATION ---
    const navigateDay = (direction: number) => {
        const current = new Date(startDate);
        current.setDate(current.getDate() + direction);
        const newDate = getLocalISOString(current);
        setStartDate(newDate);
        setEndDate(newDate);
    };

    const setPreset = (days: number) => {
        setDateMode('RANGE');
        const start = new Date();
        start.setDate(start.getDate() - (days - 1));
        setStartDate(getLocalISOString(start));
        setEndDate(today);
    };

    const getSkuName = (id: string) => skus.find(s => s.id === id)?.name || id;

    // --- RECONCILIATION ENGINE ---
    const auditGroups = useMemo(() => {
        const results: Record<string, {
            sku: SKU,
            physicalNetUsed: number,
            billedSold: number,
            reportedWaste: number,
            menuItemsInvolved: Record<string, { name: string, qty: number, variant: string }>,
            rawLogs: {
                txs: Transaction[],
                orders: { id: string, name: string, qty: number, customer?: string, time: number }[]
            }
        }> = {};

        skus.forEach(sku => {
            results[sku.id] = {
                sku,
                physicalNetUsed: 0,
                billedSold: 0,
                reportedWaste: 0,
                menuItemsInvolved: {},
                rawLogs: { txs: [], orders: [] }
            };
        });

        // 1. FILTER DATA
        const filteredTxs = transactions.filter(t => t.date >= startDate && t.date <= endDate && t.branchId === branchId);
        const filteredOrders = orders.filter(o => o.branchId === branchId && o.date >= startDate && o.date <= endDate);

        // 2. PROCESS PHYSICAL LOGS
        filteredTxs.forEach(t => {
            if (!results[t.skuId]) return;
            results[t.skuId].rawLogs.txs.push(t);
            if (t.type === TransactionType.CHECK_OUT) {
                results[t.skuId].physicalNetUsed += t.quantityPieces;
            } else if (t.type === TransactionType.CHECK_IN) {
                results[t.skuId].physicalNetUsed -= t.quantityPieces;
            } else if (t.type === TransactionType.WASTE) {
                results[t.skuId].reportedWaste += t.quantityPieces;
            }
        });

        // 3. PROCESS SALES LOGS
        filteredOrders.forEach(order => {
            // Move processIng up to order scope so it can be used for both items and custom SKU items
            // Fix: resolve "Cannot find name 'processIng'" error by defining it in the correct scope
            const processIng = (skuId: string, qty: number, itemName: string, menuItemId: string, variant: string, itemQuantity: number) => {
                if (results[skuId]) {
                    results[skuId].billedSold += qty;
                    results[skuId].rawLogs.orders.push({
                        id: order.id,
                        name: itemName,
                        qty: qty,
                        customer: order.customerName,
                        time: order.timestamp
                    });
                    const menuKey = `${menuItemId}-${variant}`;
                    if (!results[skuId].menuItemsInvolved[menuKey]) {
                        results[skuId].menuItemsInvolved[menuKey] = { name: itemName, qty: 0, variant: variant };
                    }
                    results[skuId].menuItemsInvolved[menuKey].qty += itemQuantity;
                }
            };

            order.items.forEach(item => {
                const variant = item.variant || 'FULL';
                const anyItem = item as any; // Cast to any to access 'plate'

                // 1. Check 'plate' (Legacy direct link)
                if (anyItem.plate && anyItem.plate.skuId) {
                    processIng(anyItem.plate.skuId, anyItem.plate.quantity, item.name, item.menuItemId, variant, item.quantity);
                }
                // 2. Check 'consumed' (Array or Object)
                else if (item.consumed) {
                    const consumedArray = Array.isArray(item.consumed) ? item.consumed : [item.consumed];
                    consumedArray.forEach(c => processIng(c.skuId, c.quantity, item.name, item.menuItemId, variant, item.quantity));
                }
                // 3. Fallback to Menu Definitions
                else {
                    const menu = menuItems.find(m => m.id === item.menuItemId);
                    if (menu) {
                        const ingredients = (variant === 'HALF' && menu.halfIngredients && menu.halfIngredients.length > 0)
                            ? menu.halfIngredients
                            : (variant === 'HALF' ? menu.ingredients.map(i => ({ ...i, quantity: i.quantity * 0.5 })) : menu.ingredients);
                        ingredients.forEach(ing => processIng(ing.skuId, ing.quantity * item.quantity, item.name, item.menuItemId, variant, item.quantity));
                    }
                }
            });

            // Fix: processIng is now available here to handle custom SKU items consumption
            order.customSkuItems?.forEach(cs => {
                const skuName = getSkuName(cs.skuId);
                processIng(cs.skuId, cs.quantity, `Custom: ${skuName}`, 'custom', 'FULL', 1);
            });
        });

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

    const activeAuditItem = useMemo(() => {
        return auditGroups.find(g => g.sku.id === inspectSkuId);
    }, [auditGroups, inspectSkuId]);

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
                        setInputs(prev => {
                            const newInputs = { ...prev };
                            Object.entries(parsedData).forEach(([skuId, qty]) => {
                                newInputs[skuId] = (parseInt(newInputs[skuId] || '0') + Number(qty)).toString();
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

    return (
        <div className="pb-16 max-w-7xl mx-auto space-y-6">
            {/* Header & Mode Selector */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Scale className="text-indigo-600" /> Reconciliation Audit
                    </h2>
                    <p className="text-slate-500">Cross-verify physical stock movements with billed sales records.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button onClick={() => setDateMode('SINGLE')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${dateMode === 'SINGLE' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Daily View</button>
                        <button onClick={() => setDateMode('RANGE')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${dateMode === 'RANGE' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Date Range</button>
                    </div>

                    {dateMode === 'RANGE' && (
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button onClick={() => setPreset(7)} className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800">7D</button>
                            <button onClick={() => setPreset(30)} className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800">30D</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Date Navigation Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <label className="text-[10px] text-slate-400 font-bold uppercase">Location:</label>
                    <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm font-bold text-slate-700 bg-slate-50">
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    {dateMode === 'SINGLE' ? (
                        <div className="flex items-center gap-4">
                            <button onClick={() => navigateDay(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"><ChevronLeft size={24} /></button>
                            <div className="text-center min-w-[140px]">
                                <div className="text-[10px] text-slate-400 font-bold uppercase">Auditing Day</div>
                                <div className="font-bold text-slate-800">{new Date(startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                            </div>
                            <button onClick={() => navigateDay(1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"><ChevronRight size={24} /></button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded-lg px-2 py-2 text-xs font-medium" />
                            <ArrowRight size={14} className="text-slate-300" />
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded-lg px-2 py-2 text-xs font-medium" />
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => { setStartDate(today); setEndDate(today); }} className="text-xs font-bold text-indigo-600 hover:underline">Go to Today</button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Physical Net Usage</p>
                    <h4 className="text-2xl font-mono font-bold text-slate-800">{Math.round(totals.totalPhysical)}</h4>
                    <p className="text-[9px] text-slate-400 mt-1">Total pieces that left the freezer</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Accounted (Sold+Waste)</p>
                    <h4 className="text-2xl font-mono font-bold text-indigo-600">{Math.round(totals.totalAccounted)}</h4>
                    <p className="text-[9px] text-slate-400 mt-1">Billed pieces + reported wastage</p>
                </div>
                <div className={`p-5 rounded-2xl border shadow-sm ${totals.diff < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${totals.diff < 0 ? 'text-red-500' : 'text-emerald-500'}`}>Missing Pieces</p>
                    <div className="flex items-center gap-2">
                        {totals.diff < 0 ? <TrendingDown size={20} className="text-red-500" /> : <TrendingUp size={20} className="text-emerald-500" />}
                        <h4 className={`text-2xl font-mono font-bold ${totals.diff < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {totals.diff > 0 ? '+' : ''}{Math.round(totals.diff)}
                        </h4>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">Net variance in raw units</p>
                </div>
                <div className="bg-slate-900 p-5 rounded-2xl shadow-lg text-white">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stock Integrity</p>
                    <h4 className={`text-2xl font-mono font-bold ${totals.accuracy < 98 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {totals.accuracy.toFixed(1)}%
                    </h4>
                    <p className="text-[9px] text-slate-500 mt-1">Goal: &gt; 98.0% Accuracy</p>
                </div>
            </div>

            {/* Main Reconciliation Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ListChecks size={20} className="text-slate-600" />
                        <h3 className="font-bold text-slate-800 text-sm">Inventory Verification (SKU Grouped)</h3>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-slate-400 bg-slate-50 uppercase font-bold border-b">
                            <tr>
                                <th className="p-4">Raw Material</th>
                                <th className="p-4 text-center">Billed (Units)</th>
                                <th className="p-4 text-center">Physical (Net)</th>
                                <th className="p-4 text-right">Variance / Audit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {auditGroups.map(group => {
                                const accounted = group.billedSold + group.reportedWaste;
                                const diff = accounted - group.physicalNetUsed;
                                const isLoss = diff < -0.1;

                                const matchingMenuItem = menuItems.find(m => m.ingredients.some(i => i.skuId === group.sku.id));
                                const piecesPerPlate = matchingMenuItem?.ingredients.find(i => i.skuId === group.sku.id)?.quantity || 10;
                                const missingPlates = isLoss ? Math.floor(Math.abs(diff) / piecesPerPlate) : 0;

                                return (
                                    <tr key={group.sku.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800">{group.sku.name}</div>
                                            <div className="text-[10px] text-slate-400 uppercase">{group.sku.category} • {group.sku.piecesPerPacket} pcs/pkt</div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="font-mono font-bold text-slate-800">{Math.round(accounted)}</div>
                                            <div className="text-[9px] text-slate-400">Sold: {Math.round(group.billedSold)} | Waste: {group.reportedWaste}</div>
                                        </td>
                                        <td className="p-4 text-center font-mono font-bold text-slate-500">
                                            {Math.round(group.physicalNetUsed)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                {isLoss ? (
                                                    <div className="text-right">
                                                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg border border-red-100">
                                                            -{Math.abs(Math.round(diff))} missing
                                                        </span>
                                                        {missingPlates > 0 && <div className="text-[9px] text-red-400 font-bold uppercase mt-1">≈ {missingPlates} PLATES</div>}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Balanced</span>
                                                )}
                                                <button
                                                    onClick={() => setInspectSkuId(group.sku.id)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                    title="Inspect Audit Logs"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {auditGroups.length === 0 && (
                                <tr><td colSpan={4} className="p-12 text-center text-slate-400 italic">No activity found for this location and date.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Audit Inspector Modal */}
            {inspectSkuId && activeAuditItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                            <div>
                                <div className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mb-1">Human-Readable Debug Audit</div>
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <Package className="text-slate-400" size={20} /> {activeAuditItem.sku.name}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">Audit Log for {startDate} {startDate !== endDate ? ` to ${endDate}` : ''}</p>
                            </div>
                            <button onClick={() => setInspectSkuId(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Physical Logs */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold"><Database size={16} /></div>
                                    <h4 className="font-bold text-slate-800 uppercase text-xs tracking-wider">Physical Log Entries</h4>
                                </div>
                                <div className="space-y-2">
                                    {activeAuditItem.rawLogs.txs.map(tx => (
                                        <div key={tx.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center group">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${tx.type === TransactionType.CHECK_OUT ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                                                        }`}>
                                                        {tx.type === TransactionType.CHECK_OUT ? 'Out' : 'Return'}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-700">{tx.userName || 'Unknown User'}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><History size={10} /> {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </div>
                                            <div className={`font-mono font-bold ${tx.type === TransactionType.CHECK_OUT ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                {tx.type === TransactionType.CHECK_OUT ? '+' : '-'}{tx.quantityPieces} <span className="text-[10px] font-sans">pcs</span>
                                            </div>
                                        </div>
                                    ))}
                                    {activeAuditItem.rawLogs.txs.length === 0 && <p className="text-sm text-slate-400 italic">No physical transactions recorded.</p>}
                                </div>
                            </div>

                            {/* Billed Logs */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold"><ShoppingCart size={16} /></div>
                                    <h4 className="font-bold text-slate-800 uppercase text-xs tracking-wider">Sales Consumption Logs</h4>
                                </div>
                                <div className="space-y-2">
                                    {activeAuditItem.rawLogs.orders.map((ord, idx) => (
                                        <div key={`${ord.id}-${idx}`} className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center hover:border-indigo-300 transition-colors">
                                            <div>
                                                <div className="font-bold text-slate-800 text-xs">{ord.name}</div>
                                                <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                    <User size={10} /> {ord.customer || 'Walk-in'} • <History size={10} /> {new Date(ord.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            <div className="font-mono font-bold text-indigo-600">
                                                {ord.qty} <span className="text-[10px] font-sans">pcs</span>
                                            </div>
                                        </div>
                                    ))}
                                    {activeAuditItem.rawLogs.orders.length === 0 && <p className="text-sm text-slate-400 italic">No billed consumption recorded.</p>}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-900 text-white flex justify-between items-center border-t border-slate-800">
                            <div className="flex gap-8">
                                <div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Audit Total Out</div>
                                    <div className="text-xl font-mono font-bold text-emerald-400">{Math.round(activeAuditItem.physicalNetUsed)} <span className="text-xs">pcs</span></div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Audit Total Billed</div>
                                    <div className="text-xl font-mono font-bold text-indigo-400">{Math.round(activeAuditItem.billedSold + activeAuditItem.reportedWaste)} <span className="text-xs">pcs</span></div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Net Outcome</div>
                                <div className={`text-xl font-mono font-bold ${activeAuditItem.billedSold + activeAuditItem.reportedWaste - activeAuditItem.physicalNetUsed < -0.1 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {Math.round(activeAuditItem.billedSold + activeAuditItem.reportedWaste - activeAuditItem.physicalNetUsed)} <span className="text-xs">variance</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Logic Guide */}
            <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl p-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400"><Code2 size={24} /></div>
                    <div>
                        <h3 className="font-bold text-white text-lg">Reconciliation Formula</h3>
                        <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                            The dashboard calculates variance using: <code className="text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">(Billed Sales + Reported Waste) - (CheckOuts - Returns)</code>.
                            <br /><br />
                            If the resulting number is negative, it means pieces left the fridge but were neither billed to a customer nor reported as waste by the staff.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reconciliation;
