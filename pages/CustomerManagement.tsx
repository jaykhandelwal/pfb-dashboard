
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Contact, Search, Crown, Phone, Calendar, IndianRupee, History, X, Clock, ShoppingBag, Gift } from 'lucide-react';
import { Customer } from '../types';

const CustomerManagement: React.FC = () => {
  const { customers, membershipRules, orders, skus, branches, customerCoupons } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Filtering
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phoneNumber.includes(searchQuery)
  );

  // Helper to determine customer tier/status based on order count
  const getCustomerTier = (count: number) => {
     if (count > 20) return { label: 'VIP', color: 'bg-purple-100 text-purple-700 border-purple-200' };
     if (count > 10) return { label: 'Regular', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
     return { label: 'New', color: 'bg-slate-100 text-slate-600 border-slate-200' };
  };

  // Helper to find next reward
  const getNextReward = (currentOrderCount: number) => {
    // Find rules with trigger count > current count
    const upcoming = membershipRules
      .filter(r => r.triggerOrderCount > currentOrderCount)
      .sort((a, b) => a.triggerOrderCount - b.triggerOrderCount);
    
    if (upcoming.length === 0) return "All rewards unlocked!";
    const next = upcoming[0];
    const ordersLeft = next.triggerOrderCount - currentOrderCount;
    return `${ordersLeft} orders away from ${next.description}`;
  };

  const getSkuName = (id: string) => skus.find(s => s.id === id)?.name || id;
  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name || 'Unknown Branch';

  // --- History Logic ---
  // Use Orders Table directly to show Menu Items instead of raw ingredients
  const customerHistory = useMemo(() => {
    if (!selectedCustomer) return [];
    return orders
        .filter(o => o.customerId === selectedCustomer.id)
        .sort((a,b) => b.timestamp - a.timestamp);
  }, [selectedCustomer, orders]);


  return (
    <div className="pb-16 relative">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Contact className="text-indigo-600" /> Customer Management
           </h2>
           <p className="text-slate-500">Track loyal customers and their lifetime value.</p>
        </div>
        
        {/* Search */}
        <div className="relative w-full md:w-80">
           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={18} />
           </div>
           <input 
              type="text" 
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
           />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                     <th className="p-4">Customer</th>
                     <th className="p-4">Contact</th>
                     <th className="p-4 text-center">Orders</th>
                     <th className="p-4 text-right">Lifetime Spend</th>
                     <th className="p-4">Next Reward</th>
                     <th className="p-4 text-center">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.length === 0 ? (
                     <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                           No customers found. Import orders from POS to populate this list.
                        </td>
                     </tr>
                  ) : (
                     filteredCustomers.map(customer => {
                        const tier = getCustomerTier(customer.orderCount);
                        return (
                           <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                                       {customer.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                       <div className="font-bold text-slate-800">{customer.name}</div>
                                       <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold uppercase ${tier.color}`}>
                                          {tier.label}
                                       </span>
                                    </div>
                                 </div>
                              </td>
                              <td className="p-4">
                                 <div className="flex flex-col text-sm">
                                    <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                                       <Phone size={14} className="text-slate-400" /> {customer.phoneNumber}
                                    </span>
                                    <span className="flex items-center gap-1.5 text-slate-500 text-xs mt-0.5">
                                       <Calendar size={12} /> Last: {customer.lastOrderDate || 'Never'}
                                    </span>
                                 </div>
                              </td>
                              <td className="p-4 text-center">
                                 <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-sm">
                                    {customer.orderCount}
                                 </span>
                              </td>
                              <td className="p-4 text-right">
                                 <div className="font-mono font-bold text-slate-800 flex items-center justify-end gap-0.5">
                                    <IndianRupee size={14} className="text-slate-400" />
                                    {customer.totalSpend.toLocaleString()}
                                 </div>
                              </td>
                              <td className="p-4">
                                 <div className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 inline-flex items-center gap-1">
                                    <Crown size={12} />
                                    {getNextReward(customer.orderCount)}
                                 </div>
                              </td>
                              <td className="p-4 text-center">
                                 <button 
                                    onClick={() => setSelectedCustomer(customer)}
                                    className="text-slate-500 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="View Order History"
                                 >
                                    <History size={18} />
                                 </button>
                              </td>
                           </tr>
                        );
                     })
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* --- Customer History Modal --- */}
      {selectedCustomer && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
               {/* Modal Header */}
               <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50 rounded-t-xl">
                  <div className="flex items-start gap-4">
                     <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                        {selectedCustomer.name.charAt(0).toUpperCase()}
                     </div>
                     <div>
                        <h3 className="text-xl font-bold text-slate-800">{selectedCustomer.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                           <span className="flex items-center gap-1"><Phone size={14}/> {selectedCustomer.phoneNumber}</span>
                           <span className="text-slate-300">|</span>
                           <span className="flex items-center gap-1"><IndianRupee size={14}/> Total Spend: {selectedCustomer.totalSpend}</span>
                        </div>
                     </div>
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-slate-600">
                     <X size={24} />
                  </button>
               </div>
               
               {/* Modal Body: History List */}
               <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Past Orders</h4>
                  
                  {customerHistory.length === 0 ? (
                     <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                        <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
                        <p>No order history found for this customer.</p>
                     </div>
                  ) : (
                     <div className="space-y-4">
                        {customerHistory.map(order => {
                           const usedCoupon = customerCoupons.find(c => c.redeemedOrderId === order.id);
                           return (
                           <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-50">
                                 <div>
                                    <div className="flex items-center gap-2">
                                       <span className="text-sm font-bold text-slate-700">{getBranchName(order.branchId)}</span>
                                       <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold uppercase">{order.platform}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                                       <Clock size={12} /> {new Date(order.timestamp).toLocaleString()}
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <span className="block font-mono font-bold text-slate-800 text-lg">₹{order.totalAmount}</span>
                                 </div>
                              </div>
                              
                              <ul className="space-y-1">
                                 {order.items.map((item, idx) => (
                                    <li key={idx} className="flex justify-between text-sm text-slate-600">
                                       <span className="flex-1">
                                          {item.name}
                                          {item.variant === 'HALF' && <span className="text-xs text-slate-400 ml-1">(Half)</span>}
                                       </span>
                                       <div className="flex gap-4">
                                          <span className="font-mono text-slate-400 text-xs">x {item.quantity}</span>
                                          <span className="font-bold text-slate-700 w-12 text-right">₹{item.price * item.quantity}</span>
                                       </div>
                                    </li>
                                 ))}
                              </ul>
                              
                              {(order.customAmount || (order.customSkuItems && order.customSkuItems.length > 0) || usedCoupon) && (
                                 <div className="mt-3 pt-2 border-t border-slate-50 text-xs text-slate-500">
                                    {order.customAmount && <div className="flex justify-between"><span>Custom Charge</span><span>₹{order.customAmount}</span></div>}
                                    {order.customSkuItems?.length && <div>+ {order.customSkuItems.length} raw items</div>}
                                    {usedCoupon && (
                                        <div className="flex justify-between items-center text-pink-600 font-bold mt-1">
                                            <span className="flex items-center gap-1"><Gift size={12}/> Coupon Used</span>
                                        </div>
                                    )}
                                 </div>
                              )}
                           </div>
                        )})}
                     </div>
                  )}
               </div>

               <div className="p-4 border-t border-slate-100 bg-white rounded-b-xl flex justify-end">
                  <button 
                     onClick={() => setSelectedCustomer(null)}
                     className="px-6 py-2 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors"
                  >
                     Close
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default CustomerManagement;
