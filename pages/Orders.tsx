import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { SalesPlatform } from '../types';
import { Receipt, Filter, Calendar, Store, Clock, UtensilsCrossed } from 'lucide-react';
import { getLocalISOString } from '../constants';

const Orders: React.FC = () => {
  const { salesRecords, skus, branches } = useStore();
  
  // Filters
  const [date, setDate] = useState<string>(getLocalISOString());
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');

  // Helpers
  const getSkuName = (id: string) => skus.find(s => s.id === id)?.name || id;
  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name || id;

  // Group items into "Orders" based on Timestamp + Branch + Platform
  // This assumes items arriving in the same batch (postMessage) or saved together share a timestamp.
  const orderTickets = useMemo(() => {
    const groups: Record<string, {
      ticketId: string,
      timestamp: number,
      date: string,
      branchId: string,
      platform: SalesPlatform,
      items: { skuName: string, qty: number }[],
      totalQty: number
    }> = {};

    salesRecords.forEach(record => {
      // Filter Logic
      if (record.date !== date) return;
      if (selectedBranch !== 'ALL' && record.branchId !== selectedBranch) return;
      if (selectedPlatform !== 'ALL' && record.platform !== selectedPlatform) return;

      // Grouping Key: Timestamp + Branch + Platform
      const key = `${record.timestamp}-${record.branchId}-${record.platform}`;

      if (!groups[key]) {
        groups[key] = {
          ticketId: key,
          timestamp: record.timestamp,
          date: record.date,
          branchId: record.branchId,
          platform: record.platform,
          items: [],
          totalQty: 0
        };
      }

      groups[key].items.push({
        skuName: getSkuName(record.skuId),
        qty: record.quantitySold
      });
      groups[key].totalQty += record.quantitySold;
    });

    // Sort by time descending (newest first)
    return Object.values(groups).sort((a, b) => b.timestamp - a.timestamp);
  }, [salesRecords, date, selectedBranch, selectedPlatform, skus]);

  // Platform Badge Logic
  const getPlatformStyle = (platform: SalesPlatform) => {
    switch (platform) {
      case 'POS': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ZOMATO': return 'bg-red-100 text-red-800 border-red-200';
      case 'SWIGGY': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="pb-10">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Receipt className="text-emerald-600" /> Order History
        </h2>
        <p className="text-slate-500">View live feed of POS and Online orders.</p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4">
         
         {/* Date */}
         <div className="flex-1">
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
               <Calendar size={12} /> Date
            </label>
            <input 
              type="date" 
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 font-medium"
            />
         </div>

         {/* Branch */}
         <div className="flex-1">
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
               <Store size={12} /> Branch
            </label>
            <select 
               value={selectedBranch}
               onChange={e => setSelectedBranch(e.target.value)}
               className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 bg-white"
            >
               <option value="ALL">All Branches</option>
               {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
         </div>

         {/* Platform */}
         <div className="flex-1">
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
               <Filter size={12} /> Platform
            </label>
            <select 
               value={selectedPlatform}
               onChange={e => setSelectedPlatform(e.target.value)}
               className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 bg-white"
            >
               <option value="ALL">All Platforms</option>
               <option value="POS">POS (In-Store)</option>
               <option value="ZOMATO">Zomato</option>
               <option value="SWIGGY">Swiggy</option>
            </select>
         </div>
      </div>

      {/* Order List */}
      {orderTickets.length === 0 ? (
         <div className="text-center py-12 text-slate-400">
            <Receipt size={48} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No orders found for this criteria.</p>
         </div>
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orderTickets.map(ticket => (
               <div key={ticket.ticketId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                  {/* Ticket Header */}
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                           <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getPlatformStyle(ticket.platform)}`}>
                              {ticket.platform}
                           </span>
                           <span className="text-xs text-slate-400 font-mono">
                              #{ticket.timestamp.toString().slice(-6)}
                           </span>
                        </div>
                        <div className="font-bold text-slate-700 text-sm">
                           {getBranchName(ticket.branchId)}
                        </div>
                     </div>
                     <div className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                        <Clock size={12} />
                        {new Date(ticket.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                     </div>
                  </div>

                  {/* Items */}
                  <div className="p-4 flex-1">
                     <ul className="space-y-2 text-sm">
                        {ticket.items.map((item, idx) => (
                           <li key={idx} className="flex justify-between items-start">
                              <span className="text-slate-700 font-medium">{item.skuName}</span>
                              <span className="font-mono text-slate-500">x {item.qty}</span>
                           </li>
                        ))}
                     </ul>
                  </div>

                  {/* Footer Total */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-sm">
                     <span className="text-slate-500 font-medium flex items-center gap-1">
                        <UtensilsCrossed size={14} /> Total Items
                     </span>
                     <span className="font-bold text-slate-800 text-lg">
                        {ticket.totalQty}
                     </span>
                  </div>
               </div>
            ))}
         </div>
      )}
    </div>
  );
};

export default Orders;