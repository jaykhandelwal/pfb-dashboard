import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { getLocalISOString } from '../constants';
import { TransactionType, SKU } from '../types';
import { 
  BarChart2, X, Calendar, Loader2, ArrowRight, TrendingUp, 
  TrendingDown, Star, Minus, Plus, CheckCircle2, AlertCircle, 
  RefreshCcw, IndianRupee, ClipboardCopy 
} from 'lucide-react';

interface GeneratedOrderItem {
  sku: SKU;
  trend: 'up' | 'down' | 'stable';
  dailyAvgPackets: number;
  projectedBurnPackets: number;
  suggestPkts: number;
  isTopSeller: boolean;
  sharePercent: number;
  isOOS: boolean;
}

const StockOrdering: React.FC = () => {
  const { skus, transactions, appSettings, storageUnits } = useStore();
  
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [arrivalDate, setArrivalDate] = useState<string>(() => {
      const d = new Date();
      d.setDate(d.getDate() + 1); // Default tomorrow
      return getLocalISOString(d);
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedOrder, setGeneratedOrder] = useState<GeneratedOrderItem[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // --- Logic ---
  
  const triggerGeneration = async () => {
      setIsGenerating(true);
      // Simulate analysis delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const results: GeneratedOrderItem[] = [];
      const today = new Date();
      const arrival = new Date(arrivalDate);
      const daysToArrival = Math.max(0, Math.ceil((arrival.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

      // Helper to get consumption for last N days
      const getConsumption = (days: number, skuId: string) => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - days);
          const cutoffStr = getLocalISOString(cutoff);
          
          return transactions
            .filter(t => t.skuId === skuId && (t.type === TransactionType.CHECK_OUT || t.type === TransactionType.WASTE) && t.date >= cutoffStr)
            .reduce((sum, t) => sum + t.quantityPieces, 0);
      };

      const totalConsumption7d = skus.reduce((acc, s) => acc + getConsumption(7, s.id), 0);

      skus.forEach(sku => {
          if (sku.category === 'Consumables') return; 

          const consumed7d = getConsumption(7, sku.id);
          const consumed90d = getConsumption(90, sku.id);
          
          const dailyAvg7d = consumed7d / 7;
          const dailyAvg90d = consumed90d / 90;
          
          // Trend Analysis
          let trend: 'up' | 'down' | 'stable' = 'stable';
          if (dailyAvg7d > dailyAvg90d * 1.15) trend = 'up';
          else if (dailyAvg7d < dailyAvg90d * 0.85) trend = 'down';

          const sharePercent = totalConsumption7d > 0 ? Math.round((consumed7d / totalConsumption7d) * 100) : 0;
          const isTopSeller = sharePercent > 10; 

          // Packets Calculation
          const packetSize = sku.piecesPerPacket || 1;
          const dailyAvgPackets = Math.ceil(dailyAvg7d / packetSize);
          const projectedBurnPackets = Math.ceil((dailyAvg7d * daysToArrival) / packetSize);
          
          // Suggestion Logic: Cover 3 days of stock after arrival + safety buffer
          const safetyBuffer = isTopSeller ? 1.5 : 1.2;
          const coverageDays = 3;
          let suggestPkts = Math.ceil((dailyAvgPackets * coverageDays * safetyBuffer) + projectedBurnPackets);
          
          // Ensure at least 1 packet if it's a selling item
          if (sharePercent > 1 && suggestPkts === 0) suggestPkts = 1;

          if (suggestPkts > 0 || isTopSeller) {
              results.push({
                  sku,
                  trend,
                  dailyAvgPackets,
                  projectedBurnPackets,
                  suggestPkts,
                  isTopSeller,
                  sharePercent,
                  isOOS: false // Logic requires real-time stock check, placeholder for now
              });
          }
      });

      setGeneratedOrder(results.sort((a,b) => b.sharePercent - a.sharePercent));
      setHasGenerated(true);
      setIsGenerating(false);
  };

  const updateItemQuantity = (index: number, newQty: number) => {
      setGeneratedOrder(prev => {
          const updated = [...prev];
          updated[index].suggestPkts = Math.max(0, newQty);
          return updated;
      });
  };

  // Capacity Logic
  const totalCapacityLitres = useMemo(() => {
      return storageUnits
        .filter(u => u.type === 'DEEP_FREEZER' && u.isActive)
        .reduce((sum, u) => sum + u.capacityLitres, 0);
  }, [storageUnits]);

  const litresPerPkt = Number(appSettings.stock_ordering_litres_per_packet) || 2.3;
  // If no freezer defined, assume arbitrary high number (infinite) or 0
  const maxCapacityPkts = totalCapacityLitres > 0 ? Math.floor(totalCapacityLitres / litresPerPkt) : 9999;
  
  const currentTotalPkts = generatedOrder.reduce((sum, item) => sum + item.suggestPkts, 0);
  const capacityDiff = Math.max(0, maxCapacityPkts - currentTotalPkts);

  const fillSlack = () => {
      if (generatedOrder.length === 0) return;
      // Add slack capacity to the top selling item (index 0 after sort)
      updateItemQuantity(0, generatedOrder[0].suggestPkts + capacityDiff);
  };

  const totalOrderValue = generatedOrder.reduce((sum, item) => sum + (item.suggestPkts * (item.sku.costPrice || 0)), 0);

  const copyOrderToClipboard = () => {
      const text = generatedOrder
        .filter(i => i.suggestPkts > 0)
        .map(i => `${i.sku.name}: ${i.suggestPkts} pkts`)
        .join('\n');
      
      navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto pb-16">
        <div className="mb-8 flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <BarChart2 className="text-indigo-600" /> Stock Ordering
                </h2>
                <p className="text-slate-500">Analyze trends and generate purchase orders.</p>
            </div>
            <button 
                onClick={() => setIsGeneratorOpen(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
                <RefreshCcw size={16} /> Open Generator
            </button>
        </div>

        {/* Placeholder / Empty State */}
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-sm">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrendingUp size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">Smart Procurement</h3>
            <p className="text-slate-500 max-w-lg mx-auto mb-8 leading-relaxed">
                Use the Smart Order Generator to calculate optimal stock levels based on your 7-day and 90-day consumption history, accounting for delivery lead times and freezer capacity.
            </p>
            <button 
                onClick={() => setIsGeneratorOpen(true)}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-base shadow-lg hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
            >
                Start Analysis
            </button>
        </div>

        {/* Generator Modal */}
        {isGeneratorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in-95 relative">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50 shrink-0">
                      <div>
                          <h3 className="font-bold text-indigo-900 flex items-center gap-2"><BarChart2 size={18}/> Smart Order Generator</h3>
                          <p className="text-xs text-indigo-700">Predictive logic using Blended Trends (7d/90d) & Order Frequency</p>
                      </div>
                      <button onClick={() => setIsGeneratorOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                  </div>
                  
                  <div className="p-6 flex-1 overflow-y-auto">
                      <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
                          <div className="flex-1 w-full">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Expected Stock Arrival Date</label>
                              <div className="flex items-center border border-slate-300 rounded-xl px-3 py-2 bg-slate-50">
                                  <Calendar size={16} className="text-slate-400 mr-2"/>
                                  <input 
                                      type="date"
                                      value={arrivalDate}
                                      onChange={(e) => setArrivalDate(e.target.value)}
                                      className="bg-transparent w-full text-sm font-bold text-slate-700 outline-none"
                                  />
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1">
                                  Logic: 60% weight to 90-day volume, 40% to 7-day velocity. Items frequently ordered (Top 20%) get a 15% safety buffer.
                              </p>
                          </div>
                          <button 
                              onClick={triggerGeneration}
                              disabled={isGenerating}
                              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-colors w-full md:w-auto flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                              {isGenerating ? 'Analyzing...' : 'Generate Suggestion'}
                          </button>
                      </div>

                      {generatedOrder.length > 0 ? (
                          <div className="space-y-4 animate-fade-in">
                              <div className="overflow-hidden border border-slate-200 rounded-xl">
                                  <table className="w-full text-left text-sm">
                                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                                          <tr>
                                              <th className="p-3">Item</th>
                                              <th className="p-3 text-center">Daily Burn (7d)</th>
                                              <th className="p-3 text-center">Proj. Stock (Arrival)</th>
                                              <th className="p-3 text-right bg-emerald-50 text-emerald-700 w-32">Order Qty</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                          {generatedOrder.map((item, idx) => (
                                              <tr key={idx} className="hover:bg-slate-50 group">
                                                  <td className="p-3 font-bold text-slate-700">
                                                      <div className="flex items-center gap-1.5">
                                                          {item.sku.name}
                                                          {item.isTopSeller && (
                                                              <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5" title="High Order Frequency (Popular)">
                                                                  <Star size={8} fill="currentColor" /> Top
                                                              </span>
                                                          )}
                                                          {item.trend === 'up' && (
                                                              <span title="Consumption Trending Up (+10%)">
                                                                  <TrendingUp size={12} className="text-red-500" />
                                                              </span>
                                                          )}
                                                          {item.trend === 'down' && (
                                                              <span title="Consumption Trending Down (-10%)">
                                                                  <TrendingDown size={12} className="text-emerald-500" />
                                                              </span>
                                                          )}
                                                      </div>
                                                      <span className="block text-[9px] text-slate-400 font-normal">{item.sharePercent}% of Ideal Mix</span>
                                                      {item.isOOS && (
                                                          <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase inline-block mt-0.5">OOS</span>
                                                      )}
                                                  </td>
                                                  <td className="p-3 text-center text-slate-500">{item.dailyAvgPackets} pkts</td>
                                                  <td className="p-3 text-center">
                                                      {item.projectedBurnPackets > 0 ? (
                                                          <span className="text-red-500 font-bold">-{item.projectedBurnPackets} used</span>
                                                      ) : (
                                                          <span className="text-slate-400">-</span>
                                                      )}
                                                  </td>
                                                  <td className="p-3 text-right bg-emerald-50/30">
                                                      <div className="flex items-center justify-end gap-1">
                                                          <button 
                                                            onClick={() => updateItemQuantity(idx, item.suggestPkts - 1)}
                                                            className="w-6 h-6 rounded bg-white border border-emerald-200 text-emerald-700 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                                                          >
                                                              <Minus size={12} />
                                                          </button>
                                                          <input 
                                                            type="number" 
                                                            min="0"
                                                            value={item.suggestPkts}
                                                            onChange={(e) => updateItemQuantity(idx, parseInt(e.target.value) || 0)}
                                                            className="w-12 h-6 text-center border border-emerald-300 rounded text-xs font-bold text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                          />
                                                          <button 
                                                            onClick={() => updateItemQuantity(idx, item.suggestPkts + 1)}
                                                            className="w-6 h-6 rounded bg-white border border-emerald-200 text-emerald-700 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                                                          >
                                                              <Plus size={12} />
                                                          </button>
                                                      </div>
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      ) : (
                          <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                              {hasGenerated ? (
                                <>
                                  <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
                                  <p className="font-bold text-slate-700">Fridge is Fully Stocked!</p>
                                  <p className="text-sm">Based on current trends and capacity, no new stock is needed.</p>
                                </>
                              ) : (
                                <>
                                  <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
                                  <p>Select a date and click Generate.</p>
                                </>
                              )}
                          </div>
                      )}
                  </div>

                  {generatedOrder.length > 0 && (
                      <div className="p-4 border-t border-slate-200 bg-white z-10 rounded-b-2xl shadow-[0_-10px_20px_rgba(0,0,0,0.05)] shrink-0">
                          {/* Capacity Adjuster */}
                          {capacityDiff > 0 && (
                              <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2 flex justify-between items-center animate-fade-in-up">
                                  <div className="flex items-center gap-2 text-amber-800">
                                      <AlertCircle size={16} />
                                      <span className="text-xs font-bold">Unused Capacity: {capacityDiff} pkts</span>
                                  </div>
                                  <button 
                                    onClick={fillSlack}
                                    className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                  >
                                      <RefreshCcw size={12} /> Smart Fill Top Item
                                  </button>
                              </div>
                          )}

                          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                              <div className="flex gap-6 items-center">
                                  <div>
                                      <span className="text-xs font-bold text-slate-500 uppercase">Total Order</span>
                                      <p className="text-xl font-bold text-slate-800">
                                          {currentTotalPkts} pkts
                                      </p>
                                  </div>
                                  <div className="h-8 w-px bg-slate-200"></div>
                                  <div>
                                      <span className="text-xs font-bold text-slate-500 uppercase">Est. Value</span>
                                      <p className="text-xl font-bold text-emerald-600 flex items-center gap-0.5">
                                          <IndianRupee size={16} />{totalOrderValue.toLocaleString()}
                                      </p>
                                  </div>
                              </div>
                              <button 
                                  onClick={copyOrderToClipboard}
                                  className="text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors border border-indigo-100"
                              >
                                  {copySuccess ? <CheckCircle2 size={18}/> : <ClipboardCopy size={18}/>}
                                  {copySuccess ? 'Copied!' : 'Copy List'}
                              </button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default StockOrdering;