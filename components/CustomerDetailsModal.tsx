import React, { useEffect, useState, useMemo } from 'react';
import {
    X, Phone, IndianRupee, Clock, ShoppingBag,
    Gift, Crown, Ban, History, Activity, TrendingUp, BarChart3, Loader2, Store
} from 'lucide-react';
import { Customer, Order, MembershipRule } from '../types';
import { useStore } from '../context/StoreContext';
import { DUMMY_CUSTOMER_PHONE } from '../constants';

interface CustomerDetailsModalProps {
    customer: Customer;
    onClose: () => void;
}

const CustomerDetailsModal: React.FC<CustomerDetailsModalProps> = ({ customer, onClose }) => {
    const { fetchCustomerOrders, membershipRules, branches, customerCoupons } = useStore();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadOrders = async () => {
            setLoading(true);
            const data = await fetchCustomerOrders(customer.id);
            setOrders(data);
            setLoading(false);
        };
        loadOrders();
    }, [customer.id]);

    // --- STATS CALCULATIONS ---
    const stats = useMemo(() => {
        if (orders.length === 0) return { avgAOV: 0, mostOrdered: [] };

        const totalOrders = orders.length;
        const totalSpend = orders.reduce((sum, o) => sum + o.totalAmount, 0);
        const avgAOV = totalSpend / totalOrders;

        // Most Ordered Items frequency map
        const itemFreq: Record<string, { count: number, name: string }> = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                const key = `${item.menuItemId}-${item.variant || 'FULL'}`;
                if (!itemFreq[key]) {
                    itemFreq[key] = { count: 0, name: `${item.name}${item.variant === 'HALF' ? ' (Half)' : ''}` };
                }
                itemFreq[key].count += item.quantity;
            });
        });

        const mostOrdered = Object.values(itemFreq)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return { avgAOV, mostOrdered };
    }, [orders]);

    const getBranchName = (id: string) => branches.find(b => b.id === id)?.name || 'Unknown Branch';

    const getCustomerTier = (count: number, phone: string) => {
        if (phone === DUMMY_CUSTOMER_PHONE) return { label: 'System Account', color: 'bg-slate-200 text-slate-800 border-slate-300' };
        if (count > 20) return { label: 'VIP', color: 'bg-purple-100 text-purple-700 border-purple-200' };
        if (count > 10) return { label: 'Regular', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
        return { label: 'New', color: 'bg-slate-100 text-slate-600 border-slate-200' };
    };

    const getNextReward = (currentOrderCount: number, phone: string) => {
        if (phone === DUMMY_CUSTOMER_PHONE) return "Ineligible for rewards";
        const upcoming = membershipRules
            .filter(r => r.triggerOrderCount > currentOrderCount)
            .sort((a, b) => a.triggerOrderCount - b.triggerOrderCount);
        if (upcoming.length === 0) return "All rewards unlocked!";
        const next = upcoming[0];
        const ordersLeft = next.triggerOrderCount - currentOrderCount;
        return `${ordersLeft} orders away from ${next.description}`;
    };

    const tier = getCustomerTier(customer.orderCount, customer.phoneNumber);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                    <div className="flex items-start gap-4">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl shadow-sm ${customer.phoneNumber === DUMMY_CUSTOMER_PHONE ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white'}`}>
                            {customer.phoneNumber === DUMMY_CUSTOMER_PHONE ? <Ban size={28} /> : customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-2xl font-bold text-slate-800">{customer.name}</h3>
                                <span className={`text-[10px] px-2 py-1 rounded-full border font-bold uppercase ${tier.color}`}>
                                    {tier.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                                <span className="flex items-center gap-1.5"><Phone size={14} className="text-slate-400" /> {customer.phoneNumber}</span>
                                <span className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400" /> Joined: {new Date(customer.joinedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">
                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Spend</p>
                            <p className="text-xl font-bold text-slate-800 flex items-center gap-1">
                                <IndianRupee size={16} />{customer.totalSpend.toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Orders</p>
                            <p className="text-xl font-bold text-indigo-600">{customer.orderCount}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Avg Order</p>
                            <p className="text-xl font-bold text-emerald-600 flex items-center gap-1">
                                <IndianRupee size={16} />{Math.round(stats.avgAOV).toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rewards</p>
                            <p className="text-[10px] font-medium text-slate-600 leading-tight">{getNextReward(customer.orderCount, customer.phoneNumber)}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Most Ordered Items */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <BarChart3 size={16} className="text-indigo-500" /> Most Ordered
                            </h4>
                            {loading ? (
                                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-300" /></div>
                            ) : stats.mostOrdered.length > 0 ? (
                                <div className="space-y-3">
                                    {stats.mostOrdered.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600 font-medium truncate max-w-[150px]">{item.name}</span>
                                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-bold text-xs">{item.count} orders</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">No data available.</p>
                            )}
                        </div>

                        {/* Loyalty Badge */}
                        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-5 rounded-xl shadow-md text-white flex flex-col justify-center relative overflow-hidden">
                            <div className="absolute -right-4 -bottom-4 opacity-10">
                                <History size={100} />
                            </div>
                            <div className="relative z-10">
                                <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider mb-1">Loyalty Status</p>
                                <h4 className="text-xl font-bold flex items-center gap-2">
                                    <Crown size={20} className="text-amber-400" /> {tier.label} Member
                                </h4>
                                <p className="text-xs text-indigo-100 mt-2">
                                    {customer.orderCount >= 10 ? "Keep ordering to maintain your status!" : "Place more orders to unlock VIP rewards."}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Past Orders List */}
                    <div>
                        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <ShoppingBag size={16} className="text-emerald-500" /> Order History
                        </h4>
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <Loader2 size={32} className="animate-spin mb-2" />
                                <p className="text-sm">Loading orders...</p>
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                                <History size={48} className="mx-auto mb-2 opacity-20" />
                                <p>No order history found.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {orders.map(order => {
                                    const usedCoupon = customerCoupons.find(c => c.redeemedOrderId === order.id);
                                    return (
                                        <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-indigo-300 transition-all group">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-slate-700">{getBranchName(order.branchId)}</span>
                                                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold uppercase">{order.platform}</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">{new Date(order.timestamp).toLocaleString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-mono font-bold text-slate-800">₹{order.totalAmount}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{order.paymentMethod}</p>
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-500 line-clamp-1 group-hover:line-clamp-none transition-all">
                                                {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                                {usedCoupon && <span className="ml-2 text-pink-500 font-bold">• Coupon Used</span>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-md shadow-slate-200"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomerDetailsModal;
