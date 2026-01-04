
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { DailyReportItem, TransactionType, Todo } from '../types';
import { StatCard } from '../components/StatCard';
import { TrendingUp, ShoppingBag, RotateCcw, Trash2, Sparkles, Store, Package, Activity, Scale, IndianRupee, Receipt, BarChart3, ChevronDown, Banknote, QrCode, Wallet, Table, CalendarDays, CheckSquare, Plus, X, User as UserIcon, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line, AreaChart, Area, LineChart } from 'recharts';
import { generateDailyInsights } from '../services/geminiService';
import { getLocalISOString } from '../constants';

// Updated palette for charts to match warm theme
const COLORS = ['#95a77c', '#6b7280', '#eab308', '#ef4444', '#8b5cf6', '#d97706'];

type TimeRange = 'TODAY' | 'YESTERDAY' | '7D' | '30D';

interface InventoryTileProps {
  skuName: string;
  quantity: number;
  piecesPerPacket: number;
  isLow?: boolean;
}

const InventoryTile: React.FC<InventoryTileProps> = ({ skuName, quantity, piecesPerPacket, isLow = false }) => {
  const packets = Math.floor(quantity / piecesPerPacket);
  const loose = quantity % piecesPerPacket;

  return (
    <div 
      className={`rounded-lg border p-2 flex flex-col justify-between transition-all hover:shadow-sm ${
        isLow ? 'bg-red-50 border-red-200' : 'bg-white border-[#403424]/10'
      }`}
    >
       <div className="mb-0.5">
          <h3 className={`font-bold text-xs leading-tight truncate ${isLow ? 'text-red-900' : 'text-[#403424]/80'}`}>
            {skuName}
          </h3>
       </div>
       
       <div className="flex items-end gap-2">
          <div className="flex items-baseline gap-1">
              <span className={`text-lg font-bold leading-none ${isLow ? 'text-red-600' : 'text-[#403424]'}`}>
                {packets}
              </span>
              <span className={`text-[10px] font-medium ${isLow ? 'text-red-400' : 'text-[#403424]/50'}`}>
                pkts
              </span>
          </div>
          {loose !== 0 && (
            <div className="flex items-baseline gap-1">
                <span className={`text-sm font-semibold leading-none ${isLow ? 'text-red-500' : 'text-[#403424]/70'}`}>
                  {loose}
                </span>
                <span className={`text-[10px] font-medium ${isLow ? 'text-red-300' : 'text-[#403424]/50'}`}>
                  pcs
                </span>
            </div>
          )}
       </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { transactions, salesRecords, skus, branches, orders, todos, addTodo, toggleTodo, deleteTodo } = useStore();
  const { hasPermission, currentUser, users } = useAuth();
  
  // Dashboard State
  const [timeRange, setTimeRange] = useState<TimeRange>('TODAY');
  const [dashboardBranch, setDashboardBranch] = useState<string>('ALL');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Todo State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');

  // --- 0. Todo Logic ---
  const myTodos = useMemo(() => {
    if (!currentUser) return [];
    return todos.filter(t => t.assignedTo === currentUser.id && !t.isCompleted);
  }, [todos, currentUser]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText || !assignedUserId) return;

    await addTodo({
      text: newTaskText,
      assignedTo: assignedUserId,
      assignedBy: currentUser?.name || 'Admin',
      isCompleted: false,
      createdAt: Date.now()
    });

    setNewTaskText('');
    setAssignedUserId('');
    setIsTaskModalOpen(false);
  };

  // --- 1. Last Checkout Logic ---
  const lastCheckouts = useMemo(() => {
    const result: Record<string, { date: string, timestamp: number, items: Record<string, number> }> = {};
    
    branches.forEach(branch => {
      // Get all checkouts for this branch
      const checkoutTxs = transactions.filter(t => t.branchId === branch.id && t.type === TransactionType.CHECK_OUT);
      
      if (checkoutTxs.length === 0) return;

      // Find the latest timestamp securely
      const latestTx = checkoutTxs.reduce((prev, current) => (prev.timestamp > current.timestamp) ? prev : current);
      const latestTimestamp = latestTx.timestamp;

      // Get all items in that batch (approximate by timestamp window of 2 seconds)
      const batchItems = checkoutTxs.filter(t => Math.abs(t.timestamp - latestTimestamp) < 2000);

      const itemsMap: Record<string, number> = {};
      batchItems.forEach(t => {
        itemsMap[t.skuId] = (itemsMap[t.skuId] || 0) + t.quantityPieces;
      });

      result[branch.id] = {
        date: new Date(latestTimestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
        timestamp: latestTimestamp,
        items: itemsMap
      };
    });

    return result;
  }, [transactions, branches]);

  // --- 2. Live Inventory Logic (Fridge) ---
  const stockLevels = useMemo(() => {
    const levels: Record<string, number> = {};
    skus.forEach(s => levels[s.id] = 0);
    
    transactions.forEach(t => {
      if (t.type === TransactionType.RESTOCK || t.type === TransactionType.CHECK_IN || (t.type === TransactionType.ADJUSTMENT && t.quantityPieces > 0)) {
        levels[t.skuId] = (levels[t.skuId] || 0) + t.quantityPieces;
      } else if (t.type === TransactionType.CHECK_OUT || (t.type === TransactionType.ADJUSTMENT && t.quantityPieces < 0)) {
        levels[t.skuId] = (levels[t.skuId] || 0) - Math.abs(t.quantityPieces);
      } else if (t.type === TransactionType.WASTE && t.branchId === 'FRIDGE') {
        // Also deduct waste if it came directly from Fridge
        levels[t.skuId] = (levels[t.skuId] || 0) - t.quantityPieces;
      }
    });
    return levels;
  }, [transactions, skus]);

  // --- Date Helpers ---
  const { dateRangeFilter, daysDivisor } = useMemo(() => {
      const todayStr = getLocalISOString();
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = getLocalISOString(yesterdayDate);
      
      let startDateStr = todayStr;
      let days = 1;

      if (timeRange === 'YESTERDAY') {
          startDateStr = yesterdayStr;
          days = 1;
      } else if (timeRange === '7D') {
          const d = new Date();
          d.setDate(d.getDate() - 7);
          startDateStr = getLocalISOString(d);
          days = 7;
      } else if (timeRange === '30D') {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          startDateStr = getLocalISOString(d);
          days = 30;
      }

      // Filter function
      const filterFn = (d: string) => {
          if (!d) return false;
          if (timeRange === 'TODAY') return d === todayStr;
          if (timeRange === 'YESTERDAY') return d === yesterdayStr;
          return d >= startDateStr && d <= todayStr;
      };

      return { dateRangeFilter: filterFn, daysDivisor: days };
  }, [timeRange]);

  // --- 3. Sales Analytics Calculation (Averages) ---
  const salesStats = useMemo(() => {
      const filteredOrders = orders.filter(o => {
          const matchesDate = dateRangeFilter(o.date);
          const matchesBranch = dashboardBranch === 'ALL' || o.branchId === dashboardBranch;
          return matchesDate && matchesBranch;
      });

      const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const totalOrderCount = filteredOrders.length;

      const avgDailySales = totalRevenue / daysDivisor;
      const avgDailyVolume = totalOrderCount / daysDivisor;
      const avgOrderValue = totalOrderCount > 0 ? totalRevenue / totalOrderCount : 0;

      return {
          totalRevenue,
          totalOrderCount,
          avgDailySales,
          avgDailyVolume,
          avgOrderValue
      };
  }, [orders, dateRangeFilter, dashboardBranch, daysDivisor]);

  // --- 4. Revenue Breakdown (Cash vs Online) ---
  const revenueBreakdown = useMemo(() => {
      const filteredOrders = orders.filter(o => {
          const matchesDate = dateRangeFilter(o.date);
          const matchesBranch = dashboardBranch === 'ALL' || o.branchId === dashboardBranch;
          return matchesDate && matchesBranch;
      });

      let cash = 0;
      let online = 0;

      filteredOrders.forEach(o => {
          if (o.paymentMethod === 'SPLIT') {
              o.paymentSplit?.forEach(split => {
                  if (split.method === 'CASH') cash += split.amount;
                  else online += split.amount; // UPI or CARD
              });
          } else if (o.paymentMethod === 'CASH') {
              cash += o.totalAmount;
          } else {
              // UPI, CARD, or others
              online += o.totalAmount;
          }
      });

      return { cash, online, total: cash + online };
  }, [orders, dateRangeFilter, dashboardBranch]);

  // --- 5. Inventory Analytics Calculation (Based on Range) ---
  const { reportData, trendData, reconciliationData } = useMemo(() => {
    if (!hasPermission('VIEW_ANALYTICS')) return { reportData: [], trendData: [], reconciliationData: [] };

    const report: Record<string, DailyReportItem> = {};
    const trendMap: Record<string, { date: string, incoming: number, outgoing: number, waste: number, diff: number }> = {};
    const reconMap: Record<string, { date: string, physicalUsage: number, recordedSales: number }> = {};
    
    // Initialize Report Data
    skus.forEach(sku => {
      report[sku.id] = {
        skuName: sku.name,
        category: sku.category,
        dietary: sku.dietary,
        taken: 0,
        returned: 0,
        waste: 0,
        sold: 0,
      };
    });

    // Process Transactions
    transactions.forEach(t => {
       if (!dateRangeFilter(t.date)) return;
       if (dashboardBranch !== 'ALL' && t.branchId !== dashboardBranch) return;

       // Report Data (SKU based)
       if (report[t.skuId]) {
         if (t.type === TransactionType.CHECK_OUT) {
           report[t.skuId].taken += t.quantityPieces;
         } else if (t.type === TransactionType.CHECK_IN) {
           report[t.skuId].returned += t.quantityPieces;
         } else if (t.type === TransactionType.WASTE) {
           report[t.skuId].waste += t.quantityPieces;
         }
       }

       // Trend Data
       const dateKey = t.date;
       if (!trendMap[dateKey]) trendMap[dateKey] = { date: dateKey, incoming: 0, outgoing: 0, waste: 0, diff: 0 };
       if (!reconMap[dateKey]) reconMap[dateKey] = { date: dateKey, physicalUsage: 0, recordedSales: 0 };

       if (t.type === TransactionType.CHECK_OUT) {
         trendMap[dateKey].outgoing += t.quantityPieces;
         reconMap[dateKey].physicalUsage += t.quantityPieces;
       } else if (t.type === TransactionType.RESTOCK || t.type === TransactionType.CHECK_IN) {
         trendMap[dateKey].incoming += t.quantityPieces;
         if(t.type === TransactionType.CHECK_IN) {
            reconMap[dateKey].physicalUsage -= t.quantityPieces;
         }
       } else if (t.type === TransactionType.WASTE) {
         trendMap[dateKey].waste += t.quantityPieces;
         reconMap[dateKey].physicalUsage -= t.quantityPieces;
       }
    });

    // Process Sales Records for Reconciliation Graph
    orders.forEach(o => {
        if (!dateRangeFilter(o.date)) return;
        if (dashboardBranch !== 'ALL' && o.branchId !== dashboardBranch) return;

        const dateKey = o.date;
        if (!reconMap[dateKey]) reconMap[dateKey] = { date: dateKey, physicalUsage: 0, recordedSales: 0 };
        
        let rawPiecesSold = 0;
        if (o.items && Array.isArray(o.items)) {
            o.items.forEach(item => {
                // SAFETY: Ensure consumed is an array before reducing
                if(item.consumed && Array.isArray(item.consumed)) {
                    rawPiecesSold += item.consumed.reduce((sum, c) => sum + c.quantity, 0);
                }
            });
        }
        if(o.customSkuItems && Array.isArray(o.customSkuItems)) {
            rawPiecesSold += o.customSkuItems.reduce((sum, c) => sum + c.quantity, 0);
        }

        reconMap[dateKey].recordedSales += rawPiecesSold;
    });

    // Finalize Report Metrics
    Object.keys(report).forEach(skuId => {
      const item = report[skuId];
      item.sold = Math.max(0, item.taken - item.returned - item.waste);
    });

    // Finalize Trend Metrics
    const trendArray = Object.values(trendMap).map(d => ({
      ...d,
      diff: d.incoming - d.outgoing - d.waste,
      displayDate: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })).sort((a,b) => a.date.localeCompare(b.date));

    // Finalize Recon Metrics
    const reconArray = Object.values(reconMap).map(d => ({
        ...d,
        displayDate: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })).sort((a,b) => a.date.localeCompare(b.date));

    return { reportData: Object.values(report), trendData: trendArray, reconciliationData: reconArray };
  }, [transactions, orders, skus, dateRangeFilter, dashboardBranch, hasPermission]);

  // --- 6. Advanced Sales Analytics (New Graphs) ---
  const { revenueTrend, branchKeys, topMenuData } = useMemo(() => {
      if (!hasPermission('VIEW_ANALYTICS')) return { revenueTrend: [], branchKeys: [], topMenuData: [] };

      const dailyMap: Record<string, any> = {};
      const menuMap: Record<string, number> = {};
      const bKeys = new Set<string>();

      // Sort orders for timeline
      const sortedOrders = [...orders].sort((a,b) => a.timestamp - b.timestamp);

      sortedOrders.forEach(o => {
          if (!dateRangeFilter(o.date)) return;
          
          const dateKey = o.date;
          if (!dailyMap[dateKey]) {
              dailyMap[dateKey] = { 
                  date: dateKey, 
                  displayDate: new Date(dateKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  total: 0 
              };
          }

          // Total Revenue & Top Items (Filtered by selected branch if applicable)
          if (dashboardBranch === 'ALL' || o.branchId === dashboardBranch) {
              dailyMap[dateKey].total += o.totalAmount;
              
              // Process Menu Items
              if (o.items && Array.isArray(o.items)) {
                  o.items.forEach(item => {
                      menuMap[item.name] = (menuMap[item.name] || 0) + item.quantity;
                  });
              }
          }

          // Branch Specific Data (For comparison graph - mainly relevant when ALL is selected)
          if (dashboardBranch === 'ALL') {
              dailyMap[dateKey][o.branchId] = (dailyMap[dateKey][o.branchId] || 0) + o.totalAmount;
              bKeys.add(o.branchId);
          } else if (o.branchId === dashboardBranch) {
              dailyMap[dateKey][o.branchId] = (dailyMap[dateKey][o.branchId] || 0) + o.totalAmount;
              bKeys.add(o.branchId);
          }
      });

      const trendArray = Object.values(dailyMap).sort((a,b) => a.date.localeCompare(b.date));
      
      const menuArray = Object.entries(menuMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a,b) => b.value - a.value)
          .slice(0, 8); // Top 8 items

      return { revenueTrend: trendArray, branchKeys: Array.from(bKeys), topMenuData: menuArray };
  }, [orders, dateRangeFilter, dashboardBranch, hasPermission]);

  // --- 7. Last 7 Days Performance Table Data ---
  const last7DaysPerformance = useMemo(() => {
      if (!hasPermission('VIEW_ANALYTICS')) return [];

      const today = new Date();
      // Generate last 7 days dates
      const dates = [];
      for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          dates.push(getLocalISOString(d));
      }

      const stats = dates.map(dateStr => {
          const dayOrders = orders.filter(o => 
              o.date === dateStr && 
              (dashboardBranch === 'ALL' || o.branchId === dashboardBranch)
          );

          let totalRevenue = 0;
          let cash = 0;
          let online = 0;

          dayOrders.forEach(o => {
              totalRevenue += o.totalAmount;
              if (o.paymentMethod === 'CASH') {
                  cash += o.totalAmount;
              } else if (o.paymentMethod === 'SPLIT') {
                  o.paymentSplit?.forEach(s => {
                      if (s.method === 'CASH') cash += s.amount;
                      else online += s.amount;
                  });
              } else {
                  online += o.totalAmount;
              }
          });

          return {
              date: dateStr,
              displayDate: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              orders: dayOrders.length,
              cash,
              online,
              total: totalRevenue
          };
      });

      return stats;
  }, [orders, dashboardBranch, hasPermission]);

  // --- Derived Metrics (Simple Counts) ---
  const totalTaken = reportData.reduce((acc: number, curr: DailyReportItem) => acc + curr.taken, 0);
  const totalReturned = reportData.reduce((acc: number, curr: DailyReportItem) => acc + curr.returned, 0);
  const totalWaste = reportData.reduce((acc: number, curr: DailyReportItem) => acc + curr.waste, 0);
  const totalSold = reportData.reduce((acc: number, curr: DailyReportItem) => acc + curr.sold, 0);

  // Category Consumption Data
  const categoryData = useMemo(() => {
    const data: Record<string, number> = {};
    reportData.forEach(item => {
      data[item.category] = (data[item.category] || 0) + item.sold;
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [reportData]);
  
  // AI Handler
  const handleAskAI = async () => {
    setLoadingAi(true);
    const dateStr = timeRange === 'TODAY' ? getLocalISOString() : `Last ${timeRange}`;
    const insight = await generateDailyInsights(dateStr, reportData);
    setAiInsight(insight);
    setLoadingAi(false);
  };

  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name || id;

  useEffect(() => {
    setAiInsight(null);
  }, [timeRange, dashboardBranch]);

  return (
    <div className="space-y-8 pb-10">

      {/* 0. My Tasks Section */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
         <div className="flex justify-between items-center mb-4 relative z-10">
            <h2 className="text-xl font-bold flex items-center gap-2">
               <CheckSquare className="text-emerald-400" /> My Tasks
            </h2>
            
            {/* Admin Assign Button */}
            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER') && (
               <button 
                  onClick={() => setIsTaskModalOpen(true)}
                  className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 backdrop-blur-sm"
               >
                  <Plus size={14} /> Assign Task
               </button>
            )}
         </div>

         <div className="relative z-10">
            {myTodos.length === 0 ? (
               <div className="text-white/40 italic text-sm py-2">
                  No pending tasks assigned to you.
               </div>
            ) : (
               <div className="space-y-2">
                  {myTodos.map(todo => (
                     <div key={todo.id} className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/10 hover:bg-white/10 transition-colors group">
                        <button 
                           onClick={() => toggleTodo(todo.id, true)}
                           className="w-5 h-5 rounded border border-white/40 hover:border-emerald-400 flex items-center justify-center transition-colors flex-shrink-0"
                        >
                           <Check size={14} className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                        <div className="flex-1">
                           <p className="text-sm font-medium text-white/90">{todo.text}</p>
                           <p className="text-[10px] text-white/40">From: {todo.assignedBy} • {new Date(todo.createdAt).toLocaleDateString()}</p>
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </div>
      </div>

      {/* 1. Last Checkout Section */}
      <div className="space-y-6">
        <div className="text-center mb-4">
           <h2 className="text-xl font-bold text-[#403424] uppercase tracking-wide">Last Checkout</h2>
        </div>
        
        {branches.length === 0 && <p className="text-center text-[#403424]/50 italic text-sm">No branches configured.</p>}

        {branches.map(branch => {
           const checkoutData = lastCheckouts[branch.id];
           if (!checkoutData) return null;

           return (
             <div key={branch.id} className="bg-white rounded-xl p-4 border border-[#403424]/10">
                <div className="flex flex-col items-center mb-3">
                   <h3 className="font-bold text-[#95a77c] flex items-center gap-2">
                      <Store size={16} /> {branch.name}
                   </h3>
                   <span className="text-xs text-[#403424]/50 font-medium">{checkoutData.date}</span>
                </div>
                
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                   {skus.filter(s => checkoutData.items[s.id] > 0).map(sku => (
                      <InventoryTile 
                        key={sku.id}
                        skuName={sku.name}
                        quantity={checkoutData.items[sku.id]}
                        piecesPerPacket={sku.piecesPerPacket}
                      />
                   ))}
                </div>
             </div>
           )
        })}
      </div>

      <hr className="border-[#403424]/10" />
      
      {/* 2. Live Inventory Section */}
      <div>
        <h3 className="text-sm font-bold text-[#403424]/70 uppercase tracking-wide mb-3">Current Fridge Stock</h3>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
             {skus.map(sku => {
                const balance = stockLevels[sku.id] || 0;
                const isLow = balance < (sku.piecesPerPacket * 10);
                
                return (
                  <InventoryTile 
                    key={sku.id}
                    skuName={sku.name}
                    quantity={balance}
                    piecesPerPacket={sku.piecesPerPacket}
                    isLow={isLow}
                  />
                )
             })}
        </div>
      </div>

      <hr className="border-[#403424]/10" />

      {/* 3. Analytics Section (Restricted) */}
      {hasPermission('VIEW_ANALYTICS') && (
        <div className="space-y-6">
          {/* Header & Controls */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
             <div className="flex items-center gap-2 text-[#403424] font-bold text-lg">
                <TrendingUp className="text-[#95a77c]" /> Business Intelligence
             </div>
             
             <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                 {/* Branch Selector */}
                 <div className="relative">
                    <Store className="absolute left-3 top-2.5 text-[#403424]/40" size={14} />
                    <select 
                       value={dashboardBranch}
                       onChange={(e) => setDashboardBranch(e.target.value)}
                       className="w-full sm:w-48 pl-9 pr-8 py-2 bg-white border border-[#403424]/10 rounded-lg text-sm font-bold text-[#403424] appearance-none focus:outline-none focus:ring-2 focus:ring-[#95a77c]"
                    >
                       <option value="ALL">All Branches</option>
                       {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                       ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 text-[#403424]/40 pointer-events-none" size={14} />
                 </div>

                 {/* Time Range Selector */}
                 <div className="flex bg-white border border-[#403424]/10 rounded-lg p-1 shadow-sm overflow-x-auto">
                    {(['TODAY', 'YESTERDAY', '7D', '30D'] as TimeRange[]).map(range => (
                       <button
                         key={range}
                         onClick={() => setTimeRange(range)}
                         className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                           timeRange === range 
                             ? 'bg-[#eff2e7] text-[#403424]' 
                             : 'text-[#403424]/50 hover:bg-[#f9faf7]'
                         }`}
                       >
                         {range === 'TODAY' ? 'Today' : range === 'YESTERDAY' ? 'Yesterday' : range === '7D' ? 'Last 7 Days' : 'Last 30 Days'}
                       </button>
                    ))}
                 </div>
             </div>
          </div>

          {/* Revenue Breakdown Section */}
          <h3 className="text-sm font-bold text-[#403424]/70 uppercase tracking-wide mt-2">Revenue Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <StatCard 
               title="Total Revenue"
               value={`₹${revenueBreakdown.total.toLocaleString()}`}
               icon={<Wallet size={20} className="text-slate-600" />}
               color="bg-slate-50/50 border-slate-100"
             />
             <StatCard 
               title="Cash Sales"
               value={`₹${revenueBreakdown.cash.toLocaleString()}`}
               icon={<Banknote size={20} className="text-emerald-600" />}
               color="bg-emerald-50/50 border-emerald-100"
             />
             <StatCard 
               title="Online Sales"
               value={`₹${revenueBreakdown.online.toLocaleString()}`}
               icon={<QrCode size={20} className="text-blue-600" />}
               trend="UPI & Card"
               color="bg-blue-50/50 border-blue-100"
             />
          </div>

          {/* Sales Performance Stats */}
          <h3 className="text-sm font-bold text-[#403424]/70 uppercase tracking-wide mt-2">Performance Averages</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <StatCard 
               title="Avg Daily Sales"
               value={`₹${Math.round(salesStats.avgDailySales).toLocaleString()}`}
               icon={<IndianRupee size={20} className="text-emerald-600" />}
               color="bg-white"
             />
             <StatCard 
               title="Avg Daily Orders"
               value={Math.round(salesStats.avgDailyVolume)}
               icon={<Receipt size={20} className="text-blue-600" />}
               color="bg-white"
             />
             <StatCard 
               title="Avg Order Value"
               value={`₹${Math.round(salesStats.avgOrderValue)}`}
               icon={<BarChart3 size={20} className="text-violet-600" />}
               color="bg-white"
             />
          </div>

          <h3 className="text-sm font-bold text-[#403424]/70 uppercase tracking-wide mt-4">Revenue Trends</h3>
          
          {/* Revenue & Branch Trends (New Charts) */}
          <div className="grid grid-cols-1 gap-6">
             {/* Total Revenue Area Chart */}
             <div className="bg-white p-4 rounded-xl shadow-sm border border-[#403424]/10">
                <h3 className="text-sm font-bold text-[#403424]/70 mb-4 flex items-center gap-2">
                   <Activity size={16} className="text-emerald-600"/> Daily Revenue (₹)
                </h3>
                <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                         <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                               <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                         <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={10} />
                         <YAxis stroke="#94a3b8" fontSize={10} />
                         <Tooltip 
                           contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#403424' }}
                           labelStyle={{ fontWeight: 'bold', color: '#403424' }}
                         />
                         <Area type="monotone" dataKey="total" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </div>

             {/* Branch Comparison Line Chart (Only when ALL selected) */}
             {dashboardBranch === 'ALL' && branchKeys.length > 1 && (
               <div className="bg-white p-4 rounded-xl shadow-sm border border-[#403424]/10">
                  <h3 className="text-sm font-bold text-[#403424]/70 mb-4 flex items-center gap-2">
                     <Store size={16} className="text-blue-600"/> Branch Performance Comparison
                  </h3>
                  <div className="h-64">
                     <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                           <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={10} />
                           <YAxis stroke="#94a3b8" fontSize={10} />
                           <Tooltip 
                             contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#403424' }}
                           />
                           <Legend iconSize={10} fontSize={10} verticalAlign="top" height={36}/>
                           {branchKeys.map((key, index) => (
                              <Line 
                                key={key}
                                type="monotone" 
                                dataKey={key} 
                                name={getBranchName(key)}
                                stroke={COLORS[index % COLORS.length]} 
                                strokeWidth={2}
                                dot={false}
                              />
                           ))}
                        </LineChart>
                     </ResponsiveContainer>
                  </div>
               </div>
             )}
          </div>

          <h3 className="text-sm font-bold text-[#403424]/70 uppercase tracking-wide mt-4">Operational Stats</h3>

          {/* Operational Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              title="Total Check-Outs" 
              value={totalTaken} 
              icon={<Package size={20} className="text-[#95a77c]" />} 
              color="bg-white"
            />
            <StatCard 
              title="Returns" 
              value={totalReturned} 
              icon={<RotateCcw size={20} className="text-amber-500" />} 
              color="bg-white"
            />
             <StatCard 
              title="Total Wastage" 
              value={totalWaste} 
              icon={<Trash2 size={20} className="text-red-500" />} 
              color="bg-white"
            />
            <StatCard 
              title="Net Consumed" 
              value={totalSold} 
              icon={<ShoppingBag size={20} className="text-[#95a77c]" />} 
              color="bg-white"
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top Selling Menu Items (New Chart) */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-[#403424]/10">
              <h3 className="text-sm font-bold text-[#403424]/70 mb-4 flex items-center gap-2">
                 <Sparkles size={16} className="text-amber-500" /> Best Sellers (Menu Items)
              </h3>
              <div className="h-64">
                {topMenuData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topMenuData} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e5e5" />
                      <XAxis type="number" stroke="#94a3b8" fontSize={10} />
                      <YAxis dataKey="name" type="category" width={110} style={{ fontSize: '10px', fill: '#403424' }} stroke="#e5e5e5" tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value} />
                      <Tooltip 
                         cursor={{fill: '#f3f4f6'}}
                         contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="value" name="Sold Qty" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                   <div className="h-full flex items-center justify-center text-[#403424]/40 text-sm">
                     No sales data available.
                   </div>
                )}
              </div>
            </div>

            {/* Category Distribution */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-[#403424]/10">
              <h3 className="text-sm font-bold text-[#403424]/70 mb-4">Inventory Category Share</h3>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      labelLine={false}
                      label={({ name, percent }) => percent > 0.1 ? `${name}` : ''}
                      fontSize={10}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconSize={8} fontSize={10}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Last 7 Days Performance Table */}
          <div className="bg-white rounded-xl shadow-sm border border-[#403424]/10 overflow-hidden">
             <div className="p-4 border-b border-[#403424]/10 flex items-center gap-2 bg-[#f9faf7]">
                <CalendarDays size={16} className="text-[#95a77c]" />
                <h3 className="text-sm font-bold text-[#403424]/70 uppercase tracking-wide">Last 7 Days Performance</h3>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                   <thead className="text-xs text-[#403424]/50 bg-white border-b border-[#403424]/10 uppercase font-semibold">
                      <tr>
                         <th className="p-3">Date</th>
                         <th className="p-3 text-center">Orders</th>
                         <th className="p-3 text-right">Cash</th>
                         <th className="p-3 text-right">Online</th>
                         <th className="p-3 text-right font-bold text-[#403424]">Total Revenue</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-[#403424]/5">
                      {last7DaysPerformance.map((row, idx) => (
                         <tr key={idx} className="hover:bg-[#f9faf7] transition-colors">
                            <td className="p-3 font-medium text-[#403424]">{row.displayDate}</td>
                            <td className="p-3 text-center text-[#403424]/70">{row.orders}</td>
                            <td className="p-3 text-right text-emerald-600">₹{row.cash.toLocaleString()}</td>
                            <td className="p-3 text-right text-blue-600">₹{row.online.toLocaleString()}</td>
                            <td className="p-3 text-right font-bold text-[#403424]">₹{row.total.toLocaleString()}</td>
                         </tr>
                      ))}
                      {last7DaysPerformance.length === 0 && (
                         <tr>
                            <td colSpan={5} className="p-6 text-center text-[#403424]/40 italic">No sales data for the last 7 days.</td>
                         </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>

          {/* Reconciliation Chart */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-[#403424]/10">
            <h3 className="text-sm font-bold text-[#403424]/70 mb-4 flex items-center gap-2">
               <Scale size={16} className="text-indigo-600" /> Sales vs. Usage Reconciliation
            </h3>
            <div className="h-64">
               {reconciliationData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reconciliationData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                    <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={10} />
                    <YAxis stroke="#94a3b8" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#403424' }}
                      labelStyle={{ fontWeight: 'bold', color: '#403424' }}
                    />
                    <Legend iconSize={10} fontSize={10} verticalAlign="top" height={36}/>
                    <Bar dataKey="physicalUsage" name="Physical Usage (Raw Pcs)" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="recordedSales" name="Recorded Sales (Approx Raw)" fill="#95a77c" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
               ) : (
                 <div className="h-full flex items-center justify-center text-[#403424]/40 text-sm">
                   No data for reconciliation.
                 </div>
               )}
            </div>
            <p className="text-xs text-[#403424]/40 mt-2 text-center italic">
               Blue Bar (Stock) should match Green Bar (Sales). Higher Blue = Potential Loss.
            </p>
          </div>
        </div>
      )}

      {/* 4. Gemini Analyst Section */}
      {hasPermission('VIEW_ANALYTICS') && (
        <div className="bg-[#403424] rounded-xl p-6 text-white shadow-lg mt-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-full">
                <Sparkles className="text-[#95a77c]" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">Gemini Analyst</h3>
                {!aiInsight ? (
                   <p className="text-white/60 mb-4 text-sm">
                     Get intelligent insights about consumption patterns, waste, and category popularity for the selected period.
                   </p>
                ) : (
                  <div className="prose prose-invert max-w-none text-sm bg-white/5 p-4 rounded-lg mb-4">
                    <pre className="whitespace-pre-wrap font-sans text-white/80">{aiInsight}</pre>
                  </div>
                )}
                
                <button 
                  onClick={handleAskAI}
                  disabled={loadingAi}
                  className="bg-[#95a77c] hover:bg-[#85966d] disabled:bg-[#95a77c]/50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                >
                  {loadingAi ? 'Analyzing...' : 'Generate Insights'}
                </button>
              </div>
            </div>
          </div>
      )}

      {/* Assign Task Modal */}
      {isTaskModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
               <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-700">Assign New Task</h3>
                  <button onClick={() => setIsTaskModalOpen(false)}><X size={20} className="text-slate-400" /></button>
               </div>
               <form onSubmit={handleCreateTask} className="p-4 space-y-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Description</label>
                     <input 
                        type="text"
                        required
                        autoFocus
                        placeholder="e.g. Clean the deep fryer"
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 outline-none"
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign To</label>
                     <div className="relative">
                        <UserIcon size={16} className="absolute left-3 top-2.5 text-slate-400" />
                        <select 
                           required
                           value={assignedUserId}
                           onChange={(e) => setAssignedUserId(e.target.value)}
                           className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 outline-none bg-white"
                        >
                           <option value="">Select Staff Member</option>
                           {users.map(u => (
                              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                           ))}
                        </select>
                     </div>
                  </div>
                  <button 
                     type="submit"
                     disabled={!newTaskText || !assignedUserId}
                     className="w-full py-2.5 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                     Assign Task
                  </button>
               </form>
            </div>
         </div>
      )}

    </div>
  );
};

export default Dashboard;