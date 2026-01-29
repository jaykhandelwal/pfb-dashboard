
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Contact, Search, Crown, Phone, Calendar, IndianRupee, History, X, Clock, ShoppingBag, Gift, Ban, Users, Wallet, Trophy, Activity, TrendingUp, Sparkles, User } from 'lucide-react';
import { Customer } from '../types';
import { DUMMY_CUSTOMER_PHONE } from '../constants';
import CustomerDetailsModal from '../components/CustomerDetailsModal';

const CustomerManagement: React.FC = () => {
   const { customers, membershipRules, orders, skus, branches, customerCoupons } = useStore();
   const [searchQuery, setSearchQuery] = useState('');
   const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

   // --- Analytics Logic ---
   const stats = useMemo(() => {
      const totalCustomers = customers.length;
      // Exclude dummy account for stats that represent "real people" behavior
      const realCustomers = customers.filter(c => c.phoneNumber !== DUMMY_CUSTOMER_PHONE);

      // 1. Total Spend & Avg LTV
      const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpend, 0);
      const avgLTV = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

      // 2. Top 3 Spenders (Real People Only)
      const topSpenders = [...realCustomers]
         .sort((a, b) => b.totalSpend - a.totalSpend)
         .slice(0, 3);

      // 3. Active Recently (Last 30 Days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeCount = customers.filter(c => {
         if (!c.lastOrderDate) return false;
         return new Date(c.lastOrderDate) >= thirtyDaysAgo;
      }).length;

      return { totalCustomers, topSpenders, avgLTV, activeCount, realCount: realCustomers.length };
   }, [customers]);

   // Filtering
   const filteredCustomers = customers.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phoneNumber.includes(searchQuery)
   );

   // Helper to determine customer tier/status based on order count
   const getCustomerTier = (count: number, phone: string) => {
      if (phone === DUMMY_CUSTOMER_PHONE) return { label: 'System Account', color: 'bg-slate-200 text-slate-800 border-slate-300' };
      if (count > 20) return { label: 'VIP', color: 'bg-purple-100 text-purple-700 border-purple-200' };
      if (count > 10) return { label: 'Regular', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      return { label: 'New', color: 'bg-slate-100 text-slate-600 border-slate-200' };
   };

   // Helper to find next reward
   const getNextReward = (currentOrderCount: number, phone: string) => {
      if (phone === DUMMY_CUSTOMER_PHONE) return "Ineligible for rewards";

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


   return (
      <div className="pb-16 relative max-w-7xl mx-auto">
         <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
               <Contact className="text-indigo-600" /> Customer Management
            </h2>
            <p className="text-slate-500">Track loyal customers and insights.</p>
         </div>

         {/* --- Analytics Dashboard --- */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Card 1: Total Customers */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
               <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Database</p>
                  <h3 className="text-2xl font-bold text-slate-800">{stats.totalCustomers}</h3>
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                     <User size={10} /> {stats.realCount} unique registered profiles
                  </p>
               </div>
               <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                  <Users size={24} />
               </div>
            </div>

            {/* Card 2: Average LTV */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
               <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Avg. Lifetime Value</p>
                  <h3 className="text-2xl font-bold text-emerald-600 flex items-center gap-0.5">
                     <IndianRupee size={20} />{Math.round(stats.avgLTV).toLocaleString()}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">Avg revenue per customer</p>
               </div>
               <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                  <Wallet size={24} />
               </div>
            </div>

            {/* Card 3: Active Recently */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
               <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Active (30 Days)</p>
                  <h3 className="text-2xl font-bold text-indigo-600">{stats.activeCount}</h3>
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                     <TrendingUp size={10} /> Repeat customers this month
                  </p>
               </div>
               <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                  <Activity size={24} />
               </div>
            </div>

            {/* Card 4: Leaderboard */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-4 rounded-xl shadow-lg text-white flex flex-col justify-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-3 opacity-10">
                  <Trophy size={64} />
               </div>
               <div className="relative z-10">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                     <Crown size={12} className="text-amber-400" /> Top Loyal Spenders
                  </p>
                  <div className="space-y-2">
                     {stats.topSpenders.length > 0 ? stats.topSpenders.map((c, idx) => (
                        <div key={c.id} className="flex items-center justify-between text-xs">
                           <div className="flex items-center gap-2">
                              <span className={`font-bold w-4 ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : 'text-orange-400'}`}>#{idx + 1}</span>
                              <span className="font-medium truncate max-w-[100px]">{c.name}</span>
                           </div>
                           <span className="font-mono text-slate-300">₹{(c.totalSpend / 1000).toFixed(1)}k</span>
                        </div>
                     )) : (
                        <p className="text-xs text-slate-500 italic">Not enough data yet.</p>
                     )}
                  </div>
               </div>
            </div>
         </div>

         {/* --- Search & Filter Bar --- */}
         <div className="flex items-center justify-between gap-4 mb-4">
            <div className="relative w-full md:w-96">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search size={18} />
               </div>
               <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
               />
            </div>
            {/* Placeholder for future filters or export buttons */}
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
                           const isDummy = customer.phoneNumber === DUMMY_CUSTOMER_PHONE;
                           const tier = getCustomerTier(customer.orderCount, customer.phoneNumber);
                           return (
                              <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                                 <td className="p-4">
                                    <div className="flex items-center gap-3">
                                       <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isDummy ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                          {isDummy ? <Ban size={16} /> : customer.name.charAt(0).toUpperCase()}
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
                                       <span className={`flex items-center gap-1.5 font-medium ${isDummy ? 'text-slate-400' : 'text-slate-700'}`}>
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
                                    <div className={`text-xs font-medium px-2 py-1 rounded border inline-flex items-center gap-1 ${isDummy ? 'text-slate-400 bg-slate-50 border-slate-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>
                                       {isDummy ? <Ban size={12} /> : <Crown size={12} />}
                                       {getNextReward(customer.orderCount, customer.phoneNumber)}
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

         {/* --- Customer History Modal (Shared) --- */}
         {selectedCustomer && (
            <CustomerDetailsModal
               customer={selectedCustomer}
               onClose={() => setSelectedCustomer(null)}
            />
         )}
      </div>
   );
};

export default CustomerManagement;
