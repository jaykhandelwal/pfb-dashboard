
import React, { useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { TransactionType } from '../types';
import { ShoppingBag, ArrowRightLeft, Trash2, Image as ImageIcon, Snowflake, Filter, X, ClipboardCheck, User as UserIcon, LayoutGrid, List, ZoomIn, Calendar, Store, ShieldAlert, Archive, Clock, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

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

interface DateBranchGroup {
  key: string;
  date: string;
  branchId: string;
  branchName: string;
  hasCheckOut: boolean;
  hasReturn: boolean;
  checkOuts: GroupedTransaction[];
  returns: GroupedTransaction[];
  status: 'complete' | 'missing_return' | 'only_return';
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

    // Convert to array and sort
    return Object.values(groups).sort((a, b) => {
      // 1. Sort by Operational Date (Descending: Newest dates first)
      const dateComparison = b.date.localeCompare(a.date);
      if (dateComparison !== 0) return dateComparison;

      // 2. Sort by Creation Time (Descending: Newest entry within that day first)
      return b.timestamp - a.timestamp;
    });
  }, [sourceTransactions, skus, branches, filterType]);

  // Group by Date + Branch for checkout/return matching
  const dateBranchGroups = useMemo(() => {
    const showGrouping = filterType === 'ALL' || filterType === TransactionType.CHECK_OUT || filterType === TransactionType.CHECK_IN;
    if (!showGrouping) return null;

    const groups: Record<string, DateBranchGroup> = {};

    groupedTransactions.forEach(t => {
      // Only group CHECK_OUT and CHECK_IN
      if (t.type !== TransactionType.CHECK_OUT && t.type !== TransactionType.CHECK_IN) return;

      const key = `${t.date}-${t.branchId}`;

      if (!groups[key]) {
        groups[key] = {
          key,
          date: t.date,
          branchId: t.branchId,
          branchName: getBranchName(t.branchId),
          hasCheckOut: false,
          hasReturn: false,
          checkOuts: [],
          returns: [],
          status: 'missing_return'
        };
      }

      if (t.type === TransactionType.CHECK_OUT) {
        groups[key].hasCheckOut = true;
        groups[key].checkOuts.push(t);
      } else if (t.type === TransactionType.CHECK_IN) {
        groups[key].hasReturn = true;
        groups[key].returns.push(t);
      }
    });

    // Update status for each group
    Object.values(groups).forEach(g => {
      if (g.hasCheckOut && g.hasReturn) {
        g.status = 'complete';
      } else if (g.hasCheckOut && !g.hasReturn) {
        g.status = 'missing_return';
      } else {
        g.status = 'only_return';
      }
    });

    // Sort by date descending
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [groupedTransactions, filterType]);

  // Get transactions that are not checkout/return (for mixed view)
  const otherTransactions = useMemo(() => {
    if (filterType !== 'ALL') return [];

    // Group non-checkout/return transactions separately
    const groups: Record<string, GroupedTransaction> = {};

    sourceTransactions.forEach(t => {
      // Only include non-checkout/return types
      if (t.type === TransactionType.CHECK_OUT || t.type === TransactionType.CHECK_IN) return;

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

      if (t.imageUrls && t.imageUrls.length > 0) {
        groups[key].hasImages = true;
        t.imageUrls.forEach(url => {
          if (!groups[key].imageUrls.includes(url)) {
            groups[key].imageUrls.push(url);
          }
        });
      } else if ((t as any).imageUrl) {
        groups[key].hasImages = true;
        groups[key].imageUrls.push((t as any).imageUrl);
      }
    });

    return Object.values(groups).sort((a, b) => {
      const dateComparison = b.date.localeCompare(a.date);
      if (dateComparison !== 0) return dateComparison;
      return b.timestamp - a.timestamp;
    });
  }, [sourceTransactions, skus, filterType]);

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
        {/* Expand Toggle + Date Column */}
        <td className="p-3 whitespace-nowrap align-top">
          <div className="flex items-start gap-2">
            <button
              onClick={() => toggleExpand(group.id)}
              className="p-1 hover:bg-slate-200 rounded transition-colors mt-1"
            >
              {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-400" />}
            </button>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">For Date</span>
              <span className="font-bold text-slate-800 text-sm">
                {new Date(group.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>

              <div className="flex flex-col mt-2 pt-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1">
                  <Clock size={8} /> Logged On
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(group.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  <span className="text-slate-300 mx-1">|</span>
                  {new Date(group.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        </td>

        {/* User */}
        <td className="p-3 align-middle">
          {group.userName ? (
            <div className="flex items-center gap-1.5 text-slate-700 font-medium text-sm">
              <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-600">
                <UserIcon size={10} />
              </div>
              {group.userName}
            </div>
          ) : (
            <span className="text-slate-400 text-xs italic">--</span>
          )}
        </td>

        {/* Type */}
        <td className="p-3 align-middle">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getTypeStyles(group.type)}`}>
            {getTypeIcon(group.type)}
            {getTypeName(group.type)}
          </span>
          {group.hasImages && (
            <button
              onClick={() => setSelectedImage(group.imageUrls[0])}
              className="ml-2 inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
            >
              <ImageIcon size={12} /> View
            </button>
          )}
        </td>

        {/* Deleted Info Column */}
        {dataScope === 'DELETED' && (
          <td className="p-3 align-middle">
            <div className="text-xs">
              <div className="font-bold text-red-700">{group.deletedBy || 'Unknown'}</div>
              <div className="text-slate-400">
                {group.deletedAt ? new Date(group.deletedAt).toLocaleDateString() : '-'}
              </div>
            </div>
          </td>
        )}

        {/* Branch */}
        <td className="p-3 text-slate-700 font-medium align-middle text-sm">
          {getBranchName(group.branchId)}
        </td>

        {/* Items Summary - Condensed or Expanded */}
        <td className="p-3 align-middle">
          {isExpanded ? (
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((item, idx) => (
                <span key={idx} className={`inline-flex items-center gap-1 border px-2 py-0.5 rounded text-xs ${isAdjustment ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                  <span className="font-semibold">{item.qty > 0 && isAdjustment ? '+' : ''}{item.qty}</span>
                  <span className="truncate max-w-[120px]">{item.skuName}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-slate-500">
              {group.items.length} item{group.items.length !== 1 ? 's' : ''}
            </span>
          )}
        </td>

        {/* Total */}
        <td className="p-3 text-right font-mono font-bold text-slate-700 align-middle">
          {group.totalQty > 0 && isAdjustment ? '+' : ''}{group.totalQty}
        </td>

        {/* Actions */}
        {(dataScope === 'ACTIVE' && isAdmin) && (
          <td className="p-3 text-center align-middle">
            {group.batchId && (
              <button
                onClick={() => handleDelete(group.batchId)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete Record"
              >
                <Trash2 size={14} />
              </button>
            )}
          </td>
        )}
      </tr>
    );
  };

  // Check if we should show the grouped view
  const showGroupedView = dateBranchGroups && dateBranchGroups.length > 0 && (filterType === 'ALL' || filterType === TransactionType.CHECK_OUT || filterType === TransactionType.CHECK_IN);

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

      {/* Legend for grouped view */}
      {filterType === 'ALL' && dataScope === 'ACTIVE' && (
        <div className="mb-4 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-100 border-2 border-emerald-500"></div>
            <span className="text-slate-600">Checkout + Return Complete</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border-2 border-red-400"></div>
            <span className="text-slate-600">Return Missing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-100 border-2 border-amber-400"></div>
            <span className="text-slate-600">Return Only (No Checkout)</span>
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
          ) : filterType === 'ALL' ? (
            // Mixed view: Show grouped checkout/returns at top, then other transactions
            <div className="divide-y divide-slate-200">
              {/* Grouped Checkout/Return Section */}
              {dateBranchGroups && dateBranchGroups.length > 0 && (
                <>
                  {dateBranchGroups.map(group => {
                    const isComplete = group.status === 'complete';
                    const isMissingReturn = group.status === 'missing_return';

                    return (
                      <div key={group.key} className={`${isMissingReturn ? 'bg-red-50/30' : isComplete ? 'bg-emerald-50/20' : 'bg-amber-50/30'}`}>
                        {/* Group Header */}
                        <div className={`px-4 py-3 border-l-4 ${isMissingReturn ? 'border-l-red-400 bg-red-50' : isComplete ? 'border-l-emerald-500 bg-emerald-50/50' : 'border-l-amber-400 bg-amber-50'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-slate-400" />
                                <span className="font-bold text-slate-800">
                                  {new Date(group.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                              <span className="text-slate-300">•</span>
                              <div className="flex items-center gap-2">
                                <Store size={14} className="text-slate-400" />
                                <span className="font-semibold text-slate-700">{group.branchName}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isComplete ? (
                                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                                  <CheckCircle2 size={12} />
                                  Complete
                                </span>
                              ) : isMissingReturn ? (
                                <span className="flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded-full">
                                  <AlertTriangle size={12} />
                                  Return Missing
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                  <AlertTriangle size={12} />
                                  Return Only
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Transactions Table for this group */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 text-xs uppercase font-semibold">
                              <tr>
                                <th className="p-3 w-40">Date & Time</th>
                                <th className="p-3 w-24">User</th>
                                <th className="p-3 w-32">Type</th>
                                {dataScope === 'DELETED' && <th className="p-3 w-32 text-red-600">Deleted By</th>}
                                <th className="p-3 w-36">Branch</th>
                                <th className="p-3">Items</th>
                                <th className="p-3 text-right w-20">Total</th>
                                {(dataScope === 'ACTIVE' && isAdmin) && <th className="p-3 text-center w-14"></th>}
                              </tr>
                            </thead>
                            <tbody>
                              {group.checkOuts.map(t => renderTransactionRow(t, group.status))}
                              {group.returns.map(t => renderTransactionRow(t, group.status))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Other transactions (Wastage, Restock, etc.) */}
              {otherTransactions.length > 0 && (
                <div>
                  <div className="px-4 py-3 bg-slate-100 border-l-4 border-l-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700">Other Transactions</span>
                      <span className="text-xs text-slate-500">(Wastage, Stock In, Adjustments)</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 text-xs uppercase font-semibold">
                        <tr>
                          <th className="p-3 w-40">Date & Time</th>
                          <th className="p-3 w-24">User</th>
                          <th className="p-3 w-32">Type</th>
                          {dataScope === 'DELETED' && <th className="p-3 w-32 text-red-600">Deleted By</th>}
                          <th className="p-3 w-36">Branch</th>
                          <th className="p-3">Items</th>
                          <th className="p-3 text-right w-20">Total</th>
                          {(dataScope === 'ACTIVE' && isAdmin) && <th className="p-3 text-center w-14"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {otherTransactions.map(t => renderTransactionRow(t))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Empty state if nothing at all */}
              {(!dateBranchGroups || dateBranchGroups.length === 0) && otherTransactions.length === 0 && (
                <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400">
                  <Filter size={48} className="mb-4 text-slate-200" />
                  <p>No transactions found.</p>
                </div>
              )}
            </div>
          ) : showGroupedView ? (
            // Grouped View for CHECK_OUT or CHECK_IN filter only
            <div className="divide-y divide-slate-200">
              {dateBranchGroups?.map(group => {
                const isComplete = group.status === 'complete';
                const isMissingReturn = group.status === 'missing_return';

                return (
                  <div key={group.key} className={`${isMissingReturn ? 'bg-red-50/30' : isComplete ? 'bg-emerald-50/20' : 'bg-amber-50/30'}`}>
                    {/* Group Header */}
                    <div className={`px-4 py-3 border-l-4 ${isMissingReturn ? 'border-l-red-400 bg-red-50' : isComplete ? 'border-l-emerald-500 bg-emerald-50/50' : 'border-l-amber-400 bg-amber-50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-slate-400" />
                            <span className="font-bold text-slate-800">
                              {new Date(group.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <span className="text-slate-300">•</span>
                          <div className="flex items-center gap-2">
                            <Store size={14} className="text-slate-400" />
                            <span className="font-semibold text-slate-700">{group.branchName}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isComplete ? (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                              <CheckCircle2 size={12} />
                              Complete
                            </span>
                          ) : isMissingReturn ? (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded-full">
                              <AlertTriangle size={12} />
                              Return Missing
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                              <AlertTriangle size={12} />
                              Return Only
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Transactions Table for this group */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 text-xs uppercase font-semibold">
                          <tr>
                            <th className="p-3 w-40">Date & Time</th>
                            <th className="p-3 w-24">User</th>
                            <th className="p-3 w-32">Type</th>
                            {dataScope === 'DELETED' && <th className="p-3 w-32 text-red-600">Deleted By</th>}
                            <th className="p-3 w-36">Branch</th>
                            <th className="p-3">Items</th>
                            <th className="p-3 text-right w-20">Total</th>
                            {(dataScope === 'ACTIVE' && isAdmin) && <th className="p-3 text-center w-14"></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {group.checkOuts.map(t => renderTransactionRow(t, group.status))}
                          {group.returns.map(t => renderTransactionRow(t, group.status))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Standard flat list view (for filtered types like Wastage, Restock, etc.)
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="p-3 w-40">Date & Time</th>
                    <th className="p-3 w-24">User</th>
                    <th className="p-3 w-32">Type</th>
                    {dataScope === 'DELETED' && <th className="p-3 w-32 text-red-600">Deleted By</th>}
                    <th className="p-3 w-36">Source/Dest</th>
                    <th className="p-3">Items Summary</th>
                    <th className="p-3 text-right w-20">Total</th>
                    {(dataScope === 'ACTIVE' && isAdmin) && <th className="p-3 text-center w-14"></th>}
                  </tr>
                </thead>
                <tbody>
                  {groupedTransactions.map(group => renderTransactionRow(group))}
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
