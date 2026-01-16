import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { IndianRupee, Copy, CheckCircle2, ShoppingCart, Truck, Search, AlertCircle } from 'lucide-react';
import { SKUCategory } from '../types';

const StockOrdering: React.FC = () => {
  const { skus } = useStore();
  const [orderInputs, setOrderInputs] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  // Filter SKUs (exclude consumables if desired, but usually needed for ordering)
  const filteredSkus = skus.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalOrderValue = useMemo(() => {
      let total = 0;
      Object.entries(orderInputs).forEach(([skuId, qty]) => {
          const sku = skus.find(s => s.id === skuId);
          if (sku && sku.costPrice) {
              total += qty * sku.costPrice;
          }
      });
      return total;
  }, [orderInputs, skus]);

  const handleInputChange = (skuId: string, val: string) => {
      const num = parseInt(val);
      setOrderInputs(prev => ({
          ...prev,
          [skuId]: isNaN(num) ? 0 : num
      }));
  };

  const copyOrderToClipboard = () => {
      const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      let message = `*Stock Order - ${dateStr}*\n\n`;
      
      let hasItems = false;
      
      // Group by Category for cleaner message
      const groupedItems: Record<string, string[]> = {};
      
      Object.entries(orderInputs).forEach(([skuId, qty]) => {
          if (qty > 0) {
              const sku = skus.find(s => s.id === skuId);
              if (sku) {
                  hasItems = true;
                  if (!groupedItems[sku.category]) groupedItems[sku.category] = [];
                  groupedItems[sku.category].push(`- ${sku.name}: *${qty} pkts*`);
              }
          }
      });

      if (!hasItems) return;

      Object.entries(groupedItems).forEach(([cat, lines]) => {
          message += `*${cat}*\n${lines.join('\n')}\n\n`;
      });

      message += `----------------\n*Est. Value: ₹${totalOrderValue.toLocaleString()}*`;

      navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pb-24 max-w-4xl mx-auto">
        <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
               <Truck className="text-blue-600" /> Stock Ordering
            </h2>
            <p className="text-slate-500">Generate vendor order lists based on required packets.</p>
        </div>

        {/* Search & Actions */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-10">
            <div className="relative w-full md:w-auto md:flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search raw materials..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            
            {totalOrderValue > 0 && (
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end bg-slate-50 p-2 rounded-lg border border-slate-200 md:border-none md:bg-transparent md:p-0">
                    <div>
                        <span className="text-xs font-bold text-slate-500 uppercase block md:hidden">Est. Total</span>
                        <span className="text-lg font-bold text-slate-800 flex items-center gap-1">
                            <IndianRupee size={16} className="text-slate-400"/>
                            {totalOrderValue.toLocaleString()}
                        </span>
                    </div>
                    <button 
                        onClick={copyOrderToClipboard}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all shadow-md active:scale-95"
                    >
                        {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                        {copied ? 'Copied!' : 'Copy Order'}
                    </button>
                </div>
            )}
        </div>

        {/* Order Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSkus.map(sku => {
                const qty = orderInputs[sku.id] || 0;
                return (
                    <div key={sku.id} className={`bg-white p-4 rounded-xl border transition-all ${qty > 0 ? 'border-blue-400 shadow-md ring-1 ring-blue-100' : 'border-slate-200 shadow-sm'}`}>
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h4 className="font-bold text-slate-700 text-sm">{sku.name}</h4>
                                <p className="text-xs text-slate-400 mt-0.5">{sku.piecesPerPacket} pcs/pkt • {sku.category}</p>
                            </div>
                            {sku.costPrice && (
                                <span className="text-xs font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">₹{sku.costPrice}</span>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => handleInputChange(sku.id, Math.max(0, qty - 1).toString())}
                                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center text-lg font-bold"
                            >
                                -
                            </button>
                            <input 
                                type="number" 
                                min="0"
                                value={qty === 0 ? '' : qty}
                                onChange={(e) => handleInputChange(sku.id, e.target.value)}
                                placeholder="0"
                                className={`flex-1 text-center font-bold text-lg h-10 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${qty > 0 ? 'border-blue-200 text-blue-700' : 'border-slate-200 text-slate-700'}`}
                            />
                            <button 
                                onClick={() => handleInputChange(sku.id, (qty + 1).toString())}
                                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center text-lg font-bold"
                            >
                                +
                            </button>
                        </div>
                        
                        {qty > 0 && sku.costPrice && (
                            <div className="mt-2 text-right text-xs font-bold text-blue-600">
                                ₹{(qty * sku.costPrice).toLocaleString()}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>

        {filteredSkus.length === 0 && (
            <div className="text-center py-12 text-slate-400">
                <ShoppingCart size={48} className="mx-auto mb-3 opacity-20" />
                <p>No items found matching "{searchQuery}"</p>
            </div>
        )}
    </div>
  );
};

export default StockOrdering;