import React, { useState, useMemo } from 'react';
import {
    Plus, Trash2, Edit2, X, TrendingUp, TrendingDown, RotateCcw, Filter, Calendar,
    CheckCircle2, XCircle, Clock, History, FileText, UploadCloud, Image as ImageIcon,
    ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { LedgerEntry, LedgerEntryType, LedgerCategory, LedgerCategoryDefinition, LedgerPaymentMethod } from '../types';
import { uploadImageToBunny } from '../services/bunnyStorage';
import { compressImage } from '../services/imageUtils';
import { IconRenderer } from '../services/iconLibrary';

const getLocalISOString = (date: Date = new Date()): string => {
    const offset = date.getTimezoneOffset() * 60000;
    const localTime = new Date(date.getTime() - offset);
    return localTime.toISOString().slice(0, 10);
};

// IconRenderer is now imported from ../services/iconLibrary

const Ledger: React.FC = () => {
    const { branches, ledgerEntries, addLedgerEntry, updateLedgerEntry, deleteLedgerEntry, updateLedgerEntryStatus, ledgerLogs, fetchLedgerLogs, appSettings } = useStore();
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
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        branchId: currentUser?.defaultBranchId || '',
        entryType: 'EXPENSE' as LedgerEntryType,
        category: defaultCategory?.name || '',
        categoryId: defaultCategory?.id || '',
        amount: '',
        description: '',
        paymentMethod: defaultMethod?.name || '',
        paymentMethodId: defaultMethod?.id || '',
        sourceAccount: defaultAccount,
        destinationAccount: '',
        destinationAccountId: '',
    });

    // Filter state
    const [filterType, setFilterType] = useState<LedgerEntryType | 'ALL'>('ALL');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
    const [filterDateFrom, setFilterDateFrom] = useState('');

    const [filterDateTo, setFilterDateTo] = useState('');

    // Logs state
    const [viewingLogsFor, setViewingLogsFor] = useState<string | 'ALL' | null>(null);

    // Bill Upload State - now supports multiple images
    const [billFiles, setBillFiles] = useState<File[]>([]);
    const [tempBillPreviews, setTempBillPreviews] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    // Image Modal State
    const [imageModalUrls, setImageModalUrls] = useState<string[]>([]);
    const [imageModalIndex, setImageModalIndex] = useState(0);

    // Custom Select State
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const CustomDropdown = <T extends { id: string, name: string, icon?: string, color?: string }>({
        label,
        value,
        options,
        onSelect,
        placeholder
    }: {
        label: string,
        value: string,
        options: T[],
        onSelect: (option: T) => void,
        placeholder: string
    }) => {
        const selected = options.find(o => o.id === value);
        return (
            <div className="relative">
                <label className="text-xs font-medium text-[#403424]/60 uppercase tracking-wide">{label}</label>
                <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === label ? null : label)}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[#403424]/10 focus:outline-none focus:ring-2 focus:ring-[#95a77c] bg-[#403424]/5 flex items-center justify-between"
                >
                    {selected ? (
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded flex items-center justify-center text-white" style={{ backgroundColor: selected.color || (label === 'Category' ? '#6366f1' : '#10b981') }}>
                                <IconRenderer name={selected.icon || (label === 'Category' ? 'Package' : 'CreditCard')} size={12} />
                            </div>
                            <span className="font-bold text-sm text-[#403424]">{selected.name}</span>
                        </div>
                    ) : <span className="text-[#403424]/40 text-sm">{placeholder}</span>}
                    <ChevronDown size={16} className={`text-[#403424]/40 transition-transform ${openDropdown === label ? 'rotate-180' : ''}`} />
                </button>

                {openDropdown === label && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-[#403424]/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                        <div className="p-1">
                            {options.map(opt => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => { onSelect(opt); setOpenDropdown(null); }}
                                    className={`w-full px-3 py-2.5 flex items-center gap-3 rounded-lg hover:bg-[#403424]/5 transition-colors text-left ${opt.id === value ? 'bg-[#95a77c]/10' : ''}`}
                                >
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0" style={{ backgroundColor: opt.color || (label === 'Category' ? '#6366f1' : '#10b981') }}>
                                        <IconRenderer name={opt.icon || (label === 'Category' ? 'Package' : 'CreditCard')} size={18} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`font-bold text-sm text-[#403424] ${opt.id === value ? 'text-[#95a77c]' : ''}`}>{opt.name}</span>
                                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{label}</span>
                                    </div>
                                    {opt.id === value && <CheckCircle2 size={16} className="ml-auto text-[#95a77c]" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    React.useEffect(() => {
        if (viewingLogsFor) {
            // Fetch logs when viewer opens
            // If ALL, fetch some recent, if ID, fetch for ID
            const entryId = viewingLogsFor === 'ALL' ? undefined : viewingLogsFor;
            fetchLedgerLogs(entryId);
        }
    }, [viewingLogsFor]);

    // Derived stats
    const stats = useMemo(() => {
        const filtered = ledgerEntries.filter(e => {
            if (filterType !== 'ALL' && e.entryType !== filterType) return false;
            if (filterStatus !== 'ALL' && (e.status || 'PENDING') !== filterStatus) return false;
            if (filterDateFrom && e.date < filterDateFrom) return false;
            if (filterDateTo && e.date > filterDateTo) return false;
            return true;
        });

        const income = filtered.filter(e => e.entryType === 'INCOME').reduce((s, e) => s + e.amount, 0);
        const expenses = filtered.filter(e => e.entryType === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
        const reimbursements = filtered.filter(e => e.entryType === 'REIMBURSEMENT').reduce((s, e) => s + e.amount, 0);

        return { income, expenses, reimbursements, net: income + reimbursements - expenses, entries: filtered };
    }, [ledgerEntries, filterType, filterStatus, filterDateFrom, filterDateTo]);

    // Calculate user balances: (Expenses paid by user) - (Reimbursements received by user)
    const userBalances = useMemo(() => {
        const balances: Record<string, { name: string, expensesPaid: number, reimbursementsReceived: number }> = {};

        ledgerEntries.forEach(entry => {
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

    const resetForm = () => {
        setFormData({
            date: new Date().toISOString().split('T')[0],
            branchId: currentUser?.defaultBranchId || '',
            entryType: 'EXPENSE',
            category: defaultCategory?.name || '',
            categoryId: defaultCategory?.id || '',
            amount: '',
            description: '',
            paymentMethod: defaultMethod?.name || '',
            paymentMethodId: defaultMethod?.id || '',
            sourceAccount: defaultAccount,
        });
        setBillFiles([]);
        setTempBillPreviews([]);
        setEditingEntry(null);
        setShowForm(false);
    };

    const handleEdit = (entry: LedgerEntry) => {
        setEditingEntry(entry);
        setFormData({
            date: entry.date,
            branchId: entry.branchId || '',
            entryType: entry.entryType,
            category: entry.category,
            categoryId: entry.categoryId || '',
            amount: entry.amount.toString(),
            description: entry.description,
            paymentMethod: entry.paymentMethod,
            paymentMethodId: entry.paymentMethodId || '',
            sourceAccount: entry.sourceAccount || 'Company Account',
            destinationAccount: entry.destinationAccount || '',
            destinationAccountId: entry.destinationAccountId || '',
        });
        setBillFiles([]);
        setTempBillPreviews(entry.billUrls || []);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.amount || !formData.description) return;

        setIsUploading(true);

        // Start with existing URLs (for editing) or empty array
        let billUrls: string[] = editingEntry?.billUrls || [];

        // Upload all new files
        if (billFiles.length > 0) {
            const uploadPromises = billFiles.map(file => new Promise<string | null>((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onloadend = async () => {
                    const base64 = reader.result as string;
                    try {
                        const url = await uploadImageToBunny(base64, 'ledger');
                        resolve(url);
                    } catch (err) {
                        console.error("Bill upload failed", err);
                        resolve(null);
                    }
                };
            }));

            const uploadedUrls = await Promise.all(uploadPromises);
            billUrls = [...billUrls, ...uploadedUrls.filter((u): u is string => u !== null)];
        }

        const selectedAccount = appSettings.ledger_accounts?.find(a => a.name === formData.sourceAccount);
        const entryData = {
            date: formData.date,
            timestamp: Date.now(),
            branchId: formData.branchId || undefined,
            entryType: formData.entryType,
            category: formData.category,
            categoryId: formData.categoryId,
            amount: parseFloat(formData.amount),
            description: formData.description.trim(),
            paymentMethod: formData.paymentMethod,
            paymentMethodId: formData.paymentMethodId,
            sourceAccount: formData.sourceAccount || 'Company Account',
            sourceAccountId: selectedAccount?.id,
            destinationAccount: formData.entryType === 'REIMBURSEMENT' ? formData.destinationAccount : undefined,
            destinationAccountId: formData.entryType === 'REIMBURSEMENT' ? (appSettings.ledger_accounts?.find(a => a.name === formData.destinationAccount)?.id || availableAccounts.find(a => a.name === formData.destinationAccount)?.id) : undefined,
            createdBy: currentUser?.id || '',
            createdByName: currentUser?.name || 'Unknown',
            billUrls: billUrls
        };

        if (editingEntry) {
            await updateLedgerEntry({ ...entryData, id: editingEntry.id });
        } else {
            await addLedgerEntry(entryData);
        }

        setIsUploading(false);
        resetForm();
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
                        onClick={() => setViewingLogsFor('ALL')}
                        className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                        title="View All Audit Logs"
                    >
                        <FileText size={18} /> <span className="hidden md:inline">Audit Logs</span>
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-[#403424]/5">
                    <div className="flex items-center gap-2 text-emerald-600 mb-1">
                        <TrendingUp size={16} /> <span className="text-xs font-medium uppercase">Income</span>
                    </div>
                    <p className="text-xl font-bold text-[#403424]">₹{stats.income.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-[#403424]/5">
                    <div className="flex items-center gap-2 text-red-600 mb-1">
                        <TrendingDown size={16} /> <span className="text-xs font-medium uppercase">Expenses</span>
                    </div>
                    <p className="text-xl font-bold text-[#403424]">₹{stats.expenses.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-[#403424]/5">
                    <div className="flex items-center gap-2 text-[#403424] mb-1">
                        <span className="text-xs font-medium uppercase">Net Balance</span>
                    </div>
                    <p className={`text-xl font-bold ${stats.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        ₹{stats.net.toLocaleString()}
                    </p>
                </div>
            </div>

            {/* User Balances - Pending Reimbursements */}
            {userBalances.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 shadow-sm border border-purple-100">
                    <div className="flex items-center gap-2 text-purple-700 mb-3">
                        <RotateCcw size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">Pending Reimbursements</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {userBalances.map(balance => (
                            <div key={balance.name} className="bg-white rounded-lg px-3 py-2 shadow-sm border border-purple-200 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm shrink-0">
                                    {balance.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-500 truncate">{balance.name}</p>
                                    <p className="font-bold text-purple-700">₹{balance.remaining.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">owed</span></p>
                                </div>
                                <div className="text-right text-[10px] text-slate-400">
                                    <div>Paid: ₹{balance.expensesPaid.toLocaleString()}</div>
                                    <div>Returned: ₹{balance.reimbursementsReceived.toLocaleString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                    Pending Approval
                    {ledgerEntries.filter(e => !e.status || e.status === 'PENDING').length > 0 && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${filterStatus === 'PENDING' ? 'bg-white/20' : 'bg-amber-100'
                            }`}>
                            {ledgerEntries.filter(e => !e.status || e.status === 'PENDING').length}
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
                    {(filterType !== 'ALL' || filterStatus !== 'ALL' || filterDateFrom || filterDateTo) && (
                        <button
                            onClick={() => { setFilterType('ALL'); setFilterStatus('ALL'); setFilterDateFrom(''); setFilterDateTo(''); }}
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
                            {stats.entries.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-[#403424]/40">
                                        No ledger entries yet. Click "New Entry" to add one.
                                    </td>
                                </tr>
                            ) : (
                                stats.entries.sort((a, b) => b.timestamp - a.timestamp).map(entry => {
                                    const borderColor = entry.entryType === 'INCOME' ? 'border-l-emerald-500' :
                                        entry.entryType === 'EXPENSE' ? 'border-l-red-500' : 'border-l-purple-500';
                                    const rowBg = entry.status === 'REJECTED' ? 'bg-red-50/30 opacity-60' :
                                        entry.entryType === 'INCOME' ? 'bg-emerald-50/20' :
                                            entry.entryType === 'REIMBURSEMENT' ? 'bg-purple-50/20' : '';
                                    return (
                                        <tr key={entry.id} className={`hover:bg-[#403424]/[0.02] border-l-4 ${borderColor} ${rowBg}`}>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-medium">{entry.date}</span>
                                                    {entry.branchId ? (
                                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded w-fit border border-slate-200 font-semibold truncate max-w-[100px]" title={`Branch: ${branches.find(b => b.id === entry.branchId)?.name || 'Unknown'}`}>
                                                            {branches.find(b => b.id === entry.branchId)?.name || 'Unknown'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded w-fit border border-amber-100 font-semibold uppercase tracking-wider">
                                                            General
                                                        </span>
                                                    )}
                                                    {entry.sourceAccount && entry.sourceAccount !== 'Company Account' && (
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded w-fit border border-indigo-100 font-semibold truncate max-w-[100px]" title={`From: ${entry.sourceAccount}`}>
                                                                {entry.sourceAccount.split(' ')[0]}
                                                            </span>
                                                            {entry.entryType === 'REIMBURSEMENT' && entry.destinationAccount && (
                                                                <>
                                                                    <span className="text-[10px] text-slate-400">→</span>
                                                                    <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded w-fit border border-purple-100 font-semibold truncate max-w-[100px]" title={`To: ${entry.destinationAccount}`}>
                                                                        {entry.destinationAccount.split(' ')[0]}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-center gap-3">
                                                    {(() => {
                                                        const cat = appSettings.ledger_categories?.find(c => c.id === entry.categoryId || c.name === entry.category);
                                                        const method = appSettings.payment_methods?.find(m => m.id === entry.paymentMethodId || m.name === entry.paymentMethod);
                                                        return (
                                                            <>
                                                                <div
                                                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
                                                                    style={{ backgroundColor: cat?.color || '#6366f1' }}
                                                                >
                                                                    <IconRenderer name={cat?.icon || 'Package'} size={20} />
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-bold truncate">{entry.category}</span>
                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                        <div
                                                                            className="w-3 h-3 rounded-full shrink-0"
                                                                            style={{ backgroundColor: method?.color || '#10b981' }}
                                                                        />
                                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">
                                                                            {entry.paymentMethod.replace('_', ' ')}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm max-w-xs">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate">{entry.description}</span>
                                                        {/* Status Pills - only for non-approved */}
                                                        {entry.status !== 'APPROVED' && (
                                                            <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${entry.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                {entry.status === 'REJECTED' ? 'Rejected' : 'Pending'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {entry.rejectedReason && <div className="text-[10px] text-red-500 italic">Note: {entry.rejectedReason}</div>}
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-slate-400">By: {entry.createdByName}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={`px-4 py-3 text-sm font-bold text-right ${entry.entryType === 'INCOME' ? 'text-emerald-600' : entry.entryType === 'EXPENSE' ? 'text-red-600' : 'text-blue-600'}`}>
                                                {entry.entryType === 'INCOME' ? '+' : '-'}₹{entry.amount.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                {entry.billUrls && entry.billUrls.length > 0 ? (
                                                    <button
                                                        onClick={() => { setImageModalUrls(entry.billUrls!); setImageModalIndex(0); }}
                                                        className="relative group"
                                                    >
                                                        <img
                                                            src={entry.billUrls[0]}
                                                            alt="Bill"
                                                            className="w-10 h-10 object-cover rounded border border-slate-200 hover:border-purple-400 transition-colors"
                                                        />
                                                        {entry.billUrls.length > 1 && (
                                                            <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                                                +{entry.billUrls.length - 1}
                                                            </span>
                                                        )}
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
                                                            <button onClick={() => handleApproval(entry.id, 'APPROVED')} className="p-1.5 text-emerald-300 hover:text-emerald-600 transition-colors" title="Approve">
                                                                <CheckCircle2 size={16} />
                                                            </button>
                                                            <button onClick={() => handleApproval(entry.id, 'REJECTED')} className="p-1.5 text-red-300 hover:text-red-600 transition-colors" title="Reject">
                                                                <XCircle size={16} />
                                                            </button>
                                                            <div className="w-px h-4 bg-slate-200 mx-0.5"></div>
                                                        </>
                                                    )}
                                                    <button onClick={() => handleEdit(entry)} className="p-1.5 text-[#403424]/40 hover:text-[#95a77c] transition-colors" title="Edit">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(entry.id)} className="p-1.5 text-[#403424]/40 hover:text-red-500 transition-colors" title="Delete">
                                                        <Trash2 size={14} />
                                                    </button>
                                                    <button onClick={() => setViewingLogsFor(entry.id)} className="p-1.5 text-[#403424]/40 hover:text-blue-500 transition-colors" title="View Logs">
                                                        <History size={14} />
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
                            <h2 className="text-lg font-bold text-[#403424]">
                                {viewingLogsFor === 'ALL' ? 'Global Ledger Audit Logs' : 'Entry Audit History'}
                            </h2>
                            <button onClick={() => setViewingLogsFor(null)} className="p-1 text-[#403424]/40 hover:text-[#403424]">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full">
                                <thead className="bg-[#403424]/5 text-xs uppercase tracking-wider text-[#403424]/60 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Date</th>
                                        <th className="px-4 py-3 text-left">Action</th>
                                        <th className="px-4 py-3 text-left">Performed By</th>
                                        <th className="px-4 py-3 text-left">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#403424]/5">
                                    {(ledgerLogs || []).length === 0 ? (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-400">No logs found.</td></tr>
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
            {showForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-4 border-b border-[#403424]/10">
                            <h2 className="text-lg font-bold text-[#403424]">
                                {editingEntry ? 'Edit Entry' : 'New Entry'}
                            </h2>
                            <button onClick={resetForm} className="p-1 text-[#403424]/40 hover:text-[#403424]">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            {/* Hidden Type Selector - Subtle & Discrete */}
                            <div className="flex justify-end -mb-2 relative z-20">
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setOpenDropdown(openDropdown === 'TYPE_SELECTOR' ? null : 'TYPE_SELECTOR')}
                                        className="text-[10px] font-bold text-[#403424]/40 hover:text-[#403424]/80 uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                                    >
                                        Recording as <span className={`${getTypeColor(formData.entryType)} px-1.5 py-0.5 rounded shadow-sm border border-current/20`}>{formData.entryType}</span>
                                    </button>

                                    {openDropdown === 'TYPE_SELECTOR' && (
                                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-[#403424]/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                            {(['INCOME', 'EXPENSE', 'REIMBURSEMENT'] as LedgerEntryType[]).map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => { setFormData({ ...formData, entryType: type }); setOpenDropdown(null); }}
                                                    className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors flex items-center gap-3 border-b border-[#403424]/5 last:border-0 hover:bg-[#403424]/5 ${formData.entryType === type ? getTypeColor(type) : 'text-[#403424]/60'
                                                        }`}
                                                >
                                                    {getTypeIcon(type)}
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Date & Branch */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-[#403424]/60 uppercase tracking-wide">Date</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#403424]/10 focus:outline-none focus:ring-2 focus:ring-[#95a77c]"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-[#403424]/60 uppercase tracking-wide">Branch</label>
                                    <select
                                        value={formData.branchId}
                                        onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#403424]/10 focus:outline-none focus:ring-2 focus:ring-[#95a77c] bg-[#403424]/5"
                                    >
                                        <option value="">General (No Branch)</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Category & Payment */}
                            <div className="grid grid-cols-2 gap-4">
                                <CustomDropdown
                                    label="Category"
                                    value={formData.categoryId}
                                    options={(appSettings.ledger_categories || []).filter(c => c.isActive || c.id === formData.categoryId)}
                                    placeholder="Select Category"
                                    onSelect={(opt) => setFormData({ ...formData, categoryId: opt.id, category: opt.name })}
                                />

                                <CustomDropdown
                                    label="Payment Method"
                                    value={formData.paymentMethodId}
                                    options={(appSettings.payment_methods || []).filter(m => m.isActive || m.id === formData.paymentMethodId)}
                                    placeholder="Select Method"
                                    onSelect={(opt) => setFormData({ ...formData, paymentMethodId: opt.id, paymentMethod: opt.name })}
                                />
                            </div>

                            {/* Accounts - From/To for Reimbursement */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-[#403424]/60 uppercase tracking-wide">
                                        {formData.entryType === 'REIMBURSEMENT' ? 'From Account' : 'Payment Account'}
                                    </label>
                                    <select
                                        value={formData.sourceAccount}
                                        onChange={(e) => setFormData({ ...formData, sourceAccount: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#403424]/10 focus:outline-none focus:ring-2 focus:ring-[#95a77c] bg-[#403424]/5"
                                    >
                                        {availableAccounts.filter(a => a.isActive).map(acc => (
                                            <option key={acc.id} value={acc.name}>{acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {formData.entryType === 'REIMBURSEMENT' && (
                                    <div>
                                        <label className="text-xs font-medium text-[#403424]/60 uppercase tracking-wide">
                                            To Account (Payee)
                                        </label>
                                        <select
                                            value={formData.destinationAccount}
                                            onChange={(e) => setFormData({ ...formData, destinationAccount: e.target.value })}
                                            className="w-full mt-1 px-3 py-2 rounded-lg border border-[#403424]/10 focus:outline-none focus:ring-2 focus:ring-[#95a77c] bg-[#403424]/5"
                                            required={formData.entryType === 'REIMBURSEMENT'}
                                        >
                                            <option value="">Select Account</option>
                                            {availableAccounts.filter(a => a.isActive && a.name !== formData.sourceAccount).map(acc => (
                                                <option key={acc.id} value={acc.name}>{acc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="text-xs font-medium text-[#403424]/60 uppercase tracking-wide">Amount (₹)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[#403424]/10 focus:outline-none focus:ring-2 focus:ring-[#95a77c] text-lg font-semibold"
                                    required
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-xs font-medium text-[#403424]/60 uppercase tracking-wide">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="What is this entry for?"
                                    rows={2}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[#403424]/10 focus:outline-none focus:ring-2 focus:ring-[#95a77c] resize-none"
                                    required
                                />
                            </div>

                            {/* Bill Photo Upload - Multiple Images */}
                            <div>
                                <label className="block text-xs font-bold text-[#403424]/60 uppercase tracking-wide mb-1.5">
                                    Bill / Receipt Photos
                                </label>
                                <div className="border border-dashed border-[#403424]/20 rounded-lg p-4 bg-[#403424]/5 hover:bg-[#403424]/10 transition-colors text-center cursor-pointer relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={(e) => {
                                            const files: File[] = Array.from(e.target.files || []);
                                            if (files.length > 0) {
                                                setBillFiles(prev => [...prev, ...files]);
                                                setTempBillPreviews(prev => [...prev, ...files.map((f: File) => URL.createObjectURL(f))]);
                                            }
                                        }}
                                    />
                                    {tempBillPreviews.length > 0 ? (
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            {tempBillPreviews.map((preview, idx) => (
                                                <div key={idx} className="relative h-20 w-20">
                                                    <img src={preview} alt={`Preview ${idx + 1}`} className="h-full w-full object-cover rounded" />
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setTempBillPreviews(prev => prev.filter((_, i) => i !== idx));
                                                            setBillFiles(prev => prev.filter((_, i) => i !== idx));
                                                        }}
                                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="h-20 w-20 border-2 border-dashed border-[#403424]/20 rounded flex items-center justify-center text-[#403424]/40">
                                                <Plus size={20} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 py-2">
                                            <UploadCloud size={24} className="text-[#403424]/40" />
                                            <span className="text-sm font-medium text-[#403424]/60">Click to upload or take photos</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 py-2.5 rounded-lg border border-[#403424]/10 text-[#403424]/60 hover:bg-[#403424]/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 rounded-lg bg-[#95a77c] text-white hover:bg-[#7d8f68] transition-colors shadow-md"
                                >
                                    {editingEntry ? 'Update Entry' : 'Add Entry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )
            }
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
        </div >
    );
};

export default Ledger;
