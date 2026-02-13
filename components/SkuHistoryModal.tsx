import React, { useState, useMemo } from 'react';
import { X, Calendar, Package, ArrowUpRight, ArrowDownLeft, Trash2, ShoppingBag, History, RotateCcw } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { SKU, TransactionType } from '../types';

interface SkuHistoryModalProps {
    sku: SKU | null;
    isOpen: boolean;
    onClose: () => void;
}

type Tab = 'INVENTORY' | 'CONSUMPTION';

const SkuHistoryModal: React.FC<SkuHistoryModalProps> = ({ sku, isOpen, onClose }) => {
    const { transactions, orders, users } = useStore();
    const [activeTab, setActiveTab] = useState<Tab>('INVENTORY');

    // 1. Inventory History (Transactions)
    // All hooks must be called before any early returns (React rules of hooks)
    const inventoryHistory = useMemo(() => {
        if (!sku) return [];
        return transactions
            .filter(t => t.skuId === sku.id)
            .sort((a, b) => b.timestamp - a.timestamp)
            .map(t => {
                const user = users.find(u => u.id === t.userId);
                return {
                    ...t,
                    userName: user ? user.name : (t.userName || 'Unknown')
                };
            });
    }, [transactions, sku?.id, users]);

    // 2. Consumption History (Orders)
    const consumptionHistory = useMemo(() => {
        if (!sku) return [];
        const history: { date: string; orderId: string; quantity: number; orderTotal: number; time: string }[] = [];

        orders.forEach(order => {
            let consumedQty = 0;

            // Check direct consumption in items
            if (order.items) {
                order.items.forEach(item => {
                    if (item.consumed) {
                        item.consumed.forEach(c => {
                            if (c.skuId === sku.id) consumedQty += c.quantity;
                        });
                    }
                });
            }

            // Check custom SKU items
            if (order.customSkuItems) {
                order.customSkuItems.forEach(c => {
                    if (c.skuId === sku.id) consumedQty += c.quantity;
                });
            }

            if (consumedQty > 0) {
                history.push({
                    date: order.date,
                    orderId: order.id,
                    quantity: consumedQty,
                    orderTotal: order.totalAmount,
                    time: new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }
        });

        return history.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
    }, [orders, sku?.id]);

    // Early return AFTER all hooks
    if (!isOpen || !sku) return null;

    const getTransactionIcon = (type: TransactionType) => {
        switch (type) {
            case TransactionType.RESTOCK: return <ArrowDownLeft className="text-emerald-500" size={18} />;
            case TransactionType.CHECK_IN: return <RotateCcw className="text-blue-500" size={18} />;
            case TransactionType.CHECK_OUT: return <ArrowUpRight className="text-amber-500" size={18} />;
            case TransactionType.WASTE: return <Trash2 className="text-red-500" size={18} />;
            case TransactionType.ADJUSTMENT: return <History className="text-slate-500" size={18} />; // Generic icon for adjustment
            default: return <Package size={18} />;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Package className="text-indigo-600" size={20} />
                            {sku.name}
                        </h2>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
                            {sku.category} • {sku.dietary}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 shrink-0">
                    <button
                        onClick={() => setActiveTab('INVENTORY')}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'INVENTORY' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                    >
                        Inventory Log
                    </button>
                    <button
                        onClick={() => setActiveTab('CONSUMPTION')}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'CONSUMPTION' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                    >
                        Daily Consumption
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-4">
                    {activeTab === 'INVENTORY' && (
                        <div className="space-y-3">
                            {inventoryHistory.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <Package size={48} className="mx-auto mb-2 opacity-20" />
                                    <p>No inventory history found</p>
                                </div>
                            ) : (
                                inventoryHistory.map(t => (
                                    <div key={t.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm hover:border-slate-300 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg bg-slate-50 border border-slate-100`}>
                                                {getTransactionIcon(t.type)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-700 text-sm">{t.type.replace('_', ' ')}</p>
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(t.timestamp).toLocaleDateString()}</span>
                                                    <span>•</span>
                                                    <span>{t.userName}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`font-mono font-bold text-lg ${t.type === TransactionType.RESTOCK || t.type === TransactionType.CHECK_IN || (t.type === TransactionType.ADJUSTMENT && t.quantityPieces > 0)
                                            ? 'text-emerald-600' : 'text-slate-700'
                                            } ${t.type === TransactionType.WASTE ? 'text-red-500' : ''
                                            } ${t.type === TransactionType.CHECK_OUT ? 'text-amber-600' : ''
                                            }`}>
                                            {t.type === TransactionType.CHECK_OUT || t.type === TransactionType.WASTE ? '-' : '+'}{Math.abs(t.quantityPieces)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'CONSUMPTION' && (
                        <div className="space-y-3">
                            {consumptionHistory.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <ShoppingBag size={48} className="mx-auto mb-2 opacity-20" />
                                    <p>No consumption history found</p>
                                </div>
                            ) : (
                                consumptionHistory.map((item, idx) => (
                                    <div key={`${item.orderId}-${idx}`} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm hover:border-slate-300 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                                                <ShoppingBag size={18} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-700 text-sm">Sale (Order #{item.orderId.slice(-4)})</p>
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(item.date).toLocaleDateString()} {item.time}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="font-mono font-bold text-lg text-slate-700">
                                            {item.quantity} <span className="text-xs text-slate-400 font-sans font-normal">pcs</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SkuHistoryModal;
