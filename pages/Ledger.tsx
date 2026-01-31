import React, { useState, useMemo } from 'react';
import {
    Plus, Trash2, Edit2, X, TrendingUp, TrendingDown, RotateCcw, Filter, Calendar,
    CheckCircle2, XCircle, Clock, History, FileText, UploadCloud, Image as ImageIcon,
    ChevronLeft, ChevronRight, ChevronDown, Users, Download, AlertCircle, FileUp, Copy, Check, Paperclip
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { LedgerEntry, LedgerEntryType, LedgerCategory, LedgerCategoryDefinition, LedgerPaymentMethod, BulkLedgerImportEntry, BulkImportResult } from '../types';
import { uploadImageToBunny } from '../services/bunnyStorage';
import { compressImage } from '../services/imageUtils';
import { IconRenderer } from '../services/iconLibrary';

import LedgerEntryModal from '../components/LedgerEntryModal';

const getLocalISOString = (date: Date = new Date()): string => {
    const offset = date.getTimezoneOffset() * 60000;
    const localTime = new Date(date.getTime() - offset);
    return localTime.toISOString().slice(0, 10);
};

// IconRenderer is now imported from ../services/iconLibrary

const formatLedgerDateTime = (timestamp: number) => {
    const d = new Date(timestamp);

    // Date format: 31 Jan '26
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear().toString().slice(-2);
    const dateStr = `${day} ${month} '${year}`;

    // Time format: 6:34PM
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const timeStr = `${hours}:${minutes}${ampm}`;

    return { date: dateStr, time: timeStr };
};

const Ledger: React.FC = () => {
    const { branches, ledgerEntries, addLedgerEntry, updateLedgerEntry, deleteLedgerEntry, updateLedgerEntryStatus, ledgerLogs, fetchLedgerLogs, appSettings, addBulkLedgerEntries } = useStore();
    const { currentUser, users } = useAuth();

    const defaultAccount = appSettings.ledger_accounts?.find(a => a.isActive)?.name || 'Company Account';
    const defaultCategory = appSettings.ledger_categories?.find(c => c.isActive);
    const defaultMethod = appSettings.payment_methods?.find(m => m.isActive);

    // Merge ledger_accounts with system users dynamically
    const availableAccounts = useMemo(() => {
        const accountsFromSettings = appSettings.ledger_accounts || [];
        const merged = [...accountsFromSettings];

        // Add users that are not already in the list
        users.forEach(user => {
            const exists = merged.find(a => a.linkedUserId === user.id);
            if (!exists) {
                merged.push({
                    id: `user_${user.id}`,
                    name: user.name,
                    type: 'USER' as const,
                    linkedUserId: user.id,
                    isActive: true
                });
            }
        });

        return merged;
    }, [appSettings.ledger_accounts, users]);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);

    // Filter state

    // Filter state
    const [filterType, setFilterType] = useState<LedgerEntryType | 'ALL'>('ALL');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
    const [filterCategory, setFilterCategory] = useState<string>('ALL');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    // Logs state
    const [viewingLogsFor, setViewingLogsFor] = useState<string | 'ALL' | null>(null);
    const [returnToAllLogs, setReturnToAllLogs] = useState(false);


    // Image Modal State
    const [imageModalUrls, setImageModalUrls] = useState<string[]>([]);
    const [imageModalIndex, setImageModalIndex] = useState(0);

    // Custom Select State
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);


    // Import Modal State
    const [showImportModal, setShowImportModal] = useState(false);
    const [importMode, setImportMode] = useState<'CSV' | 'JSON'>('CSV');
    const [importText, setImportText] = useState('');
    const [parsedEntries, setParsedEntries] = useState<BulkLedgerImportEntry[]>([]);
    const [parseErrors, setParseErrors] = useState<string[]>([]);
    const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [copiedSample, setCopiedSample] = useState(false);



    React.useEffect(() => {
        if (viewingLogsFor) {
            // Fetch logs when viewer opens
            // If ALL, fetch some recent, if ID, fetch for ID
            const entryId = viewingLogsFor === 'ALL' ? undefined : viewingLogsFor;
            fetchLedgerLogs(entryId);
        }
    }, [viewingLogsFor]);

    // Derived stats for the TABLE LIST (respects all visual filters including Pending/Rejected)
    const tableEntries = useMemo(() => {
        return ledgerEntries.filter(e => {
            if (filterType !== 'ALL' && e.entryType !== filterType) return false;

            // Filter by status: 
            // - If ALL: show everything except REJECTED
            // - If REJECTED: show only REJECTED
            // - If PENDING: show only PENDING
            if (filterStatus === 'ALL') {
                if (e.status === 'REJECTED') return false;
            } else {
                if ((e.status || 'PENDING') !== filterStatus) return false;
            }

            if (filterCategory !== 'ALL' && (e.category !== filterCategory && e.categoryId !== filterCategory)) return false;
            if (filterDateFrom && e.date < filterDateFrom) return false;
            if (filterDateTo && e.date > filterDateTo) return false;
            return true;
        });
    }, [ledgerEntries, filterType, filterStatus, filterCategory, filterDateFrom, filterDateTo]);

    // Derived stats for the TOP CARDS (ALWAYS uses APPROVED only, ignores status filter)
    const cardStats = useMemo(() => {
        const approvedEntries = ledgerEntries.filter(e => {
            // MUST be approved to count towards totals
            if (e.status !== 'APPROVED') return false;

            // Apply other filters (Type, Category, Date) so totals match the context of what user is looking for
            // (e.g. "Show me approved Expenses from Jan 1 to Jan 31")
            if (filterType !== 'ALL' && e.entryType !== filterType) return false;
            if (filterCategory !== 'ALL' && (e.category !== filterCategory && e.categoryId !== filterCategory)) return false;
            if (filterDateFrom && e.date < filterDateFrom) return false;
            if (filterDateTo && e.date > filterDateTo) return false;
            return true;
        });

        const income = approvedEntries.filter(e => e.entryType === 'INCOME').reduce((s, e) => s + e.amount, 0);
        const expenses = approvedEntries.filter(e => e.entryType === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
        const reimbursements = approvedEntries.filter(e => e.entryType === 'REIMBURSEMENT').reduce((s, e) => s + e.amount, 0);

        return { income, expenses, reimbursements, net: income + reimbursements - expenses };
    }, [ledgerEntries, filterType, filterCategory, filterDateFrom, filterDateTo]); // Note: filterStatus dependency removed intentionally

    // Calculate user balances: (Expenses paid by user) - (Reimbursements received by user)
    // Only count APPROVED entries to ensure accurate tracking
    const userBalances = useMemo(() => {
        const balances: Record<string, { name: string, expensesPaid: number, reimbursementsReceived: number }> = {};

        ledgerEntries.forEach(entry => {
            // Only count APPROVED entries for accurate balance tracking
            if (entry.status !== 'APPROVED') return;

            // Count EXPENSES where a user paid (sourceAccount is a user, not Company Account)
            if (entry.entryType === 'EXPENSE' &&
                entry.sourceAccount &&
                entry.sourceAccount !== 'Company Account') {
                const userName = entry.sourceAccount;
                if (!balances[userName]) {
                    balances[userName] = { name: userName, expensesPaid: 0, reimbursementsReceived: 0 };
                }
                balances[userName].expensesPaid += entry.amount;
            }

            // Count REIMBURSEMENTS where user is the destination (received money back)
            if (entry.entryType === 'REIMBURSEMENT' &&
                entry.destinationAccount &&
                entry.destinationAccount !== 'Company Account') {
                const userName = entry.destinationAccount;
                if (!balances[userName]) {
                    balances[userName] = { name: userName, expensesPaid: 0, reimbursementsReceived: 0 };
                }
                balances[userName].reimbursementsReceived += entry.amount;
            }
        });

        // Return only users with a positive remaining balance (still owed money)
        return Object.values(balances)
            .map(b => ({ ...b, remaining: b.expensesPaid - b.reimbursementsReceived }))
            .filter(b => b.remaining > 0);
    }, [ledgerEntries]);

    // Total pending amount owed to all users
    const totalPendingOwed = useMemo(() => {
        return userBalances.reduce((sum, b) => sum + b.remaining, 0);
    }, [userBalances]);

    const resetForm = () => {
        setEditingEntry(null);
        setShowForm(false);
    };

    const handleEdit = (entry: LedgerEntry) => {
        setEditingEntry(entry);
        setShowForm(true);
    };



    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this entry?')) {
            await deleteLedgerEntry(id);
        }
    };

    const handleApproval = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        let reason = undefined;
        if (status === 'REJECTED') {
            const input = prompt("Enter reason for rejection:");
            if (input === null) return; // Cancelled
            reason = input || "No reason provided";
        }
        await updateLedgerEntryStatus(id, status, reason);
    };

    const getTypeColor = (type: LedgerEntryType) => {
        switch (type) {
            case 'INCOME': return 'text-emerald-600 bg-emerald-50';
            case 'EXPENSE': return 'text-red-600 bg-red-50';
            case 'REIMBURSEMENT': return 'text-purple-600 bg-purple-50';
        }
    };

    const getTypeIcon = (type: LedgerEntryType) => {
        switch (type) {
            case 'INCOME': return <TrendingUp size={16} />;
            case 'EXPENSE': return <TrendingDown size={16} />;
            case 'REIMBURSEMENT': return <RotateCcw size={16} />;
        }
    };

    const getStatusIcon = (status?: string) => {
        switch (status) {
            case 'APPROVED': return <CheckCircle2 size={14} className="text-emerald-500" />;
            case 'REJECTED': return <XCircle size={14} className="text-red-500" />;
            default: return <Clock size={14} className="text-amber-500" />;
        }
    };


    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#403424]">Ledger</h1>
                    <p className="text-sm text-[#403424]/60">Track income, expenses, and reimbursements</p>
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Beta</span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setViewingLogsFor('ALL'); setReturnToAllLogs(false); }}
                        className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                        title="View All Audit Logs"
                    >
                        <FileText size={18} /> <span className="hidden md:inline">Audit Logs</span>
                    </button>
                    <button
                        onClick={() => {
                            setShowImportModal(true);
                            setImportText('');
                            setParsedEntries([]);
                            setParseErrors([]);
                            setImportResult(null);
                        }}
                        className="flex items-center gap-2 px-3 py-2.5 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                        title="Import Transactions"
                    >
                        <FileUp size={18} /> <span className="hidden md:inline">Import</span>
                    </button>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#95a77c] text-white rounded-lg hover:bg-[#7d8f68] transition-colors shadow-md"
                    >
                        <Plus size={18} /> New Entry
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-[#403424]/5">
                    <div className="flex items-center gap-2 text-emerald-600 mb-1">
                        <TrendingUp size={16} /> <span className="text-xs font-medium uppercase">Income</span>
                    </div>
                    <p className="text-xl font-bold text-[#403424]">₹{cardStats.income.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-[#403424]/5">
                    <div className="flex items-center gap-2 text-red-600 mb-1">
                        <TrendingDown size={16} /> <span className="text-xs font-medium uppercase">Expenses</span>
                    </div>
                    <p className="text-xl font-bold text-[#403424]">₹{cardStats.expenses.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-[#403424]/5">
                    <div className="flex items-center gap-2 text-[#403424] mb-1">
                        <span className="text-xs font-medium uppercase">Net Balance</span>
                    </div>
                    <p className={`text-xl font-bold ${cardStats.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        ₹{cardStats.net.toLocaleString()}
                    </p>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 shadow-sm border border-purple-100 flex flex-col min-h-[160px] col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-purple-600">
                            <Users size={16} /> <span className="text-xs font-bold uppercase tracking-tight font-black">Owed to Users</span>
                        </div>
                        <span className="text-[10px] font-black text-purple-400 bg-purple-100/50 px-1.5 py-0.5 rounded">TOTAL</span>
                    </div>
                    <p className="text-2xl font-black text-purple-700 leading-tight mb-3">₹{totalPendingOwed.toLocaleString()}</p>

                    {userBalances.length > 0 ? (
                        <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar max-h-[120px]">
                            {userBalances.map(b => (
                                <div key={b.name} className="flex flex-col gap-0.5 bg-white/60 p-2 rounded-lg border border-purple-100 shadow-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-700 truncate">{b.name}</span>
                                        <span className="text-sm font-black text-purple-700">₹{b.remaining.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mt-1">
                                        <span className="bg-emerald-50 text-emerald-600 px-1 rounded">Paid: ₹{b.expensesPaid.toLocaleString()}</span>
                                        <span className="bg-purple-50 text-purple-600 px-1 rounded">Ret: ₹{b.reimbursementsReceived.toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center border-t border-purple-100/30 mt-1 opacity-60">
                            <CheckCircle2 size={24} className="text-purple-300 mb-1" />
                            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">All Cleared</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setFilterStatus('ALL')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'ALL'
                        ? 'bg-[#403424] text-white'
                        : 'bg-white text-[#403424]/60 border border-[#403424]/10 hover:bg-[#403424]/5'
                        }`}
                >
                    All Entries
                </button>
                <button
                    onClick={() => setFilterStatus('PENDING')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${filterStatus === 'PENDING'
                        ? 'bg-amber-500 text-white'
                        : 'bg-white text-amber-600 border border-amber-200 hover:bg-amber-50'
                        }`}
                >
                    <Clock size={14} />
                    Pending
                    {ledgerEntries.filter(e => !e.status || e.status === 'PENDING').length > 0 && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${filterStatus === 'PENDING' ? 'bg-white/20' : 'bg-amber-100'
                            }`}>
                            {ledgerEntries.filter(e => !e.status || e.status === 'PENDING').length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setFilterStatus('REJECTED')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${filterStatus === 'REJECTED'
                        ? 'bg-red-500 text-white'
                        : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
                        }`}
                >
                    <XCircle size={14} />
                    Rejected
                    {ledgerEntries.filter(e => e.status === 'REJECTED').length > 0 && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${filterStatus === 'REJECTED' ? 'bg-white/20' : 'bg-red-100'
                            }`}>
                            {ledgerEntries.filter(e => e.status === 'REJECTED').length}
                        </span>
                    )}
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-[#403424]/5">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-[#403424]/60">
                        <Filter size={16} /> Filters:
                    </div>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                        className="px-3 py-1.5 rounded-lg border border-[#403424]/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#95a77c]"
                    >
                        <option value="ALL">All Types</option>
                        <option value="INCOME">Income</option>
                        <option value="EXPENSE">Expense</option>
                    </select>

                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-[#403424]/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#95a77c] max-w-[150px]"
                    >
                        <option value="ALL">All Categories</option>
                        {appSettings.ledger_categories?.filter(c => c.isActive).map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </select>

                    <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-[#403424]/40" />
                        <input
                            type="date"
                            value={filterDateFrom}
                            onChange={(e) => setFilterDateFrom(e.target.value)}
                            className="px-2 py-1.5 rounded-lg border border-[#403424]/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#95a77c]"
                        />
                        <span className="text-[#403424]/40">to</span>
                        <input
                            type="date"
                            value={filterDateTo}
                            onChange={(e) => setFilterDateTo(e.target.value)}
                            className="px-2 py-1.5 rounded-lg border border-[#403424]/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#95a77c]"
                        />
                    </div>
                    {(filterType !== 'ALL' || filterStatus !== 'ALL' || filterCategory !== 'ALL' || filterDateFrom || filterDateTo) && (
                        <button
                            onClick={() => { setFilterType('ALL'); setFilterStatus('ALL'); setFilterCategory('ALL'); setFilterDateFrom(''); setFilterDateTo(''); }}
                            className="text-xs text-[#403424]/60 hover:text-[#403424] underline"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Entries List */}
            <div className="bg-white rounded-xl shadow-sm border border-[#403424]/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-[#403424]/5 text-xs uppercase tracking-wider text-[#403424]/60">
                            <tr>
                                <th className="px-4 py-3 text-left">Date</th>
                                <th className="px-4 py-3 text-left">Category</th>
                                <th className="px-4 py-3 text-left">Description</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                                <th className="px-4 py-3 text-center">Bill</th>
                                <th className="px-4 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#403424]/5">
                            {tableEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-[#403424]/40">
                                        No ledger entries yet. Click "New Entry" to add one.
                                    </td>
                                </tr>
                            ) : (
                                tableEntries.sort((a, b) => b.timestamp - a.timestamp).map(entry => {
                                    const dotColor = entry.entryType === 'INCOME' ? 'bg-emerald-500' :
                                        entry.entryType === 'EXPENSE' ? 'bg-red-500' : 'bg-purple-500';
                                    const rowBg = entry.status === 'REJECTED' ? 'bg-red-50/30 opacity-60' :
                                        entry.entryType === 'INCOME' ? 'bg-emerald-50/20' :
                                            entry.entryType === 'REIMBURSEMENT' ? 'bg-purple-50/20' : '';
                                    return (
                                        <tr key={entry.id} className={`hover:bg-[#403424]/[0.02] ${rowBg}`}>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-start gap-3">
                                                    {/* Dot Indicator - only for pending */}
                                                    {(!entry.status || entry.status === 'PENDING') && (
                                                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor}`} title={entry.entryType} />
                                                    )}

                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-[#403424]">
                                                                {formatLedgerDateTime(entry.timestamp).date}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                {formatLedgerDateTime(entry.timestamp).time}
                                                            </span>
                                                        </div>
                                                        {/* Status Pills */}
                                                        {entry.status !== 'APPROVED' && (
                                                            <div className="flex flex-col gap-1 mt-0.5">
                                                                <span className={`w-fit text-[10px] font-bold uppercase px-2 py-0.5 rounded ${entry.status === 'REJECTED' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'
                                                                    }`}>
                                                                    {entry.status === 'REJECTED' ? 'Rejected' : 'Pending'}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {entry.status === 'APPROVED' && (
                                                            <div className="flex flex-col gap-1 mt-0.5">
                                                                <span className="w-fit text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                                                                    Approved
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-center gap-3">
                                                    {(() => {
                                                        const cat = appSettings.ledger_categories?.find(c => c.id === entry.categoryId || c.name === entry.category);
                                                        return (
                                                            <>
                                                                <div
                                                                    className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0"
                                                                    style={{ backgroundColor: `${cat?.color || '#6366f1'}15`, color: cat?.color || '#6366f1' }}
                                                                >
                                                                    <IconRenderer name={cat?.icon || 'Package'} size={18} />
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-bold truncate text-sm text-[#403424]">{entry.category}</span>
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm max-w-xs">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-[#403424] text-base">{entry.description}</span>
                                                        {(() => {
                                                            const branch = branches.find(b => b.id === entry.branchId);
                                                            if (!branch) return null;
                                                            return (
                                                                <span className="text-[10px] bg-slate-50 text-slate-400 px-2 py-0.5 rounded-full border border-slate-100 font-bold" title={`Branch: ${branch.name}`}>
                                                                    {branch.name}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-200 uppercase">
                                                            {entry.createdByName?.charAt(0) || 'U'}
                                                        </div>
                                                        <span className="text-xs text-slate-400 font-medium">{entry.createdByName}</span>

                                                        <span className="text-slate-200 text-xs">•</span>

                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded border border-slate-100 font-bold uppercase tracking-tight">
                                                                {entry.sourceAccount || 'Company Account'}
                                                            </span>
                                                            {entry.entryType === 'REIMBURSEMENT' && entry.destinationAccount && (
                                                                <>
                                                                    <span className="text-[10px] text-slate-300">→</span>
                                                                    <span className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded border border-slate-100 font-bold uppercase tracking-tight">
                                                                        {entry.destinationAccount}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {entry.rejectedReason && <div className="text-[10px] text-red-400 italic mt-1 bg-red-50/50 px-2 py-1 rounded">Note: {entry.rejectedReason}</div>}
                                                </div>
                                            </td>
                                            <td className={`px-4 py-3 text-base font-bold text-right ${entry.entryType === 'INCOME' ? 'text-emerald-600' : entry.entryType === 'EXPENSE' ? 'text-red-600' : 'text-blue-600'}`}>
                                                ₹{entry.amount.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {entry.billUrls && entry.billUrls.length > 0 ? (
                                                    <button
                                                        onClick={() => { setImageModalUrls(entry.billUrls!); setImageModalIndex(0); }}
                                                        className="text-xl hover:scale-110 transition-transform"
                                                        title="View Attachment"
                                                    >
                                                        📎
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    {/* Auditor Actions */}
                                                    {currentUser?.isLedgerAuditor && (!entry.status || entry.status === 'PENDING') && (
                                                        <>
                                                            <button onClick={() => handleApproval(entry.id, 'APPROVED')} className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-100 shadow-sm" title="Approve">
                                                                <CheckCircle2 size={20} />
                                                            </button>
                                                            <button onClick={() => handleApproval(entry.id, 'REJECTED')} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100 shadow-sm" title="Reject">
                                                                <XCircle size={20} />
                                                            </button>
                                                            <div className="w-px h-6 bg-slate-200 mx-1"></div>
                                                        </>
                                                    )}
                                                    <button onClick={() => handleEdit(entry)} className="p-2 text-[#403424]/40 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Edit">
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button onClick={() => handleDelete(entry.id)} className="p-2 text-[#403424]/40 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                        <Trash2 size={18} />
                                                    </button>
                                                    <button onClick={() => { setViewingLogsFor(entry.id); setReturnToAllLogs(false); }} className="p-2 text-[#403424]/40 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View Logs">
                                                        <History size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Logs Modal */}
            {viewingLogsFor && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-[#403424]/10">
                            <div className="flex items-center gap-3">
                                {returnToAllLogs && (
                                    <button
                                        onClick={() => { setViewingLogsFor('ALL'); setReturnToAllLogs(false); }}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                                        title="Back to All Logs"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                )}
                                <div>
                                    <h2 className="text-lg font-bold text-[#403424]">
                                        {viewingLogsFor === 'ALL' ? 'Global Ledger Audit Logs' : 'Entry Audit History'}
                                    </h2>
                                    {viewingLogsFor !== 'ALL' && (
                                        <p className="text-xs text-slate-400 font-medium">
                                            Transaction ID: <span className="font-mono">{viewingLogsFor}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => { setViewingLogsFor(null); setReturnToAllLogs(false); }} className="p-1 text-[#403424]/40 hover:text-[#403424]">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Transaction Snapshot (Only when viewing specific entry) */}
                        {viewingLogsFor !== 'ALL' && viewingLogsFor && (
                            <div className="bg-slate-50 border-b border-slate-200 p-4">
                                {(() => {
                                    const entry = ledgerEntries.find(e => e.id === viewingLogsFor);
                                    if (!entry) return <div className="text-sm text-slate-400 italic">Transaction details not found (might have been deleted).</div>;

                                    const typeColor = getTypeColor(entry.entryType);

                                    return (
                                        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-lg ${typeColor} bg-white shadow-sm border border-slate-100`}>
                                                    {getTypeIcon(entry.entryType)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-[#403424]">{entry.category}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${entry.entryType === 'INCOME' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                entry.entryType === 'EXPENSE' ? 'bg-red-50 text-red-600 border-red-100' :
                                                                    'bg-purple-50 text-purple-600 border-purple-100'
                                                            }`}>
                                                            {entry.entryType}
                                                        </span>
                                                        {entry.status && (
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${entry.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                    entry.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-100' :
                                                                        'bg-amber-50 text-amber-600 border-amber-100'
                                                                }`}>
                                                                {entry.status}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-slate-600 mt-0.5">{entry.description}</p>
                                                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                                        <span className="flex items-center gap-1"><Calendar size={12} /> {formatLedgerDateTime(entry.timestamp).date}</span>
                                                        <span className="flex items-center gap-1"><Clock size={12} /> {formatLedgerDateTime(entry.timestamp).time}</span>
                                                        <span className="flex items-center gap-1"><Users size={12} /> {entry.createdByName}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className={`text-xl font-bold ${entry.entryType === 'INCOME' ? 'text-emerald-600' :
                                                        entry.entryType === 'REIMBURSEMENT' ? 'text-purple-600' : 'text-red-600'
                                                    }`}>
                                                    ₹{entry.amount.toLocaleString()}
                                                </span>
                                                <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">{entry.paymentMethod}</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full">
                                <thead className="bg-[#403424]/5 text-xs uppercase tracking-wider text-[#403424]/60 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Date</th>
                                        <th className="px-4 py-3 text-left">Action</th>
                                        <th className="px-4 py-3 text-left">Performed By</th>
                                        <th className="px-4 py-3 text-left">Details</th>
                                        {viewingLogsFor === 'ALL' && <th className="px-4 py-3 text-center">Reference</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#403424]/5">
                                    {(ledgerLogs || []).length === 0 ? (
                                        <tr><td colSpan={viewingLogsFor === 'ALL' ? 5 : 4} className="p-8 text-center text-slate-400">No logs found.</td></tr>
                                    ) : (
                                        ledgerLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 text-sm">
                                                    <div>{log.date}</div>
                                                    <div className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold uppercase ${log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700' :
                                                        log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                                                            log.action === 'APPROVE' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {log.performedByName}
                                                    {currentUser?.id === log.performedBy && <span className="ml-1 text-[10px] text-slate-400">(You)</span>}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-mono text-slate-600 max-w-md">
                                                    {/* Simple diff or snapshot summary */}
                                                    {log.action === 'CREATE' && `Created entries of ${log.snapshot.amount} for ${log.snapshot.category} ${log.snapshot.entryType === 'REIMBURSEMENT' && log.snapshot.destinationAccount ? `(Transfer: ${log.snapshot.sourceAccount?.split(' ')[0]} -> ${log.snapshot.destinationAccount?.split(' ')[0]})` : ''}`}
                                                    {log.action === 'UPDATE' && `Updated entry. Amount: ${log.snapshot.amount}, Status: ${log.snapshot.status}`}
                                                    {log.action === 'DELETE' && `Deleted entry of ${log.snapshot.amount}`}
                                                    {log.action === 'APPROVE' && `Approved entry. Approver: ${log.snapshot.approvedBy}`}
                                                    {log.action === 'REJECT' && `Rejected. Reason: ${log.snapshot.rejectedReason}`}
                                                </td>
                                                {viewingLogsFor === 'ALL' && (
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => {
                                                                setViewingLogsFor(log.ledgerEntryId);
                                                                setReturnToAllLogs(true);
                                                            }}
                                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                            title="View Transaction History"
                                                        >
                                                            <ChevronRight size={16} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {/* Add/Edit Modal */}
            <LedgerEntryModal
                isOpen={showForm}
                onClose={resetForm}
                initialData={editingEntry}
            />
            {/* Image Carousel Modal */}
            {imageModalUrls.length > 0 && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4" onClick={() => setImageModalUrls([])}>
                    <div className="relative max-w-4xl max-h-[90vh] flex items-center" onClick={e => e.stopPropagation()}>
                        <img
                            src={imageModalUrls[imageModalIndex]}
                            alt={`Bill ${imageModalIndex + 1}`}
                            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
                        />

                        {/* Navigation Arrows */}
                        {imageModalUrls.length > 1 && (
                            <>
                                <button
                                    onClick={() => setImageModalIndex(i => (i - 1 + imageModalUrls.length) % imageModalUrls.length)}
                                    className="absolute left-0 -translate-x-full mr-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                                >
                                    <ChevronLeft size={28} />
                                </button>
                                <button
                                    onClick={() => setImageModalIndex(i => (i + 1) % imageModalUrls.length)}
                                    className="absolute right-0 translate-x-full ml-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                                >
                                    <ChevronRight size={28} />
                                </button>
                            </>
                        )}

                        {/* Image Counter */}
                        {imageModalUrls.length > 1 && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                                {imageModalIndex + 1} / {imageModalUrls.length}
                            </div>
                        )}
                    </div>

                    {/* Close Button */}
                    <button className="absolute top-4 right-4 text-white hover:text-red-400 transition-colors" onClick={() => setImageModalUrls([])}>
                        <X size={32} />
                    </button>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-[#403424]/10">
                            <h2 className="text-lg font-bold text-[#403424] flex items-center gap-2">
                                <FileUp size={20} /> Bulk Import Transactions
                            </h2>
                            <button onClick={() => setShowImportModal(false)} className="p-1 text-[#403424]/40 hover:text-[#403424]">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            {/* Mode Toggle */}
                            <div className="flex gap-2">
                                {(['CSV', 'JSON'] as const).map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => { setImportMode(mode); setImportText(''); setParsedEntries([]); setParseErrors([]); }}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${importMode === mode
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>

                            {/* Format Documentation */}
                            <details className="bg-slate-50 rounded-lg border border-slate-200">
                                <summary className="px-4 py-3 cursor-pointer text-sm font-bold text-slate-600 flex items-center gap-2">
                                    <AlertCircle size={16} /> Expected Format & Sample Data
                                </summary>
                                <div className="px-4 pb-4 space-y-3">
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Required Fields</h4>
                                        <p className="text-xs text-slate-600">
                                            <code className="bg-slate-200 px-1 rounded">date</code> (YYYY-MM-DD),
                                            <code className="bg-slate-200 px-1 rounded ml-1">entryType</code> (INCOME/EXPENSE/REIMBURSEMENT),
                                            <code className="bg-slate-200 px-1 rounded ml-1">category</code>,
                                            <code className="bg-slate-200 px-1 rounded ml-1">amount</code>,
                                            <code className="bg-slate-200 px-1 rounded ml-1">description</code>,
                                            <code className="bg-slate-200 px-1 rounded ml-1">paymentMethod</code>
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Optional Fields</h4>
                                        <p className="text-xs text-slate-600">
                                            <code className="bg-slate-200 px-1 rounded">sourceAccount</code> (defaults to "Company Account"),
                                            <code className="bg-slate-200 px-1 rounded ml-1">destinationAccount</code> (required for REIMBURSEMENT),
                                            <code className="bg-slate-200 px-1 rounded ml-1">branchName</code>
                                        </p>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase">Sample {importMode}</h4>
                                            <button
                                                onClick={() => {
                                                    const sample = importMode === 'CSV'
                                                        ? `date,entryType,category,amount,description,paymentMethod,sourceAccount,destinationAccount,branchName\n2025-01-15,EXPENSE,Supplies,1500,Office stationery purchase,CASH,Company Account,,Main Branch\n2025-01-16,INCOME,Other,5000,Client payment received,UPI,Company Account,,\n2025-01-17,REIMBURSEMENT,Transport,500,Travel expense reimbursement,BANK_TRANSFER,Company Account,John,`
                                                        : JSON.stringify([
                                                            { date: "2025-01-15", entryType: "EXPENSE", category: "Supplies", amount: 1500, description: "Office stationery purchase", paymentMethod: "CASH", branchName: "Main Branch" },
                                                            { date: "2025-01-16", entryType: "INCOME", category: "Other", amount: 5000, description: "Client payment received", paymentMethod: "UPI" }
                                                        ], null, 2);
                                                    navigator.clipboard.writeText(sample);
                                                    setCopiedSample(true);
                                                    setTimeout(() => setCopiedSample(false), 2000);
                                                }}
                                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                                            >
                                                {copiedSample ? <Check size={12} /> : <Copy size={12} />}
                                                {copiedSample ? 'Copied!' : 'Copy Sample'}
                                            </button>
                                        </div>
                                        <pre className="bg-slate-800 text-slate-100 p-3 rounded text-xs overflow-x-auto max-h-32">
                                            {importMode === 'CSV'
                                                ? `date,entryType,category,amount,description,paymentMethod,sourceAccount,destinationAccount,branchName\n2025-01-15,EXPENSE,Supplies,1500,Office stationery purchase,CASH,Company Account,,Main Branch\n2025-01-16,INCOME,Other,5000,Client payment received,UPI,Company Account,,`
                                                : JSON.stringify([{ date: "2025-01-15", entryType: "EXPENSE", category: "Supplies", amount: 1500, description: "Office stationery purchase", paymentMethod: "CASH" }], null, 2)
                                            }
                                        </pre>
                                    </div>
                                </div>
                            </details>

                            {/* Input Area */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Paste your {importMode} data</label>
                                <textarea
                                    value={importText}
                                    onChange={(e) => setImportText(e.target.value)}
                                    placeholder={importMode === 'CSV'
                                        ? 'Paste CSV data here (with header row)...'
                                        : 'Paste JSON array here...'}
                                    rows={6}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                                />
                            </div>

                            {/* Parse Button */}
                            <button
                                onClick={() => {
                                    setParseErrors([]);
                                    setParsedEntries([]);
                                    setImportResult(null);

                                    try {
                                        if (importMode === 'JSON') {
                                            const parsed = JSON.parse(importText);
                                            if (!Array.isArray(parsed)) throw new Error('JSON must be an array');
                                            setParsedEntries(parsed as BulkLedgerImportEntry[]);
                                        } else {
                                            // CSV parsing
                                            const lines = importText.trim().split('\n');
                                            if (lines.length < 2) throw new Error('CSV must have header row and at least one data row');

                                            const headers = lines[0].split(',').map(h => h.trim());
                                            const entries: BulkLedgerImportEntry[] = [];

                                            for (let i = 1; i < lines.length; i++) {
                                                const values = lines[i].split(',').map(v => v.trim());
                                                const entry: any = {};
                                                headers.forEach((h, idx) => {
                                                    if (h === 'amount') entry[h] = parseFloat(values[idx]) || 0;
                                                    else entry[h] = values[idx] || undefined;
                                                });
                                                entries.push(entry as BulkLedgerImportEntry);
                                            }
                                            setParsedEntries(entries);
                                        }
                                    } catch (e: any) {
                                        setParseErrors([`Parse error: ${e.message}`]);
                                    }
                                }}
                                disabled={!importText.trim()}
                                className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Parse & Validate
                            </button>

                            {/* Parse Errors */}
                            {parseErrors.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <h4 className="text-sm font-bold text-red-700 mb-1">Errors</h4>
                                    <ul className="text-xs text-red-600 space-y-1">
                                        {parseErrors.map((err, i) => <li key={i}>• {err}</li>)}
                                    </ul>
                                </div>
                            )}

                            {/* Preview Table */}
                            {parsedEntries.length > 0 && !importResult && (
                                <div>
                                    <h4 className="text-sm font-bold text-slate-600 mb-2">Preview ({parsedEntries.length} entries)</h4>
                                    <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-60">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-100 sticky top-0">
                                                <tr>
                                                    <th className="px-2 py-1.5 text-left">#</th>
                                                    <th className="px-2 py-1.5 text-left">Date</th>
                                                    <th className="px-2 py-1.5 text-left">Type</th>
                                                    <th className="px-2 py-1.5 text-left">Category</th>
                                                    <th className="px-2 py-1.5 text-right">Amount</th>
                                                    <th className="px-2 py-1.5 text-left">Description</th>
                                                    <th className="px-2 py-1.5 text-left">Payment</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {parsedEntries.slice(0, 50).map((entry, i) => (
                                                    <tr key={i} className="hover:bg-slate-50">
                                                        <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                                                        <td className="px-2 py-1.5">{entry.date}</td>
                                                        <td className="px-2 py-1.5">
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${entry.entryType === 'INCOME' ? 'bg-emerald-100 text-emerald-700' :
                                                                entry.entryType === 'EXPENSE' ? 'bg-red-100 text-red-700' :
                                                                    'bg-purple-100 text-purple-700'
                                                                }`}>
                                                                {entry.entryType}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5">{entry.category}</td>
                                                        <td className="px-2 py-1.5 text-right font-medium">₹{entry.amount?.toLocaleString()}</td>
                                                        <td className="px-2 py-1.5 max-w-[200px] truncate">{entry.description}</td>
                                                        <td className="px-2 py-1.5">{entry.paymentMethod}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {parsedEntries.length > 50 && (
                                        <p className="text-xs text-slate-400 mt-1">Showing first 50 of {parsedEntries.length} entries</p>
                                    )}
                                </div>
                            )}

                            {/* Import Result */}
                            {importResult && (
                                <div className={`rounded-lg p-4 ${importResult.failureCount === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                                    <h4 className={`text-sm font-bold mb-2 ${importResult.failureCount === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        Import Complete
                                    </h4>
                                    <div className="flex gap-4 text-sm">
                                        <span className="text-emerald-600">✓ {importResult.successCount} imported</span>
                                        {importResult.failureCount > 0 && (
                                            <span className="text-red-600">✗ {importResult.failureCount} failed</span>
                                        )}
                                    </div>
                                    {importResult.errors.length > 0 && (
                                        <div className="mt-2 text-xs text-red-600 max-h-32 overflow-y-auto">
                                            {importResult.errors.map((err, i) => (
                                                <div key={i}>Row {err.row}: {err.message}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="flex gap-3 p-4 border-t border-slate-200">
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                {importResult ? 'Close' : 'Cancel'}
                            </button>
                            {parsedEntries.length > 0 && !importResult && (
                                <button
                                    onClick={async () => {
                                        setIsImporting(true);
                                        const result = await addBulkLedgerEntries(parsedEntries);
                                        setImportResult(result);
                                        setIsImporting(false);
                                    }}
                                    disabled={isImporting}
                                    className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isImporting ? (
                                        <><span className="animate-spin">⏳</span> Importing...</>
                                    ) : (
                                        <>Import {parsedEntries.length} Entries</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Ledger;
