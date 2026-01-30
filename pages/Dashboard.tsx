
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { DailyReportItem, TransactionType, Todo, LedgerEntryType } from '../types';
import { StatCard } from '../components/StatCard';
import { TrendingUp, TrendingDown, ShoppingBag, RotateCcw, Trash2, Sparkles, Store, Package, Activity, Scale, IndianRupee, Receipt, BarChart3, ChevronDown, ChevronUp, Banknote, QrCode, Wallet, CalendarDays, CheckSquare, Plus, X, User as UserIcon, Check, Clock, Moon, Snowflake } from 'lucide-react';
import LedgerEntryModal from '../components/LedgerEntryModal';
import { generateDailyInsights } from '../services/geminiService';
import { getLocalISOString } from '../constants';
import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

// Updated palette for charts to match warm theme
const COLORS = ['#95a77c', '#eab308', '#ef4444', '#8b5cf6', '#3b82f6', '#d97706'];

type TimeRange = 'TODAY' | 'YESTERDAY' | '7D' | '30D';

interface InventoryTileProps {
   skuName: string;
   quantity: number;
   piecesPerPacket: number;
   status?: 'NORMAL' | 'LOW' | 'CRITICAL';
}

const InventoryTile: React.FC<InventoryTileProps> = ({ skuName, quantity, piecesPerPacket, status = 'NORMAL' }) => {
   // Guard against division by zero or NaN
   const packetSize = piecesPerPacket > 0 ? piecesPerPacket : 1;
   const safeQty = isNaN(quantity) ? 0 : quantity;

   const packets = Math.floor(safeQty / packetSize);
   const loose = safeQty % packetSize;

   let bgClass = 'bg-white border-[#403424]/10';
   let textClass = 'text-[#403424]';
   let mutedTextClass = 'text-[#403424]/50';

   if (status === 'CRITICAL') {
      bgClass = 'bg-red-50 border-red-200';
      textClass = 'text-red-700';
      mutedTextClass = 'text-red-400';
   } else if (status === 'LOW') {
      bgClass = 'bg-amber-50 border-amber-200';
      textClass = 'text-amber-700';
      mutedTextClass = 'text-amber-400';
   }

   return (
      <div
         className={`rounded-lg border p-2 flex flex-col justify-between transition-all hover:shadow-sm ${bgClass}`}
      >
         <div className="mb-0.5">
            <h3 className={`font-bold text-xs leading-tight truncate ${textClass}`}>
               {skuName}
            </h3>
         </div>

         <div className="flex items-end gap-2">
            <div className="flex items-baseline gap-1">
               <span className={`text-lg font-bold leading-none ${textClass}`}>
                  {packets}
               </span>
               <span className={`text-[10px] font-medium ${mutedTextClass}`}>
                  pkts
               </span>
            </div>
            {loose !== 0 && (
               <div className="flex items-baseline gap-1">
                  <span className={`text-sm font-semibold leading-none ${textClass} opacity-80`}>
                     {loose}
                  </span>
                  <span className={`text-[10px] font-medium ${mutedTextClass}`}>
                     pcs
                  </span>
               </div>
            )}
         </div>
      </div>
   );
};

const Dashboard: React.FC = () => {
   const { transactions, skus, branches, orders, todos, addTodo, toggleTodo, appSettings } = useStore();
   const { hasPermission, currentUser, users } = useAuth();

   // Dashboard State
   const [timeRange, setTimeRange] = useState<TimeRange>(() => {
      // Smart Logic: If before 3 PM (15:00), default to Yesterday since opening is ~4 PM
      const hour = new Date().getHours();
      return hour < 15 ? 'YESTERDAY' : 'TODAY';
   });

   const [dashboardBranch, setDashboardBranch] = useState<string>('ALL');
   const [aiInsight, setAiInsight] = useState<string | null>(null);
   const [loadingAi, setLoadingAi] = useState(false);
   const [activeOperationalView, setActiveOperationalView] = useState<'STOCK' | 'CHECKOUT' | null>(null);

   // Quick Action Modal State
   const [ledgerModal, setLedgerModal] = useState<{ isOpen: boolean; type?: LedgerEntryType }>({ isOpen: false });

   // Todo State
   const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
   const [newTaskText, setNewTaskText] = useState('');
   const [assignedUserId, setAssignedUserId] = useState('');

   // Info message regarding auto-selection
   const autoTimeMessage = useMemo(() => {
      const hour = new Date().getHours();
      // If it's before 3PM and user hasn't explicitly changed away from Yesterday (or is looking at Yesterday)
      if (hour < 15 && timeRange === 'YESTERDAY') {
         return "Store opens at 3 PM. Displaying yesterday's data.";
      }
      return "";
   }, [timeRange]);

   // --- 0. Todo Logic (Categorized) ---
   const myTasks = useMemo(() => {
      if (!currentUser) return { overdue: [], today: [], upcoming: [] };

      const todayStr = getLocalISOString();
      const now = Date.now();
      const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

      const relevantTasks = todos.filter(t => {
         if (t.assignedTo !== currentUser.id) return false;
         if (!t.isCompleted) return true;
         return (t.completedAt && (now - t.completedAt < FORTY_EIGHT_HOURS));
      });

      const overdue = relevantTasks
         .filter(t => !t.isCompleted && t.dueDate && t.dueDate < todayStr)
         .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

      const upcoming = relevantTasks
         .filter(t => !t.isCompleted && t.dueDate && t.dueDate > todayStr)
         .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

      const activeToday = relevantTasks
         .filter(t => !t.isCompleted && (!t.dueDate || t.dueDate === todayStr));

      const recentlyCompleted = relevantTasks
         .filter(t => t.isCompleted)
         .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

      const today = [...activeToday, ...recentlyCompleted];

      return { overdue, today, upcoming };
   }, [todos, currentUser]);

   const handleCreateTask = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTaskText || !assignedUserId) return;

      await addTodo({
         id: `task-${Date.now()}`,
         text: newTaskText,
         assignedTo: assignedUserId,
         assignedBy: currentUser?.name || 'Admin',
         isCompleted: false,
         createdAt: Date.now(),
         dueDate: getLocalISOString()
      });

      setNewTaskText('');
      setAssignedUserId('');
      setIsTaskModalOpen(false);
   };

   // --- 1. Last Checkout Logic ---
   const lastCheckouts = useMemo(() => {
      const result: Record<string, { date: string, timestamp: number, items: Record<string, number> }> = {};
      branches.forEach(branch => {
         const checkoutTxs = transactions.filter(t => t.branchId === branch.id && t.type === TransactionType.CHECK_OUT);
         if (checkoutTxs.length === 0) return;
         const latestTx = checkoutTxs.reduce((prev, current) => (prev.timestamp > current.timestamp) ? prev : current);
         const latestTimestamp = latestTx.timestamp;
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
            levels[t.skuId] = (levels[t.skuId] || 0) - t.quantityPieces;
         }
      });
      return levels;
   }, [transactions, skus]);

   // --- Stock Health Indicators ---
   const stockHealth = useMemo(() => {
      let red = 0;
      let yellow = 0;
      skus.forEach(sku => {
         const balance = stockLevels[sku.id] || 0;
         const pktSize = sku.piecesPerPacket > 0 ? sku.piecesPerPacket : 1;
         if (balance < (pktSize * 3)) red++;
         else if (balance < (pktSize * 10)) yellow++;
      });
      return { red, yellow };
   }, [stockLevels, skus]);

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

      return { totalRevenue, totalOrderCount, avgDailySales, avgDailyVolume, avgOrderValue };
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
               else online += split.amount;
            });
         } else if (o.paymentMethod === 'CASH') {
            cash += o.totalAmount;
         } else {
            online += o.totalAmount;
         }
      });

      return { cash, online, total: cash + online };
   }, [orders, dateRangeFilter, dashboardBranch]);

   // --- 5. Inventory Analytics Calculation (Based on Range) ---
   const { reportData, reconciliationData } = useMemo(() => {
      if (!hasPermission('VIEW_ANALYTICS')) return { reportData: [], reconciliationData: [] };

      const report: Record<string, DailyReportItem> = {};
      const reconMap: Record<string, { date: string, physicalUsage: number, recordedSales: number }> = {};

      skus.forEach(sku => {
         report[sku.id] = {
            skuName: sku.name,
            category: sku.category,
            dietary: sku.dietary,
            taken: 0, returned: 0, waste: 0, sold: 0,
         };
      });

      transactions.forEach(t => {
         if (!dateRangeFilter(t.date)) return;
         if (dashboardBranch !== 'ALL' && t.branchId !== dashboardBranch) return;

         if (report[t.skuId]) {
            if (t.type === TransactionType.CHECK_OUT) report[t.skuId].taken += t.quantityPieces;
            else if (t.type === TransactionType.CHECK_IN) report[t.skuId].returned += t.quantityPieces;
            else if (t.type === TransactionType.WASTE) report[t.skuId].waste += t.quantityPieces;
         }

         const dateKey = t.date;
         if (!reconMap[dateKey]) reconMap[dateKey] = { date: dateKey, physicalUsage: 0, recordedSales: 0 };

         if (t.type === TransactionType.CHECK_OUT) reconMap[dateKey].physicalUsage += t.quantityPieces;
         else if (t.type === TransactionType.CHECK_IN || (t.type === TransactionType.WASTE)) reconMap[dateKey].physicalUsage -= t.quantityPieces;
      });

      orders.forEach(o => {
         if (!dateRangeFilter(o.date)) return;
         if (dashboardBranch !== 'ALL' && o.branchId !== dashboardBranch) return;

         const dateKey = o.date;
         if (!reconMap[dateKey]) reconMap[dateKey] = { date: dateKey, physicalUsage: 0, recordedSales: 0 };

         let rawPiecesSold = 0;
         if (o.items && Array.isArray(o.items)) {
            o.items.forEach(item => {
               if (item.consumed && Array.isArray(item.consumed)) {
                  rawPiecesSold += item.consumed.reduce((sum, c) => sum + c.quantity, 0);
               }
            });
         }
         if (o.customSkuItems && Array.isArray(o.customSkuItems)) {
            rawPiecesSold += o.customSkuItems.reduce((sum, c) => sum + c.quantity, 0);
         }
         reconMap[dateKey].recordedSales += rawPiecesSold;
      });

      Object.keys(report).forEach(skuId => {
         const item = report[skuId];
         item.sold = Math.max(0, item.taken - item.returned - item.waste);
      });

      const reconArray = Object.values(reconMap).map(d => ({
         ...d,
         displayDate: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      })).sort((a, b) => a.date.localeCompare(b.date));

      return { reportData: Object.values(report), reconciliationData: reconArray };
   }, [transactions, orders, skus, dateRangeFilter, dashboardBranch, hasPermission]);

   // --- 6. 30-Day Revenue Trend (ApexCharts Specific) ---
   const last30DaysData = useMemo(() => {
      if (!hasPermission('VIEW_ANALYTICS')) return { series: [], categories: [] };

      // Initialize dates for last 30 days
      const dates: string[] = [];
      const dataMap: Record<string, { total: number, branches: Record<string, number> }> = {};
      const today = new Date();

      for (let i = 29; i >= 0; i--) {
         const d = new Date();
         d.setDate(today.getDate() - i);
         const iso = getLocalISOString(d);
         dates.push(iso);
         dataMap[iso] = { total: 0, branches: {} };
         branches.forEach(b => dataMap[iso].branches[b.id] = 0);
      }

      // Populate data
      orders.forEach(o => {
         if (dataMap[o.date]) {
            dataMap[o.date].total += o.totalAmount;
            if (dataMap[o.date].branches[o.branchId] !== undefined) {
               dataMap[o.date].branches[o.branchId] += o.totalAmount;
            }
         }
      });

      // Transform to Apex Series
      const totalSeries = {
         name: 'All Branches',
         data: dates.map(d => dataMap[d].total)
      };

      const branchSeries = branches.map(b => ({
         name: b.name,
         data: dates.map(d => dataMap[d].branches[b.id])
      }));

      return {
         series: [totalSeries, ...branchSeries],
         categories: dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
      };
   }, [orders, branches, hasPermission]);

   // --- 7. Top Menu & Category Data ---
   const { topMenuData, categoryData } = useMemo(() => {
      if (!hasPermission('VIEW_ANALYTICS')) return { topMenuData: [], categoryData: [] };
      const menuMap: Record<string, number> = {};
      const catMap: Record<string, number> = {};

      orders.forEach(o => {
         if (!dateRangeFilter(o.date)) return;
         if (dashboardBranch !== 'ALL' && o.branchId !== dashboardBranch) return;

         if (o.items && Array.isArray(o.items)) {
            o.items.forEach(item => {
               menuMap[item.name] = (menuMap[item.name] || 0) + item.quantity;
            });
         }
      });

      reportData.forEach(item => {
         catMap[item.category] = (catMap[item.category] || 0) + item.sold;
      });

      const menuArray = Object.entries(menuMap)
         .map(([name, value]) => ({ name, value }))
         .sort((a, b) => b.value - a.value)
         .slice(0, 8);

      const catArray = Object.entries(catMap)
         .map(([name, value]) => ({ name, value }));

      return { topMenuData: menuArray, categoryData: catArray };
   }, [orders, reportData, dateRangeFilter, dashboardBranch]);

   // --- 8. Last 7 Days Performance Table Data ---
   const last7DaysPerformance = useMemo(() => {
      if (!hasPermission('VIEW_ANALYTICS')) return [];
      const today = new Date();
      const dates = [];
      for (let i = 0; i < 7; i++) {
         const d = new Date();
         d.setDate(today.getDate() - i);
         dates.push(getLocalISOString(d));
      }
      return dates.map(dateStr => {
         const dayOrders = orders.filter(o =>
            o.date === dateStr &&
            (dashboardBranch === 'ALL' || o.branchId === dashboardBranch)
         );
         let totalRevenue = 0, cash = 0, online = 0;
         dayOrders.forEach(o => {
            totalRevenue += o.totalAmount;
            if (o.paymentMethod === 'CASH') cash += o.totalAmount;
            else if (o.paymentMethod === 'SPLIT') {
               o.paymentSplit?.forEach(s => {
                  if (s.method === 'CASH') cash += s.amount;
                  else online += s.amount;
               });
            } else online += o.totalAmount;
         });
         return {
            displayDate: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            orders: dayOrders.length,
            cash, online, total: totalRevenue
         };
      });
   }, [orders, dashboardBranch, hasPermission]);

   // --- Derived Metrics ---
   const totalTaken = reportData.reduce((acc, curr) => acc + curr.taken, 0);
   const totalReturned = reportData.reduce((acc, curr) => acc + curr.returned, 0);
   const totalWaste = reportData.reduce((acc, curr) => acc + curr.waste, 0);
   const totalSold = reportData.reduce((acc, curr) => acc + curr.sold, 0);

   const handleAskAI = async () => {
      setLoadingAi(true);
      const dateStr = timeRange === 'TODAY' ? getLocalISOString() : `Last ${timeRange}`;
      const insight = await generateDailyInsights(dateStr, reportData);
      setAiInsight(insight);
      setLoadingAi(false);
   };

   useEffect(() => { setAiInsight(null); }, [timeRange, dashboardBranch]);

   // --- Chart Options ---
   const revenueChartOptions: ApexOptions = {
      chart: { type: 'area', toolbar: { show: false }, fontFamily: 'Inter, sans-serif' },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 2 },
      colors: ['#10b981', ...COLORS], // Green for All, then Branch Colors
      xaxis: { categories: last30DaysData.categories, labels: { style: { fontSize: '10px' } }, tooltip: { enabled: false } },
      yaxis: { labels: { formatter: (val) => `₹${val.toLocaleString()}` } },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.2, stops: [0, 90, 100] } },
      tooltip: { y: { formatter: (val) => `₹${val}` } },
      legend: { position: 'top', horizontalAlign: 'right' },
      grid: { borderColor: '#f1f5f9' }
   };

   const bestSellerOptions: ApexOptions = {
      chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Inter, sans-serif' },
      plotOptions: { bar: { borderRadius: 4, horizontal: true, barHeight: '60%' } },
      dataLabels: { enabled: true, textAnchor: 'start', style: { colors: ['#fff'] }, formatter: function (val, opt) { return opt.w.globals.labels[opt.dataPointIndex] + ":  " + val } },
      xaxis: { categories: topMenuData.map(d => d.name), labels: { show: false } },
      yaxis: { labels: { show: false } },
      colors: ['#f59e0b'],
      grid: { show: false },
      tooltip: { y: { formatter: (val) => `${val} sold` } }
   };

   const categoryOptions: ApexOptions = {
      chart: { type: 'donut', fontFamily: 'Inter, sans-serif' },
      labels: categoryData.map(d => d.name),
      colors: COLORS,
      legend: { position: 'bottom' },
      dataLabels: { enabled: false },
      plotOptions: { pie: { donut: { size: '65%' } } }
   };

   const reconOptions: ApexOptions = {
      chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Inter, sans-serif' },
      plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ['transparent'] },
      xaxis: { categories: reconciliationData.map(d => d.displayDate), labels: { style: { fontSize: '10px' } } },
      colors: ['#3B82F6', '#95a77c'],
      fill: { opacity: 1 },
      legend: { position: 'top' },
      tooltip: { y: { formatter: (val) => `${val} pcs` } }
   };

   return (
      <div className="space-y-8 pb-10">
         {/* Header & Quick Actions */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               <h1 className="text-2xl font-bold text-[#403424]">Dashboard</h1>
               <p className="text-sm text-[#403424]/60">Overview & Quick Actions</p>
            </div>
            <div className="flex gap-3">
               <button
                  onClick={() => setLedgerModal({ isOpen: true, type: 'EXPENSE' })}
                  className="flex items-center gap-2 px-4 py-2 bg-[#403424] text-white rounded-lg hover:bg-[#2d2419] transition-colors shadow-sm font-bold text-sm"
               >
                  <TrendingDown size={16} /> Add Expense
               </button>
               <button
                  onClick={() => setLedgerModal({ isOpen: true, type: 'INCOME' })}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-[#403424] border border-[#403424]/10 rounded-lg hover:bg-[#f9faf7] transition-colors shadow-sm font-bold text-sm"
               >
                  <TrendingUp size={16} /> Add Earning
               </button>
            </div>
         </div>

         {/* 0. Tasks Summary (Beta) */}
         {appSettings.enable_beta_tasks && (myTasks.overdue.length > 0 || myTasks.today.length > 0) && (
            <div className="bg-white rounded-xl p-0 border border-slate-200 shadow-sm relative overflow-hidden animate-fade-in flex flex-col md:flex-row">
               {myTasks.overdue.length > 0 && (
                  <div className="flex-1 bg-red-50 p-4 border-b md:border-b-0 md:border-r border-red-100">
                     <div className="flex items-center gap-2 mb-3 text-red-800 font-bold">
                        <Clock size={18} className="text-red-600" /> Overdue Tasks ({myTasks.overdue.length})
                     </div>
                     <div className="space-y-2">
                        {myTasks.overdue.map(task => (
                           <div key={task.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-red-100 shadow-sm">
                              <button onClick={() => toggleTodo(task.id, true)} className="w-5 h-5 rounded border border-red-300 hover:bg-red-50 flex items-center justify-center transition-colors">
                                 <Check size={14} className="text-red-500 opacity-0 hover:opacity-100" />
                              </button>
                              <div><p className="text-sm font-medium text-slate-800">{task.text}</p><p className="text-[10px] text-red-500">Due: {task.dueDate}</p></div>
                           </div>
                        ))}
                     </div>
                  </div>
               )}
               <div className="flex-1 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center gap-2 text-slate-800 font-bold"><CheckSquare size={18} className="text-emerald-600" /> Today's Tasks</div>
                     {(currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER') && (
                        <button onClick={() => setIsTaskModalOpen(true)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition-colors flex items-center gap-1"><Plus size={12} /> Assign</button>
                     )}
                  </div>
                  {myTasks.today.length === 0 ? <div className="text-slate-400 text-sm italic py-2">All caught up for today!</div> : (
                     <div className="space-y-2">
                        {myTasks.today.map(task => (
                           <div key={task.id} className={`flex items-center gap-3 p-2 rounded-lg border transition-colors group ${task.isCompleted ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 hover:border-emerald-200'}`}>
                              <button onClick={() => toggleTodo(task.id, !task.isCompleted)} className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${task.isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 hover:border-emerald-500'}`}>
                                 <Check size={14} className={`${task.isCompleted ? 'opacity-100' : 'text-emerald-600 opacity-0 group-hover:opacity-100'}`} />
                              </button>
                              <div className="flex-1">
                                 <p className={`text-sm font-medium ${task.isCompleted ? 'text-emerald-800 line-through decoration-emerald-500/50' : 'text-slate-700'}`}>{task.text}</p>
                                 <div className="flex justify-between items-center"><p className={`text-[10px] ${task.isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>{task.isCompleted ? 'Completed' : `By: ${task.assignedBy}`}</p>{task.isCompleted && <span className="text-[10px] text-emerald-500 font-medium">Undo</span>}</div>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>
         )}

         {/* 1. Operational Overview (Merged Section) */}
         <div className="bg-white rounded-xl shadow-sm border border-[#403424]/10 overflow-hidden mb-8">
            <div className="flex border-b border-[#403424]/10">
               <button
                  onClick={() => setActiveOperationalView(activeOperationalView === 'STOCK' ? null : 'STOCK')}
                  className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all relative ${activeOperationalView === 'STOCK'
                        ? 'bg-[#eff2e7] text-[#403424] shadow-[inset_0_-2px_0_0_#95a77c]'
                        : 'bg-white text-[#403424]/60 hover:bg-[#f9faf7] hover:text-[#403424]'
                     }`}
               >
                  <Snowflake size={18} className={activeOperationalView === 'STOCK' ? 'text-[#95a77c]' : ''} />
                  Current Fridge Stock
                  {(stockHealth.red > 0 || stockHealth.yellow > 0) && (
                     <div className="flex -space-x-1 ml-1">
                        {stockHealth.red > 0 && (
                           <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center border-2 border-white shadow-sm">{stockHealth.red}</span>
                        )}
                        {stockHealth.yellow > 0 && (
                           <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-[10px] flex items-center justify-center border-2 border-white shadow-sm">{stockHealth.yellow}</span>
                        )}
                     </div>
                  )}
               </button>

               <div className="w-px bg-[#403424]/10 self-stretch"></div>

               <button
                  onClick={() => setActiveOperationalView(activeOperationalView === 'CHECKOUT' ? null : 'CHECKOUT')}
                  className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all relative ${activeOperationalView === 'CHECKOUT'
                        ? 'bg-[#eff2e7] text-[#403424] shadow-[inset_0_-2px_0_0_#95a77c]'
                        : 'bg-white text-[#403424]/60 hover:bg-[#f9faf7] hover:text-[#403424]'
                     }`}
               >
                  <Store size={18} className={activeOperationalView === 'CHECKOUT' ? 'text-[#95a77c]' : ''} />
                  Last Checkout
               </button>
            </div>

            {/* Content Area */}
            <div className={`transition-all duration-300 ease-in-out ${activeOperationalView ? 'opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
               {activeOperationalView === 'STOCK' && (
                  <div className="p-4 bg-[#fcfdfa]">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-bold text-[#403424]/50 uppercase tracking-wide">Live Inventory Status</h3>
                        <div className="text-[10px] text-[#403424]/40 flex gap-2">
                           <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Critical</span>
                           <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Low</span>
                        </div>
                     </div>
                     <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {skus.map(sku => {
                           const balance = stockLevels[sku.id] || 0;
                           const pktSize = sku.piecesPerPacket > 0 ? sku.piecesPerPacket : 1;
                           let status: 'NORMAL' | 'LOW' | 'CRITICAL' = 'NORMAL';
                           if (balance < (pktSize * 3)) status = 'CRITICAL';
                           else if (balance < (pktSize * 10)) status = 'LOW';
                           return <InventoryTile key={sku.id} skuName={sku.name} quantity={balance} piecesPerPacket={pktSize} status={status} />
                        })}
                     </div>
                  </div>
               )}

               {activeOperationalView === 'CHECKOUT' && (
                  <div className="p-4 bg-[#fcfdfa]">
                     <div className="space-y-4">
                        {branches.length === 0 && <p className="text-center text-[#403424]/50 italic text-sm">No branches configured.</p>}
                        {branches.map(branch => {
                           const checkoutData = lastCheckouts[branch.id];
                           if (!checkoutData) return null;
                           return (
                              <div key={branch.id} className="bg-white rounded-xl p-4 border border-[#403424]/10 shadow-sm">
                                 <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-3 gap-2">
                                    <h3 className="font-bold text-[#95a77c] flex items-center gap-2"><Store size={16} /> {branch.name}</h3>
                                    <span className="text-xs text-[#403424]/50 font-medium bg-[#eff2e7] px-2 py-1 rounded">{checkoutData.date}</span>
                                 </div>
                                 <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                    {skus.filter(s => checkoutData.items[s.id] > 0).map(sku => (
                                       <InventoryTile key={sku.id} skuName={sku.name} quantity={checkoutData.items[sku.id]} piecesPerPacket={sku.piecesPerPacket} />
                                    ))}
                                 </div>
                              </div>
                           )
                        })}
                     </div>
                  </div>
               )}
            </div>
         </div>

         {/* 3. Analytics Section */}
         {hasPermission('VIEW_ANALYTICS') && (
            <div className="space-y-6">
               <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                  <div className="flex flex-col">
                     <div className="flex items-center gap-2 text-[#403424] font-bold text-lg uppercase tracking-wide"><TrendingUp className="text-[#95a77c]" /> Business Intelligence</div>
                     {autoTimeMessage && <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium mt-1 ml-1 animate-fade-in"><Moon size={10} /> {autoTimeMessage}</div>}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                     <div className="flex bg-white border border-[#403424]/10 rounded-lg p-1 shadow-sm overflow-x-auto max-w-full">
                        <button onClick={() => setDashboardBranch('ALL')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${dashboardBranch === 'ALL' ? 'bg-[#eff2e7] text-[#403424]' : 'text-[#403424]/50 hover:bg-[#f9faf7]'}`}>All Branches</button>
                        {branches.map(b => (
                           <button key={b.id} onClick={() => setDashboardBranch(b.id)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${dashboardBranch === b.id ? 'bg-[#eff2e7] text-[#403424]' : 'text-[#403424]/50 hover:bg-[#f9faf7]'}`}>{b.name}</button>
                        ))}
                     </div>
                     <div className="flex bg-white border border-[#403424]/10 rounded-lg p-1 shadow-sm overflow-x-auto">
                        {(['TODAY', 'YESTERDAY', '7D', '30D'] as TimeRange[]).map(range => (
                           <button key={range} onClick={() => setTimeRange(range)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${timeRange === range ? 'bg-[#eff2e7] text-[#403424]' : 'text-[#403424]/50 hover:bg-[#f9faf7]'}`}>{range === 'TODAY' ? 'Today' : range === 'YESTERDAY' ? 'Yesterday' : range === '7D' ? 'Last 7 Days' : 'Last 30 Days'}</button>
                        ))}
                     </div>
                  </div>
               </div>

               {/* Consolidated Financial Overview (Compact) */}
               <h3 className="text-sm font-bold text-[#403424]/70 uppercase tracking-wide mt-2">Financial Overview</h3>
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* 1. Total Revenue */}
                  <div className="bg-white p-3 rounded-xl border border-[#403424]/10 shadow-sm flex flex-col justify-between h-full">
                     <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-bold text-[#403424]/60 uppercase tracking-wide leading-tight">Total Revenue</p>
                        <div className="p-1.5 bg-slate-50 rounded-md text-slate-600"><Wallet size={16} /></div>
                     </div>
                     <h3 className="text-lg font-bold text-[#403424] leading-none">₹{revenueBreakdown.total.toLocaleString()}</h3>
                  </div>

                  {/* 2. Cash Sales */}
                  <div className="bg-white p-3 rounded-xl border border-[#403424]/10 shadow-sm flex flex-col justify-between h-full">
                     <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-bold text-[#403424]/60 uppercase tracking-wide leading-tight">Cash Sales</p>
                        <div className="p-1.5 bg-emerald-50 rounded-md text-emerald-600"><Banknote size={16} /></div>
                     </div>
                     <h3 className="text-lg font-bold text-[#403424] leading-none">₹{revenueBreakdown.cash.toLocaleString()}</h3>
                  </div>

                  {/* 3. Online Sales */}
                  <div className="bg-white p-3 rounded-xl border border-[#403424]/10 shadow-sm flex flex-col justify-between h-full">
                     <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-bold text-[#403424]/60 uppercase tracking-wide leading-tight">Online Sales</p>
                        <div className="p-1.5 bg-blue-50 rounded-md text-blue-600"><QrCode size={16} /></div>
                     </div>
                     <div className="flex flex-col">
                        <h3 className="text-lg font-bold text-[#403424] leading-none">₹{revenueBreakdown.online.toLocaleString()}</h3>
                        <span className="text-[9px] text-[#403424]/40 mt-1">UPI & Card</span>
                     </div>
                  </div>

                  {/* 4. Avg Daily Sales */}
                  <div className="bg-white p-3 rounded-xl border border-[#403424]/10 shadow-sm flex flex-col justify-between h-full">
                     <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-bold text-[#403424]/60 uppercase tracking-wide leading-tight">Avg Daily Sales</p>
                        <div className="p-1.5 bg-emerald-50 rounded-md text-emerald-600"><IndianRupee size={16} /></div>
                     </div>
                     <h3 className="text-lg font-bold text-[#403424] leading-none">₹{Math.round(salesStats.avgDailySales).toLocaleString()}</h3>
                  </div>

                  {/* 5. Avg Daily Orders */}
                  <div className="bg-white p-3 rounded-xl border border-[#403424]/10 shadow-sm flex flex-col justify-between h-full">
                     <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-bold text-[#403424]/60 uppercase tracking-wide leading-tight">Avg Daily Orders</p>
                        <div className="p-1.5 bg-blue-50 rounded-md text-blue-600"><Receipt size={16} /></div>
                     </div>
                     <h3 className="text-lg font-bold text-[#403424] leading-none">{Math.round(salesStats.avgDailyVolume)}</h3>
                  </div>

                  {/* 6. Avg Order Value */}
                  <div className="bg-white p-3 rounded-xl border border-[#403424]/10 shadow-sm flex flex-col justify-between h-full">
                     <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-bold text-[#403424]/60 uppercase tracking-wide leading-tight">Avg Order Value</p>
                        <div className="p-1.5 bg-violet-50 rounded-md text-violet-600"><BarChart3 size={16} /></div>
                     </div>
                     <h3 className="text-lg font-bold text-[#403424] leading-none">₹{Math.round(salesStats.avgOrderValue)}</h3>
                  </div>
               </div>

               {/* Revenue Trends (30 Day Spline Area) */}
               <h3 className="text-sm font-bold text-[#403424]/70 uppercase tracking-wide mt-4">Revenue Trends (Last 30 Days)</h3>
               <div className="bg-white p-4 rounded-xl shadow-sm border border-[#403424]/10">
                  <div className="h-72">
                     <ReactApexChart options={revenueChartOptions} series={last30DaysData.series} type="area" height="100%" />
                  </div>
               </div>

               {/* Operational Stats */}
               <h3 className="text-sm font-bold text-[#403424]/70 uppercase tracking-wide mt-4">Operational Stats</h3>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Total Check-Outs" value={totalTaken} icon={<Package size={20} className="text-[#95a77c]" />} color="bg-white" />
                  <StatCard title="Returns" value={totalReturned} icon={<RotateCcw size={20} className="text-amber-500" />} color="bg-white" />
                  <StatCard title="Total Wastage" value={totalWaste} icon={<Trash2 size={20} className="text-red-500" />} color="bg-white" />
                  <StatCard title="Net Consumed" value={totalSold} icon={<ShoppingBag size={20} className="text-[#95a77c]" />} color="bg-white" />
               </div>

               {/* Best Sellers & Category */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-[#403424]/10">
                     <h3 className="text-sm font-bold text-[#403424]/70 mb-4 flex items-center gap-2"><Sparkles size={16} className="text-amber-500" /> Best Sellers (Menu Items)</h3>
                     <div className="h-64">
                        {topMenuData.length > 0 ? (
                           <ReactApexChart options={bestSellerOptions} series={[{ name: 'Sales', data: topMenuData.map(d => d.value) }]} type="bar" height="100%" />
                        ) : <div className="h-full flex items-center justify-center text-[#403424]/40 text-sm">No sales data available.</div>}
                     </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-[#403424]/10">
                     <h3 className="text-sm font-bold text-[#403424]/70 mb-4">Inventory Category Share</h3>
                     <div className="h-64">
                        <ReactApexChart options={categoryOptions} series={categoryData.map(d => d.value)} type="donut" height="100%" />
                     </div>
                  </div>
               </div>

               {/* Last 7 Days Table */}
               <div className="bg-white rounded-xl shadow-sm border border-[#403424]/10 overflow-hidden">
                  <div className="p-4 border-b border-[#403424]/10 flex items-center gap-2 bg-[#f9faf7]">
                     <CalendarDays size={16} className="text-[#95a77c]" />
                     <h3 className="text-sm font-bold text-[#403424]/70 uppercase tracking-wide">Last 7 Days Performance</h3>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                        <thead className="text-xs text-[#403424]/50 bg-white border-b border-[#403424]/10 uppercase font-semibold">
                           <tr><th className="p-3">Date</th><th className="p-3 text-center">Orders</th><th className="p-3 text-right">Cash</th><th className="p-3 text-right">Online</th><th className="p-3 text-right font-bold text-[#403424]">Total Revenue</th></tr>
                        </thead>
                        <tbody className="divide-y divide-[#403424]/5">
                           {last7DaysPerformance.map((row, idx) => (
                              <tr key={idx} className="hover:bg-[#f9faf7] transition-colors">
                                 <td className="p-3 font-medium text-[#403424]">{row.displayDate}</td><td className="p-3 text-center text-[#403424]/70">{row.orders}</td><td className="p-3 text-right text-emerald-600">₹{row.cash.toLocaleString()}</td><td className="p-3 text-right text-blue-600">₹{row.online.toLocaleString()}</td><td className="p-3 text-right font-bold text-[#403424]">₹{row.total.toLocaleString()}</td>
                              </tr>
                           ))}
                           {last7DaysPerformance.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-[#403424]/40 italic">No sales data for the last 7 days.</td></tr>}
                        </tbody>
                     </table>
                  </div>
               </div>

               {/* Reconciliation Chart */}
               <div className="bg-white p-4 rounded-xl shadow-sm border border-[#403424]/10">
                  <h3 className="text-sm font-bold text-[#403424]/70 mb-4 flex items-center gap-2"><Scale size={16} className="text-indigo-600" /> Sales vs. Usage Reconciliation</h3>
                  <div className="h-64">
                     {reconciliationData.length > 0 ? (
                        <ReactApexChart
                           options={reconOptions}
                           series={[
                              { name: 'Physical Usage (Raw Pcs)', data: reconciliationData.map(d => d.physicalUsage) },
                              { name: 'Recorded Sales (Approx Raw)', data: reconciliationData.map(d => d.recordedSales) }
                           ]}
                           type="bar"
                           height="100%"
                        />
                     ) : <div className="h-full flex items-center justify-center text-[#403424]/40 text-sm">No data for reconciliation.</div>}
                  </div>
                  <p className="text-xs text-[#403424]/40 mt-2 text-center italic">Blue Bar (Stock) should match Green Bar (Sales). Higher Blue = Potential Loss.</p>
               </div>
            </div>
         )}

         {/* 4. Gemini Analyst Section */}
         {hasPermission('VIEW_ANALYTICS') && (
            <div className="bg-[#403424] rounded-xl p-6 text-white shadow-lg mt-8">
               <div className="flex items-start gap-4">
                  <div className="p-3 bg-white/10 rounded-full"><Sparkles className="text-[#95a77c]" size={24} /></div>
                  <div className="flex-1">
                     <h3 className="text-lg font-semibold mb-2">Gemini Analyst</h3>
                     {!aiInsight ? (
                        <p className="text-white/60 mb-4 text-sm">Get intelligent insights about consumption patterns, waste, and category popularity.</p>
                     ) : (
                        <div className="prose prose-invert max-w-none text-sm bg-white/5 p-4 rounded-lg mb-4"><pre className="whitespace-pre-wrap font-sans text-white/80">{aiInsight}</pre></div>
                     )}
                     <button onClick={handleAskAI} disabled={loadingAi} className="bg-[#95a77c] hover:bg-[#85966d] disabled:bg-[#95a77c]/50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2">{loadingAi ? 'Analyzing...' : 'Generate Insights'}</button>
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
                        <input type="text" required autoFocus placeholder="e.g. Clean the deep fryer" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 outline-none" />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign To</label>
                        <div className="relative">
                           <UserIcon size={16} className="absolute left-3 top-2.5 text-slate-400" />
                           <select required value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)} className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 outline-none bg-white">
                              <option value="">Select Staff Member</option>
                              {users.map(u => (<option key={u.id} value={u.id}>{u.name} ({u.role})</option>))}
                           </select>
                        </div>
                     </div>
                     <button type="submit" disabled={!newTaskText || !assignedUserId} className="w-full py-2.5 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition-colors disabled:opacity-50">Assign Task</button>
                  </form>
               </div>
            </div>
         )}

         {/* Ledger Quick Action Modal */}
         <LedgerEntryModal
            isOpen={ledgerModal.isOpen}
            onClose={() => setLedgerModal({ ...ledgerModal, isOpen: false })}
            forcedType={ledgerModal.type}
         />
      </div>
   );
};

export default Dashboard;
