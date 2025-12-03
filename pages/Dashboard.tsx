import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { DailyReportItem, TransactionType } from '../types';
import { StatCard } from '../components/StatCard';
import { TrendingUp, ShoppingBag, RotateCcw, Trash2, Sparkles, Store, Package, Activity, Scale } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line } from 'recharts';
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
  const { transactions, salesRecords, skus, branches } = useStore();
  const { hasPermission } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('TODAY');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

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

  // --- 2. Live Inventory Logic ---
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

  // --- 3. Analytics Calculation (Based on Range) ---
  const { reportData, trendData, reconciliationData } = useMemo(() => {
    if (!hasPermission('VIEW_ANALYTICS')) return { reportData: [], trendData: [], reconciliationData: [] };

    const report: Record<string, DailyReportItem> = {};
    const trendMap: Record<string, { date: string, incoming: number, outgoing: number, waste: number, diff: number }> = {};
    const reconMap: Record<string, { date: string, physicalUsage: number, recordedSales: number }> = {};
    
    // Determine Date Range Strings (YYYY-MM-DD)
    const todayStr = getLocalISOString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = getLocalISOString(yesterdayDate);
    
    // Calculate start date string for ranges
    let startDateStr = todayStr;
    const now = new Date();
    if (timeRange === '7D') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        startDateStr = getLocalISOString(d);
    } else if (timeRange === '30D') {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        startDateStr = getLocalISOString(d);
    }

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

    // Helper to check range
    const isInRange = (d: string) => {
        if (timeRange === 'TODAY') return d === todayStr;
        if (timeRange === 'YESTERDAY') return d === yesterdayStr;
        return d >= startDateStr && d <= todayStr;
    };

    // Process Transactions
    transactions.forEach(t => {
       if (!t.date || !isInRange(t.date)) return;

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
         // Returns reduce the net usage
         if(t.type === TransactionType.CHECK_IN) {
            reconMap[dateKey].physicalUsage -= t.quantityPieces;
         }
       } else if (t.type === TransactionType.WASTE) {
         trendMap[dateKey].waste += t.quantityPieces;
         // Wastage also reduces "Sold usage", as it wasn't sold.
         reconMap[dateKey].physicalUsage -= t.quantityPieces;
       }
    });

    // Process Sales Records for Reconciliation Graph
    salesRecords.forEach(r => {
        if (!r.date || !isInRange(r.date)) return;
        const dateKey = r.date;
        if (!reconMap[dateKey]) reconMap[dateKey] = { date: dateKey, physicalUsage: 0, recordedSales: 0 };
        reconMap[dateKey].recordedSales += r.quantitySold;
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
  }, [transactions, salesRecords, skus, timeRange, hasPermission]);

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

  useEffect(() => {
    setAiInsight(null);
  }, [timeRange]);

  return (
    <div className="space-y-8 pb-10">

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
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-2 text-[#403424] font-bold text-lg">
                <TrendingUp className="text-[#95a77c]" /> Business Intelligence
             </div>
             
             {/* Time Range Selector */}
             <div className="flex bg-white border border-[#403424]/10 rounded-lg p-1 shadow-sm">
                {(['TODAY', 'YESTERDAY', '7D', '30D'] as TimeRange[]).map(range => (
                   <button
                     key={range}
                     onClick={() => setTimeRange(range)}
                     className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
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

          {/* Stats Grid - RAW COUNTS */}
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

          {/* Reconciliation Chart (New) */}
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
                    <Bar dataKey="physicalUsage" name="Physical Usage (CheckOut - Returns)" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="recordedSales" name="Recorded Sales (POS + Online)" fill="#95a77c" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
               ) : (
                 <div className="h-full flex items-center justify-center text-[#403424]/40 text-sm">
                   No data for reconciliation.
                 </div>
               )}
            </div>
            <p className="text-xs text-[#403424]/40 mt-2 text-center italic">
               Blue Bar should match Green Bar. If Blue is higher, potential theft/loss occurred.
            </p>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Consumption by SKU */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-[#403424]/10">
              <h3 className="text-sm font-bold text-[#403424]/70 mb-4">Volume (Net Consumed Pcs)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.filter(i => i.sold > 0).sort((a,b) => b.sold - a.sold).slice(0, 10)} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e5e5" />
                    <XAxis type="number" stroke="#94a3b8" fontSize={10} />
                    <YAxis dataKey="skuName" type="category" width={100} style={{ fontSize: '10px', fill: '#403424' }} stroke="#e5e5e5" />
                    <Tooltip 
                       contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="sold" name="Consumed" fill="#95a77c" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Distribution */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-[#403424]/10">
              <h3 className="text-sm font-bold text-[#403424]/70 mb-4">Category Share</h3>
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

    </div>
  );
};

export default Dashboard;