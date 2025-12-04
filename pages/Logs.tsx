
import React, { useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { TransactionType } from '../types';
import { ShoppingBag, ArrowRightLeft, Trash2, Image as ImageIcon, Snowflake, Filter, X, ClipboardCheck, User as UserIcon, LayoutGrid, List, ZoomIn, Calendar, Store, ShieldAlert, Archive } from 'lucide-react';

const Logs: React.FC = () => {
  const { transactions, deletedTransactions, skus, branches, resetData, deleteTransactionBatch } = useStore();
  const { currentUser } = useAuth();
  
  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'LIST' | 'GALLERY'>('LIST');
  const [galleryBranchFilter, setGalleryBranchFilter] = useState<string>('ALL');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [dataScope, setDataScope] = useState<'ACTIVE' | 'DELETED'>('ACTIVE');

  // Check if current user is Admin
  const isAdmin = currentUser?.role === 'ADMIN';

  const getSkuName = (id: string) => skus.find(s => s.id === id)?.name || id;
  const getBranchName = (id: string) => {
    if (id === 'FRIDGE') return 'Main Fridge';
    return branches.find(b => b.id === id)?.name || id;
  };

  // Determine source based on scope
  const sourceTransactions = dataScope === 'ACTIVE' ? transactions : deletedTransactions;

  // Group transactions by batchId
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, {
      id: string,
      batchId?: string,
      date: string,
      timestamp: number,
      branchId: string,
      type: TransactionType,
      items: { skuName: string, qty: number }[],
      totalQty: number,
      hasImages: boolean,
      imageUrls: string[],
      userName?: string,
      // Deleted info
      deletedAt?: string,
      deletedBy?: string
    }> = {};

    sourceTransactions.forEach(t => {
      // Filter logic
      if (filterType !== 'ALL' && t.type !== filterType) return;

      // Use batchId if available, otherwise fallback to timestamp
      const branchId = t.branchId; 
      const key = t.batchId || `${t.timestamp}-${branchId}-${t.type}`;
      
      if (!groups[key]) {
        groups[key] = {
          id: key,
          batchId: t.batchId,
          date: t.date,
          timestamp: t.timestamp,
          branchId: branchId,
          type: t.type,
          items: [],
          totalQty: 0,
          hasImages: false,
          imageUrls: [],
          userName: t.userName,
          deletedAt: (t as any).deletedAt,
          deletedBy: (t as any).deletedBy
        };
      }
      
      groups[key].items.push({
        skuName: getSkuName(t.skuId),
        qty: t.quantityPieces
      });
      groups[key].totalQty += t.quantityPieces;
      
      // Check for images (Aggregate them for the group)
      if (t.imageUrls && t.imageUrls.length > 0) {
        groups[key].hasImages = true;
        // Avoid duplicates in the group view
        t.imageUrls.forEach(url => {
            if (!groups[key].imageUrls.includes(url)) {
                groups[key].imageUrls.push(url);
            }
        });
      } else if ((t as any).imageUrl) {
         // Legacy support
         groups[key].hasImages = true;
         groups[key].imageUrls.push((t as any).imageUrl);
      }
    });

    // Convert to array and sort by timestamp desc
    return Object.values(groups).sort((a, b) => b.timestamp - a.timestamp);
  }, [sourceTransactions, skus, branches, filterType]);

  // Specific data for Gallery View (Only Wastage with Images)
  const wastageGalleryItems = useMemo(() => {
    let items = groupedTransactions.filter(t => t.type === TransactionType.WASTE && t.hasImages);
    
    if (galleryBranchFilter !== 'ALL') {
      items = items.filter(t => t.branchId === galleryBranchFilter);
    }
    
    return items;
  }, [groupedTransactions, galleryBranchFilter]);

  const getTypeIcon = (type: TransactionType) => {
    switch(type) {
      case TransactionType.CHECK_OUT: return <ShoppingBag size={12}/>;
      case TransactionType.CHECK_IN: return <ArrowRightLeft size={12}/>;
      case TransactionType.WASTE: return <Trash2 size={12}/>;
      case TransactionType.RESTOCK: return <Snowflake size={12}/>;
      case TransactionType.ADJUSTMENT: return <ClipboardCheck size={12}/>;
    }
  };

  const getTypeStyles = (type: TransactionType) => {
    switch(type) {
      case TransactionType.CHECK_OUT: return 'bg-emerald-100 text-emerald-800';
      case TransactionType.CHECK_IN: return 'bg-blue-100 text-blue-800';
      case TransactionType.WASTE: return 'bg-red-100 text-red-800';
      case TransactionType.RESTOCK: return 'bg-violet-100 text-violet-800';
      case TransactionType.ADJUSTMENT: return 'bg-amber-100 text-amber-800';
    }
  };

  const getTypeName = (type: TransactionType) => {
    switch(type) {
      case TransactionType.CHECK_OUT: return 'Check Out';
      case TransactionType.CHECK_IN: return 'Return';
      case TransactionType.WASTE: return 'Wastage';
      case TransactionType.RESTOCK: return 'Stock In';
      case TransactionType.ADJUSTMENT: return 'Stock Adj.';
    }
  };

  const handleDelete = async (batchId?: string) => {
    if (!batchId) return;
    if (window.confirm("Are you sure you want to delete this record? It will be moved to the Deleted Archive.")) {
        await deleteTransactionBatch(batchId, currentUser?.name || 'Unknown');
    }
  };

  return (
    <div className="pb-10 relative">
      <div className="mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Transaction Logs</h2>
          <p className="text-slate-500">History of all stock movements and reports.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Admin Scope Toggle */}
          {isAdmin && (
             <div className="flex bg-slate-800 p-1 rounded-lg">
                <button
                  onClick={() => setDataScope('ACTIVE')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                     dataScope === 'ACTIVE' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Live Records
                </button>
                <button
                  onClick={() => { setDataScope('DELETED'); setViewMode('LIST'); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                     dataScope === 'DELETED' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-red-400'
                  }`}
                >
                  <Archive size={12} /> Deleted
                </button>
             </div>
          )}

          {dataScope === 'ACTIVE' && isAdmin && <div className="h-6 w-px bg-slate-300 mx-1 hidden sm:block"></div>}

          {/* View Toggle - Only for active records */}
          {dataScope === 'ACTIVE' && (
             <div className="flex bg-slate-200 p-1 rounded-lg">
                <button
                  onClick={() => { setViewMode('LIST'); setFilterType('ALL'); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'LIST' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <List size={16} /> List
                </button>
                <button
                  onClick={() => { setViewMode('GALLERY'); setFilterType(TransactionType.WASTE); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'GALLERY' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <LayoutGrid size={16} /> Wastage Gallery
                </button>
             </div>
          )}

          <div className="h-6 w-px bg-slate-300 mx-1 hidden sm:block"></div>

          {/* Filter Dropdown */}
          {viewMode === 'LIST' ? (
            <div className="relative">
              <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                <Filter size={16} className="text-slate-400 mr-2" />
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as TransactionType | 'ALL')}
                  className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer pr-4"
                >
                  <option value="ALL">All Types</option>
                  <option value={TransactionType.CHECK_OUT}>Check Outs</option>
                  <option value={TransactionType.CHECK_IN}>Returns</option>
                  <option value={TransactionType.WASTE}>Wastage</option>
                  <option value={TransactionType.RESTOCK}>Stock In</option>
                  <option value={TransactionType.ADJUSTMENT}>Stock Adjustments</option>
                </select>
              </div>
            </div>
          ) : (
             <div className="relative">
              <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                <Store size={16} className="text-slate-400 mr-2" />
                <select 
                  value={galleryBranchFilter}
                  onChange={(e) => setGalleryBranchFilter(e.target.value)}
                  className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer pr-4"
                >
                  <option value="ALL">All Branches</option>
                  <option value="FRIDGE">Main Fridge</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {transactions.length > 0 && dataScope === 'ACTIVE' && isAdmin && (
            <button 
              onClick={() => { if(window.confirm('Clear all data?')) resetData() }}
              className="text-red-600 hover:text-red-700 text-sm font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              Reset All
            </button>
          )}
        </div>
      </div>

      {dataScope === 'DELETED' && (
         <div className="mb-4 bg-red-50 border border-red-100 p-3 rounded-lg flex items-center gap-2 text-sm text-red-800">
            <ShieldAlert size={16} />
            <span className="font-bold">Audit Mode:</span> Viewing deleted transactions. These records are permanent proofs and cannot be removed.
         </div>
      )}

      {/* --- LIST VIEW --- */}
      {viewMode === 'LIST' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
          {groupedTransactions.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400">
              <Filter size={48} className="mb-4 text-slate-200" />
              <p>No transactions found matching your criteria.</p>
              {filterType !== 'ALL' && (
                <button 
                  onClick={() => setFilterType('ALL')}
                  className="mt-2 text-emerald-600 font-medium hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="p-4 w-32">Date</th>
                    <th className="p-4 w-24">User</th>
                    <th className="p-4 w-32">Type</th>
                    {dataScope === 'DELETED' && <th className="p-4 w-32 text-red-600">Deleted By</th>}
                    <th className="p-4 w-40">Source/Dest</th>
                    <th className="p-4">Items Summary</th>
                    <th className="p-4 text-right w-24">Total</th>
                    {(dataScope === 'ACTIVE' && isAdmin) && <th className="p-4 text-center w-16">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupedTransactions.map((group) => {
                    const isAdjustment = group.type === TransactionType.ADJUSTMENT;
                    return (
                      <tr key={group.id} className={`transition-colors ${dataScope === 'DELETED' ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-slate-50'}`}>
                        <td className="p-4 text-slate-600 whitespace-nowrap align-top">
                          <div className="font-medium text-slate-800">{group.date}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            {new Date(group.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="p-4 align-top">
                          {group.userName ? (
                            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                              <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-600">
                                <UserIcon size={10} />
                              </div>
                              {group.userName}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">--</span>
                          )}
                        </td>
                        <td className="p-4 align-top">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getTypeStyles(group.type)}`}>
                            {getTypeIcon(group.type)}
                            {getTypeName(group.type)}
                          </span>
                          {group.hasImages && (
                            <button 
                              onClick={() => setSelectedImage(group.imageUrls[0])}
                              className="mt-1.5 flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                            >
                              <ImageIcon size={12} /> View Evidence
                            </button>
                          )}
                        </td>
                        
                        {/* Deleted Info Column */}
                        {dataScope === 'DELETED' && (
                           <td className="p-4 align-top">
                              <div className="text-xs">
                                 <div className="font-bold text-red-700">{group.deletedBy || 'Unknown'}</div>
                                 <div className="text-slate-400">
                                    {group.deletedAt ? new Date(group.deletedAt).toLocaleDateString() : '-'}
                                 </div>
                              </div>
                           </td>
                        )}

                        <td className="p-4 text-slate-700 font-medium align-top">
                          {getBranchName(group.branchId)}
                        </td>
                        <td className="p-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            {group.items.map((item, idx) => (
                              <span key={idx} className={`inline-flex items-center gap-1 border px-2 py-1 rounded text-xs ${isAdjustment ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                                <span className="font-semibold">{item.qty > 0 && isAdjustment ? '+' : ''}{item.qty}</span>
                                <span className="truncate max-w-[150px]">{item.skuName}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-slate-700 align-top text-base">
                          {group.totalQty > 0 && isAdjustment ? '+' : ''}{group.totalQty}
                        </td>
                        
                        {(dataScope === 'ACTIVE' && isAdmin) && (
                           <td className="p-4 text-center align-top">
                              {group.batchId && (
                                <button 
                                  onClick={() => handleDelete(group.batchId)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete Record"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                           </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- GALLERY VIEW --- */}
      {viewMode === 'GALLERY' && dataScope === 'ACTIVE' && (
        <div className="animate-fade-in">
           {wastageGalleryItems.length === 0 ? (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center flex flex-col items-center justify-center text-slate-400">
               <ImageIcon size={48} className="mb-4 text-slate-200" />
               <h3 className="text-lg font-bold text-slate-600">No Photos Found</h3>
               <p>
                 {galleryBranchFilter !== 'ALL' 
                   ? `No wastage photos for ${getBranchName(galleryBranchFilter)}.` 
                   : "There are no wastage reports with attached photos."}
               </p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {wastageGalleryItems.map(group => (
                 <div key={group.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                   {/* Header */}
                   <div className="p-4 border-b border-slate-100 bg-red-50/50 flex justify-between items-start">
                      <div className="flex items-center gap-3">
                         <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                           <Trash2 size={20} />
                         </div>
                         <div>
                           <div className="font-bold text-slate-800">{getBranchName(group.branchId)}</div>
                           <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="flex items-center gap-1"><Calendar size={10} /> {group.date}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1"><UserIcon size={10} /> {group.userName || 'Unknown'}</span>
                           </div>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded-full">
                            -{group.totalQty} Pcs
                        </span>
                        {(group.batchId && isAdmin) && (
                           <button 
                             onClick={() => handleDelete(group.batchId)}
                             className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
                             title="Delete"
                           >
                             <Trash2 size={14} />
                           </button>
                        )}
                      </div>
                   </div>
                   
                   {/* Items List */}
                   <div className="p-4 bg-slate-50/50 border-b border-slate-100 text-sm">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Items Reported</p>
                      <ul className="space-y-1">
                        {group.items.map((item, i) => (
                           <li key={i} className="flex justify-between text-slate-700">
                              <span>{item.skuName}</span>
                              <span className="font-mono font-medium">{item.qty}</span>
                           </li>
                        ))}
                      </ul>
                   </div>

                   {/* Image Grid */}
                   <div className="p-4 flex-1">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Evidence</p>
                      <div className="grid grid-cols-2 gap-2">
                         {group.imageUrls.map((url, idx) => (
                           <button 
                             key={idx}
                             onClick={() => setSelectedImage(url)}
                             className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group"
                           >
                             <img src={url} alt="Evidence" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                             <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all" size={24} />
                             </div>
                           </button>
                         ))}
                      </div>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      )}

      {/* --- IMAGE MODAL --- */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setSelectedImage(null)}
        >
           <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-12 right-0 text-white hover:text-red-400 transition-colors p-2"
              >
                <X size={32} />
              </button>
              <img 
                src={selectedImage} 
                alt="Full Evidence" 
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
              />
           </div>
        </div>
      )}
    </div>
  );
};

export default Logs;
