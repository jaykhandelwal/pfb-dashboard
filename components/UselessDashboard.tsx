
import React, { useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { X } from 'lucide-react';

interface UselessDashboardProps {
  onClose: () => void;
}

export const UselessDashboard: React.FC<UselessDashboardProps> = ({ onClose }) => {
  const { orders, transactions } = useStore();

  // Calculate "Useless" Global Stats
  const stats = useMemo(() => {
    // 1. Total Momos Sold (Pieces)
    let totalPieces = 0;
    orders.forEach(o => {
        o.items.forEach(item => {
            if (item.consumed && item.consumed.length > 0) {
                totalPieces += item.consumed.reduce((sum, c) => sum + c.quantity, 0);
            } else {
                const qty = item.quantity;
                if (item.name.toLowerCase().includes('platter')) totalPieces += (12 * qty);
                else if (item.variant === 'HALF') totalPieces += (5 * qty);
                else totalPieces += (10 * qty);
            }
        });
        if (o.customSkuItems) {
            totalPieces += o.customSkuItems.reduce((sum, i) => sum + i.quantity, 0);
        }
    });

    // 2. Weight Sold (Estimate 35g per momo average)
    // Fun Stat: Weight in "Fat Cats" (Assuming avg fat cat is 5kg)
    const weightKg = (totalPieces * 0.035);
    const weightInCats = weightKg / 5;

    // 3. Total Revenue (GDP)
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

    // 4. Total Operations
    const totalOps = transactions.length;

    // 5. Total Waste
    const totalWaste = transactions
        .filter(t => t.type === 'WASTE')
        .reduce((sum, t) => sum + t.quantityPieces, 0);

    return { totalPieces, weightInCats, totalRevenue, totalOps, totalWaste };
  }, [orders, transactions]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm overflow-y-auto animate-in fade-in zoom-in-95 duration-300 font-sans selection:bg-pink-500 selection:text-white">
      <div className="min-h-screen flex flex-col p-6 relative">
        
        {/* Close Button */}
        <button 
            onClick={onClose}
            className="absolute top-6 right-6 bg-slate-800 text-slate-400 hover:text-white hover:bg-red-600 p-3 rounded-full transition-all z-50 border border-slate-700"
        >
            <X size={32} />
        </button>

        {/* Title Section */}
        <div className="text-center mt-10 mb-12">
            <h1 
                style={{ fontFamily: "'Mynerve', cursive" }}
                className="text-5xl md:text-8xl text-white drop-shadow-2xl tracking-wide transform -rotate-2 cursor-default"
            >
                useless <br className="md:hidden"/> dashboard
            </h1>
            <p className="text-slate-400 text-xl md:text-2xl font-bold mt-4 inline-block px-8 py-2 rounded-full border border-slate-800 bg-slate-900/50">
                Stats you absolutely didn't need 🤪
            </p>
        </div>

        {/* Cards Grid */}
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
            
            {/* 1. Momos Eaten */}
            <div className="bg-slate-900/60 border-2 border-slate-800 p-8 rounded-[2.5rem] text-center transform hover:scale-105 transition-all duration-300 shadow-2xl shadow-purple-900/20 hover:border-purple-500 hover:shadow-purple-500/40 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                    <div className="text-7xl mb-4">🥟</div>
                    <h3 className="text-purple-400 text-lg font-bold uppercase tracking-widest mb-2">Momos Sacrificed</h3>
                    <div className="text-5xl md:text-6xl font-black text-white">
                        {stats.totalPieces.toLocaleString()}
                    </div>
                    <p className="text-slate-500 mt-2 font-medium">Delicious little casualties.</p>
                </div>
            </div>

            {/* 2. Weight in Cats */}
            <div className="bg-slate-900/60 border-2 border-slate-800 p-8 rounded-[2.5rem] text-center transform hover:-rotate-1 hover:scale-105 transition-all duration-300 shadow-2xl shadow-orange-900/20 hover:border-orange-500 hover:shadow-orange-500/40 group relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                 <div className="relative z-10">
                    <div className="text-7xl mb-4">🐈</div>
                    <h3 className="text-orange-400 text-lg font-bold uppercase tracking-widest mb-2">Mass Sold</h3>
                    <div className="text-5xl md:text-6xl font-black text-white">
                        {Math.round(stats.weightInCats).toLocaleString()}
                    </div>
                    <p className="text-slate-500 mt-2 font-medium">Equivalent to this many fat cats.</p>
                </div>
            </div>

            {/* 3. Revenue */}
            <div className="bg-slate-900/60 border-2 border-slate-800 p-8 rounded-[2.5rem] text-center transform hover:rotate-1 hover:scale-105 transition-all duration-300 shadow-2xl shadow-emerald-900/20 hover:border-emerald-500 hover:shadow-emerald-500/40 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                    <div className="text-7xl mb-4">🤑</div>
                    <h3 className="text-emerald-400 text-lg font-bold uppercase tracking-widest mb-2">Cash Money</h3>
                    <div className="text-5xl md:text-6xl font-black text-white flex items-start justify-center">
                        <span className="text-3xl mt-2 mr-1 text-emerald-500/50">₹</span>
                        {stats.totalRevenue > 100000 
                            ? `${(stats.totalRevenue / 100000).toFixed(1)}L` 
                            : stats.totalRevenue.toLocaleString()}
                    </div>
                    <p className="text-slate-500 mt-2 font-medium">Don't spend it all in one place!</p>
                </div>
            </div>

            {/* 4. Operations */}
            <div className="bg-slate-900/60 border-2 border-slate-800 p-8 rounded-[2.5rem] text-center transform hover:scale-105 transition-all duration-300 shadow-2xl shadow-blue-900/20 hover:border-blue-500 hover:shadow-blue-500/40 group relative overflow-hidden md:col-span-2 lg:col-span-1">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10 flex flex-col justify-center h-full">
                    <div className="text-7xl mb-4">🖱️</div>
                    <h3 className="text-blue-400 text-lg font-bold uppercase tracking-widest mb-2">Button Clicks</h3>
                    <div className="text-5xl md:text-6xl font-black text-white">
                        {stats.totalOps.toLocaleString()}
                    </div>
                    <p className="text-slate-500 mt-2 font-medium">Database writes. Very exciting.</p>
                </div>
            </div>

            {/* 5. Waste */}
            <div className="bg-slate-900/60 border-2 border-slate-800 p-8 rounded-[2.5rem] text-center transform hover:scale-105 transition-all duration-300 shadow-2xl shadow-red-900/20 hover:border-red-500 hover:shadow-red-500/40 group relative overflow-hidden md:col-span-3 lg:col-span-2">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                {/* Background Element */}
                <div className="absolute -right-10 -bottom-10 text-9xl opacity-5 rotate-12 grayscale">🗑️</div>
                
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-8 h-full">
                    <div className="text-8xl drop-shadow-2xl">💀</div>
                    <div className="text-left">
                        <h3 className="text-red-400 text-xl font-bold uppercase tracking-widest mb-1">The Graveyard</h3>
                        <div className="text-6xl md:text-8xl font-black text-white">
                            {stats.totalWaste.toLocaleString()}
                        </div>
                        <p className="text-slate-500 mt-2 font-medium text-lg">Momos that went to the dark side.</p>
                    </div>
                </div>
            </div>

        </div>

        <div className="mt-auto text-center text-slate-700 font-mono text-xs uppercase tracking-widest pb-4 font-bold">
            CONFIDENTIAL // MOMO MAFIA // TOP SECRET
        </div>
      </div>
    </div>
  );
};
