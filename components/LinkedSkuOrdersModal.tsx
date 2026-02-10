
import React, { useMemo } from 'react';
import { Order, MenuItem, SKU, SKUCategory } from '../types';
import { X, Receipt, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LinkedSkuOrdersModalProps {
    isOpen: boolean;
    onClose: () => void;
    sku: SKU | null;
    orders: Order[];
    menuItems: MenuItem[];
    date: string;
    branchId: string;
    inventorySoldQty: number; // The calculated "Sold" qty from the Operations popup
}

const LinkedSkuOrdersModal: React.FC<LinkedSkuOrdersModalProps> = ({
    isOpen, onClose, sku, orders, menuItems, date, branchId, inventorySoldQty
}) => {
    if (!isOpen || !sku) return null;

    // Filter relevant orders
    const relevantOrders = useMemo(() => {
        return orders.filter(o =>
            o.date === date &&
            o.branchId === branchId &&
            o.status !== 'CANCELLED'
        ).sort((a, b) => b.timestamp - a.timestamp);
    }, [orders, date, branchId]);

    // Calculate usage per order
    const orderDetails = useMemo(() => {
        const details: { order: Order; itemNames: string[]; totalSkuQty: number }[] = [];
        let totalPosQty = 0;

        relevantOrders.forEach(order => {
            let orderSkuQty = 0;
            const itemsUsingSku: string[] = [];

            order.items.forEach(orderItem => {
                let foundInSnapshot = false;
                const anyItem = orderItem as any; // Allow access to dynamic properties like 'plate'

                // 1. Check 'consumed' snapshot (Array or Object)
                if (anyItem.consumed) {
                    if (Array.isArray(anyItem.consumed)) {
                        // Array format
                        const match = anyItem.consumed.find((c: any) => c.skuId === sku.id);
                        if (match) {
                            // If consumed is recorded, it's usually the total deduction for this transaction item
                            // However, we must be careful: if OrderItem has qty 2, and consumed says 8, is it 8 total or 8 per unit?
                            // In this system's context, 'consumed' usually snapshots the TOTAL deduction.
                            orderSkuQty += match.quantity;
                            foundInSnapshot = true;
                        }
                    } else if (anyItem.consumed.skuId === sku.id) {
                        // Object format (from user JSON)
                        orderSkuQty += anyItem.consumed.quantity;
                        foundInSnapshot = true;
                    }
                }

                // 2. Check 'plate' snapshot (Legacy/Specific format from user JSON)
                if (!foundInSnapshot && anyItem.plate && anyItem.plate.skuId === sku.id) {
                    orderSkuQty += anyItem.plate.quantity * orderItem.quantity;
                    foundInSnapshot = true;
                }

                if (foundInSnapshot) {
                    itemsUsingSku.push(`${orderItem.quantity}x ${orderItem.name}`);
                    return; // Skip fallback
                }

                // 3. Fallback: Lookup in current Menu Items
                const menuItem = menuItems.find(m => m.id === orderItem.menuItemId);
                if (!menuItem) return;

                // Check ingredients (Full)
                if (orderItem.variant !== 'HALF') {
                    const ing = menuItem.ingredients.find(i => i.skuId === sku.id);
                    if (ing) {
                        const qty = ing.quantity * orderItem.quantity;
                        orderSkuQty += qty;
                        itemsUsingSku.push(`${orderItem.quantity}x ${orderItem.name}`);
                    }
                }
                // Check ingredients (Half)
                else {
                    const ingredients = menuItem.halfIngredients || menuItem.ingredients;
                    const ing = ingredients.find(i => i.skuId === sku.id);
                    if (ing) {
                        const qty = ing.quantity * orderItem.quantity;
                        orderSkuQty += qty;
                        itemsUsingSku.push(`${orderItem.quantity}x ${orderItem.name} (Half)`);
                    }
                }
            });

            // Check for Custom Items (if any linked to this SKU)
            if (order.customSkuItems) {
                const customEntry = order.customSkuItems.find(c => c.skuId === sku.id);
                if (customEntry) {
                    orderSkuQty += customEntry.quantity;
                    itemsUsingSku.push(`Custom: ${customEntry.quantity} qty`);
                }
            }

            if (orderSkuQty > 0) {
                totalPosQty += orderSkuQty;
                details.push({
                    order,
                    itemNames: itemsUsingSku,
                    totalSkuQty: orderSkuQty
                });
            }
        });

        return { list: details, totalPosQty };
    }, [relevantOrders, menuItems, sku]);

    const variance = inventorySoldQty - orderDetails.totalPosQty;
    const isExact = variance === 0;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">

                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl opacity-100">
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Receipt size={20} className="text-indigo-600" />
                            Linked Orders Analysis
                        </h3>
                        <p className="text-xs text-slate-500 font-mono mt-1">
                            {sku.name} • {new Date(date).toLocaleDateString()}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={24} className="text-slate-500" />
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="p-4 grid grid-cols-3 gap-4 bg-white shadow-sm z-10">
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-center">
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Inventory Sold</p>
                        <p className="text-2xl font-bold text-blue-900">{inventorySoldQty} <span className="text-sm font-normal text-blue-400">pcs</span></p>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-50 border border-purple-100 text-center">
                        <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">POS Ordered</p>
                        <p className="text-2xl font-bold text-purple-900">{orderDetails.totalPosQty} <span className="text-sm font-normal text-purple-400">pcs</span></p>
                    </div>
                    <div className={`p-3 rounded-lg border text-center ${isExact ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isExact ? 'text-emerald-600' : 'text-amber-600'}`}>Variance</p>
                        <p className={`text-2xl font-bold ${isExact ? 'text-emerald-900' : 'text-amber-900'}`}>
                            {variance > 0 ? `+${variance}` : variance}
                            <span className={`text-sm font-normal ml-1 ${isExact ? 'text-emerald-400' : 'text-amber-400'}`}>pcs</span>
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50">

                    {!isExact && (
                        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                            <div>
                                <span className="font-bold">Discrepancy Detected:</span>
                                {variance > 0
                                    ? ` You recorded ${variance} more pieces sold in Inventory than were punched in POS orders. May indicate un-punched orders or wastage.`
                                    : ` POS orders show ${Math.abs(variance)} more pieces than Inventory reduction. May indicate forgot to checkout items or incorrect recipe.`}
                            </div>
                        </div>
                    )}

                    {orderDetails.list.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Receipt size={48} className="mx-auto mb-3 opacity-20" />
                            <p>No linked POS orders found for this item.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Order Breakdown</h4>
                            {orderDetails.list.map(({ order, itemNames, totalSkuQty }) => (
                                <div key={order.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center group hover:border-indigo-300 transition-colors">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono text-xs font-bold text-slate-500">#{order.id.slice(-4)}</span>
                                            <span className="text-xs text-slate-400">•</span>
                                            <span className="text-xs font-bold text-slate-700">{order.customerName || 'Walk-in'}</span>
                                            <span className="text-xs text-slate-400">•</span>
                                            <span className="text-[10px] text-slate-400">{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="text-xs text-slate-600 leading-snug">
                                            {itemNames.join(', ')}
                                        </div>
                                    </div>
                                    <div className="text-right pl-4 border-l border-slate-100 ml-4 min-w-[3rem]">
                                        <span className="block font-bold text-lg text-indigo-900 leading-none">{totalSkuQty}</span>
                                        <span className="text-[9px] text-slate-400 uppercase font-bold">Used</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LinkedSkuOrdersModal;
