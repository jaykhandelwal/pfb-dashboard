
import React, { useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { TransactionType } from '../types';
import { ShoppingBag, ArrowRightLeft, Trash2, Image as ImageIcon, Snowflake, Filter, X, ClipboardCheck, User as UserIcon, LayoutGrid, List, ZoomIn, Calendar, Store, ShieldAlert, Archive, Clock, ChevronDown, ChevronRight, AlertTriangle, ArrowUpDown } from 'lucide-react';

interface GroupedTransaction {
  id: string;
  batchId?: string;
  date: string;
  timestamp: number;
  branchId: string;
  type: TransactionType;
  items: { skuName: string; qty: number }[];
  totalQty: number;
  hasImages: boolean;
  imageUrls: string[];
  userName?: string;
  deletedAt?: string;
  deletedBy?: string;
}

const Logs: React.FC = () => {
  const { transactions, deletedTransactions, skus, branches, deleteTransactionBatch } = useStore();
  const { currentUser } = useAuth();

  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'LIST' | 'GALLERY'>('LIST');
  const [galleryBranchFilter, setGalleryBranchFilter] = useState<string>('ALL');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [dataScope, setDataScope] = useState<'ACTIVE' | 'DELETED'>('ACTIVE');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<'FOR_DATE' | 'LOGGED_ON'>('FOR_DATE');

  // Check if current user is Admin
  const isAdmin = currentUser?.role === 'ADMIN';

  const getSkuName = (id: string) => skus.find(s => s.id === id)?.name || id;
  const getBranchName = (id: string) => {
    if (id === 'FRIDGE') return 'Deep Freezer';
    return branches.find(b => b.id === id)?.name || id;
  };

  // Determine source based on scope
  const sourceTransactions = dataScope === 'ACTIVE' ? transactions : deletedTransactions;

  // Group transactions by batchId
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, GroupedTransaction> = {};

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

    // Convert to array and sort based on current sort mode
    // For deleted transactions, always use LOGGED_ON sorting
    const effectiveSortMode = dataScope === 'DELETED' ? 'LOGGED_ON' : sortMode;

    return Object.values(groups).sort((a, b) => {
      if (effectiveSortMode === 'LOGGED_ON') {
        // Sort by timestamp (logged on date) descending
        return b.timestamp - a.timestamp;
      } else {
        // Sort by Operational Date (for date) descending, then by timestamp
        const dateComparison = b.date.localeCompare(a.date);
        if (dateComparison !== 0) return dateComparison;
        return b.timestamp - a.timestamp;
      }
    });
  }, [sourceTransactions, skus, branches, filterType, sortMode, dataScope]);

  // Create a lookup map for checkout/return status by date+branch
  // Used to determine if a checkout is missing its return
  const transactionStatusMap = useMemo(() => {
    const statusMap: Record<string, 'complete' | 'missing_return' | 'only_return'> = {};

    // Build a map of date+branch -> { hasCheckOut, hasReturn }
    const presenceMap: Record<string, { hasCheckOut: boolean; hasReturn: boolean }> = {};

    groupedTransactions.forEach(t => {
      if (t.type !== TransactionType.CHECK_OUT && t.type !== TransactionType.CHECK_IN) return;

      const key = `${t.date}-${t.branchId}`;
      if (!presenceMap[key]) {
        presenceMap[key] = { hasCheckOut: false, hasReturn: false };
      }

      if (t.type === TransactionType.CHECK_OUT) {
        presenceMap[key].hasCheckOut = true;
      } else if (t.type === TransactionType.CHECK_IN) {
        presenceMap[key].hasReturn = true;
      }
    });

    // Convert presence to status
    Object.entries(presenceMap).forEach(([key, presence]) => {
      if (presence.hasCheckOut && presence.hasReturn) {
        statusMap[key] = 'complete';
      } else if (presence.hasCheckOut && !presence.hasReturn) {
        statusMap[key] = 'missing_return';
      } else {
        statusMap[key] = 'only_return';
      }
    });

    return statusMap;
  }, [groupedTransactions]);

  // Helper to get status for a transaction (for checkout/return highlighting)
  const getTransactionStatus = (t: GroupedTransaction): 'complete' | 'missing_return' | 'only_return' | null => {
    if (t.type !== TransactionType.CHECK_OUT && t.type !== TransactionType.CHECK_IN) return null;
    const key = `${t.date}-${t.branchId}`;
    return transactionStatusMap[key] || null;
  };

  // Specific data for Gallery View (Only Wastage with Images)
  const wastageGalleryItems = useMemo(() => {
    let items = groupedTransactions.filter(t => t.type === TransactionType.WASTE && t.hasImages);

    if (galleryBranchFilter !== 'ALL') {
      items = items.filter(t => t.branchId === galleryBranchFilter);
    }

    return items;
  }, [groupedTransactions, galleryBranchFilter]);

  const getTypeIcon = (type: TransactionType) => {
    switch (type) {
      case TransactionType.CHECK_OUT: return <ShoppingBag size={12} />;
      case TransactionType.CHECK_IN: return <ArrowRightLeft size={12} />;
      case TransactionType.WASTE: return <Trash2 size={12} />;
      case TransactionType.RESTOCK: return <Snowflake size={12} />;
      case TransactionType.ADJUSTMENT: return <ClipboardCheck size={12} />;
    }
  };

  const getTypeStyles = (type: TransactionType) => {
    switch (type) {
      case TransactionType.CHECK_OUT: return 'bg-emerald-100 text-emerald-800';
      case TransactionType.CHECK_IN: return 'bg-blue-100 text-blue-800';
      case TransactionType.WASTE: return 'bg-red-100 text-red-800';
      case TransactionType.RESTOCK: return 'bg-violet-100 text-violet-800';
      case TransactionType.ADJUSTMENT: return 'bg-amber-100 text-amber-800';
    }
  };

  const getTypeName = (type: TransactionType) => {
    switch (type) {
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

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allIds = groupedTransactions.map(t => t.id);
    setExpandedRows(new Set(allIds));
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  // Render a single transaction row (used both in grouped and ungrouped views)
  const renderTransactionRow = (group: GroupedTransaction, groupStatus?: 'complete' | 'missing_return' | 'only_return') => {
    const isExpanded = expandedRows.has(group.id);
    const isAdjustment = group.type === TransactionType.ADJUSTMENT;

    // Status-based styling
    let rowBgClass = dataScope === 'DELETED' ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-slate-50';
    if (groupStatus === 'missing_return' && group.type === TransactionType.CHECK_OUT) {
      rowBgClass = 'bg-red-50/50 hover:bg-red-100/50';
    } else if (groupStatus === 'complete') {
      rowBgClass = dataScope === 'DELETED' ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-slate-50';
    }

    return (
      <tr
        key={group.id}
        className={`transition-colors border-b border-slate-100 ${rowBgClass}`}
      >
        {/* Logged On (Compact) */}
        <td className="px-3 py-2 align-middle whitespace-nowrap">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-700">
              {new Date(group.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-[10px] text-slate-400">
              {new Date(group.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </td>

        {/* User */}
        <td className="px-3 py-2 align-middle">
          {group.userName ? (
            <div className="flex items-center gap-1.5 text-slate-700 font-medium text-sm">
              <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-600">
                <UserIcon size={10} />
              </div>
              <span className="truncate max-w-[100px]">{group.userName}</span>
            </div>
          ) : (
            <span className="text-slate-400 text-xs italic">--</span>
          )}
        </td>

        {/* Type */}
        <td className="px-3 py-2 align-middle">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${getTypeStyles(group.type)}`}>
              {getTypeIcon(group.type)}
              {getTypeName(group.type)}
            </span>
            {group.hasImages && (
              <button
                onClick={() => setSelectedImage(group.imageUrls[0])}
                className="text-slate-400 hover:text-blue-600 transition-colors"
                title="View Evidence"
              >
                <ImageIcon size={14} />
              </button>
            )}
          </div>
        </td>

        {/* Deleted Info Column */}
        {dataScope === 'DELETED' && (
          <td className="px-3 py-2 align-middle">
            <div className="text-xs">
              <div className="font-bold text-red-700">{group.deletedBy || 'Unknown'}</div>
              <div className="text-slate-400">
                {group.deletedAt ? new Date(group.deletedAt).toLocaleDateString() : '-'}
              </div>
            </div>
          </td>
        )}

        {/* Branch */}
        <td className="px-3 py-2 text-slate-700 font-medium align-middle text-sm text-center">
          {getBranchName(group.branchId)}
        </td>

        {/* Items Summary - Condensed or Expanded */}
        <td className="px-3 py-2 align-middle">
          {isExpanded ? (
            <div className="flex flex-wrap gap-1.5 animate-fade-in">
              {group.items.map((item, idx) => (
                <span key={idx} className={`inline-flex items-center gap-1 border px-2 py-0.5 rounded text-xs ${isAdjustment ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                  <span className="font-semibold text-xs">{item.qty > 0 && isAdjustment ? '+' : ''}{item.qty}</span>
                  <span className="text-[11px] truncate max-w-[150px]">{item.skuName}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-slate-500">
              {group.items.length} item{group.items.length !== 1 ? 's' : ''}
              <span className="text-slate-300 mx-2">|</span>
              <span className="text-xs text-slate-400 italic">
                {group.items.slice(0, 2).map(i => i.skuName).join(', ')}
                {group.items.length > 2 && '...'}
              </span>
            </span>
          )}
        </td>

        {/* Total */}
        <td className="px-3 py-2 text-right font-mono font-bold text-slate-700 align-middle">
          {group.totalQty > 0 && isAdjustment ? '+' : ''}{group.totalQty}
        </td>

        {/* Actions (Expand + Delete) */}
        <td className="px-3 py-2 text-right align-middle whitespace-nowrap">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => toggleExpand(group.id)}
              className={`p-1.5 rounded transition-colors ${isExpanded ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
              title={isExpanded ? "Collapse" : "Expand Details"}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {(dataScope === 'ACTIVE' && isAdmin && group.batchId) && (
              <button
                onClick={() => handleDelete(group.batchId)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete Record"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
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
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${dataScope === 'ACTIVE' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Live Records
              </button>
              <button
                onClick={() => { setDataScope('DELETED'); setViewMode('LIST'); }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${dataScope === 'DELETED' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-red-400'
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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'LIST' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <List size={16} /> List
              </button>
              <button
                onClick={() => { setViewMode('GALLERY'); setFilterType(TransactionType.WASTE); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'GALLERY' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
                  <option value="FRIDGE">Deep Freezer</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Sort Mode Toggle - Only for active, list view */}
          {viewMode === 'LIST' && dataScope === 'ACTIVE' && (
            <>
              <div className="h-6 w-px bg-slate-300 mx-1 hidden sm:block"></div>
              <div className="flex bg-slate-200 p-1 rounded-lg">
                <button
                  onClick={() => setSortMode('FOR_DATE')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${sortMode === 'FOR_DATE' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  <Calendar size={14} /> For Date
                </button>
                <button
                  onClick={() => setSortMode('LOGGED_ON')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${sortMode === 'LOGGED_ON' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  <Clock size={14} /> Logged On
                </button>
              </div>
            </>
          )}

          {/* Expand/Collapse All */}
          {viewMode === 'LIST' && groupedTransactions.length > 0 && (
            <div className="flex gap-1">
              <button
                onClick={expandAll}
                className="px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
              >
                Collapse All
              </button>
            </div>
          )}
        </div>
      </div>

      {dataScope === 'DELETED' && (
        <div className="mb-4 bg-red-50 border border-red-100 p-3 rounded-lg flex items-center gap-2 text-sm text-red-800">
          <ShieldAlert size={16} />
          <span className="font-bold">Audit Mode:</span> Viewing deleted transactions. These records are permanent proofs and cannot be removed.
        </div>
      )}

      {/* Legend for grouped view - Only show when using FOR_DATE mode and active */}
      {sortMode === 'FOR_DATE' && dataScope === 'ACTIVE' && viewMode === 'LIST' && (
        <div className="mb-4 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border-2 border-red-400"></div>
            <span className="text-slate-600">Return Missing (Checkout without Return)</span>
          </div>
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
            // Unified flat table view - all transactions sorted together
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-3 py-2 w-32">
                      <div className="flex items-center gap-1"><Clock size={12} /> Time</div>
                    </th>
                    <th className="px-3 py-2 w-24">User</th>
                    <th className="px-3 py-2 w-32">Type</th>
                    {dataScope === 'DELETED' && <th className="px-3 py-2 w-32 text-red-600">Deleted By</th>}
                    <th className="px-3 py-2 w-36 text-center">Branch</th>
                    <th className="px-3 py-2">Items</th>
                    <th className="px-3 py-2 text-right w-20">Total</th>
                    <th className="px-3 py-2 text-right w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedTransactions.map((group, index) => {
                    // Get status for checkout/return transactions (for highlighting)
                    const status = getTransactionStatus(group);

                    // Header Logic: Check if date changed from previous row
                    const showDateHeader = index === 0 || groupedTransactions[index - 1].date !== group.date;

                    // If Sorting by LOGGED_ON, we might not want strict date grouping headers if the list isn't strictly ordered by operational date
                    // However, we'll enable it for clarity, assuming mostly chronological order
                    const shouldRenderHeader = sortMode === 'FOR_DATE' && showDateHeader;

                    return (
                      <React.Fragment key={group.id}>
                        {shouldRenderHeader && (
                          <tr className="bg-slate-100 border-b border-slate-200">
                            <td colSpan={dataScope === 'DELETED' ? 8 : 7} className="px-3 py-1.5 font-bold text-slate-700 text-xs">
                              <div className="flex items-center gap-2">
                                <Calendar size={12} className="text-slate-500" />
                                {new Date(group.date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
                              </div>
                            </td>
                          </tr>
                        )}
                        {renderTransactionRow(group, status)}
                      </React.Fragment>
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
