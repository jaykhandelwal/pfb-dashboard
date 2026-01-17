import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { SKU, TransactionType } from '../types';
import { ShoppingCart, Search, Copy, IndianRupee, Package } from 'lucide-react';

interface OrderItem {
  sku: SKU;
  currentStock: number;
  suggestPkts: number;
}

const StockOrdering: React.FC = () => {
  const { skus, transactions } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [orderInputs, setOrderInputs] = useState<Record<string, number>>({});

  // 1. Calculate Current Stock (Fridge)
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

  // 2. Generate Order List based on inputs
  const generatedOrder: OrderItem[] = useMemo(() => {
      return skus.map(sku => ({
          sku,
          currentStock: stockLevels[sku.id] || 0,
          suggestPkts: orderInputs[sku.id] || 0
      })).filter(item => item.suggestPkts > 0);
  }, [skus, stockLevels, orderInputs]);

  // 3. Calculate Total Value
  const totalOrderValue = useMemo(() => {
      return generatedOrder.reduce((acc, item) => {
          // Logic: Packets * Pieces Per Packet * Cost Per Piece
          const packetSize = item.sku.piecesPerPacket || 1;
          const costPerPiece = item.sku.costPrice || 0;
          return acc + (item.suggestPkts * packetSize * costPerPiece);
      }, 0);
  }, [generatedOrder]);

  const handleInputChange = (skuId: string, val: string) => {
      const num = parseInt(val) || 0;
      setOrderInputs(prev => ({ ...prev, [skuId]: num }));
  };

  const copyOrderToClipboard = () => {
      const lines = generatedOrder.map(item => 
          `- ${item.sku.name}: ${item.suggestPkts} pkts`
      );
      const text = `*New Stock Order*\n\n${lines.join('\n')}\n\n*Est. Value:* ₹${totalOrderValue.toLocaleString()}`;
      navigator.clipboard.writeText(text);
      alert("Order list copied to clipboard!");
  };

  const filteredSkus = skus.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="pb-20 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <ShoppingCart className="text-emerald-600" /> Stock Ordering
                </h2>
                <p className="text-slate-500 text-sm">Draft purchase orders for suppliers.</p>
            </div>
            
            {generatedOrder.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl flex items-center gap-4">
                    <div>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Est. Cost</p>
                        <p className="text-xl font-bold text-emerald-800">₹{totalOrderValue.toLocaleString()}</p>
                    </div>
                    <button 
                        onClick={copyOrderToClipboard}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors"
                    >
                        <Copy size={16} /> Copy List
                    </button>
                </div>
            )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Search raw materials..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
        </div>

        {/* SKU List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                        <tr>
                            <th className="p-4">Item Name</th>
                            <th className="p-4 text-center">Current Stock</th>
                            <th className="p-4 text-center">Pack Size</th>
                            <th className="p-4 text-center">Unit Cost</th>
                            <th className="p-4 w-32 text-center">Order (Pkts)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredSkus.map(sku => {
                            const currentQty = stockLevels[sku.id] || 0;
                            const currentPkts = Math.floor(currentQty / (sku.piecesPerPacket || 1));
                            const cost = sku.costPrice ? `₹${sku.costPrice}` : '-';
                            
                            return (
                                <tr key={sku.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-medium text-slate-700">{sku.name}</td>
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className={`font-bold ${currentQty < (sku.piecesPerPacket * 5) ? 'text-red-500' : 'text-slate-700'}`}>
                                                {currentPkts} pkts
                                            </span>
                                            <span className="text-[10px] text-slate-400">{currentQty} pcs</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center text-slate-500">{sku.piecesPerPacket} pcs</td>
                                    <td className="p-4 text-center text-slate-500">{cost}</td>
                                    <td className="p-4">
                                        <input 
                                            type="number" 
                                            min="0"
                                            className={`w-full border rounded-lg py-2 px-3 text-center outline-none focus:ring-2 focus:ring-emerald-500 font-bold ${orderInputs[sku.id] ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'border-slate-200'}`}
                                            placeholder="0"
                                            value={orderInputs[sku.id] || ''}
                                            onChange={(e) => handleInputChange(sku.id, e.target.value)}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredSkus.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">No items found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default StockOrdering;