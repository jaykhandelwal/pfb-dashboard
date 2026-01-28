
import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, X, TrendingUp, TrendingDown, ArrowRightLeft, Filter, Calendar } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { LedgerEntry, LedgerEntryType, LedgerCategory } from '../types';

const getLocalISOString = (date: Date = new Date()): string => {
    const offset = date.getTimezoneOffset() * 60000;
    const localTime = new Date(date.getTime() - offset);
    return localTime.toISOString().slice(0, 10);
};

const Ledger: React.FC = () => {
    const { branches, ledgerEntries, addLedgerEntry, updateLedgerEntry, deleteLedgerEntry } = useStore();
    const { currentUser } = useAuth();

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
    const [formData, setFormData] = useState({
        date: getLocalISOString(),
        branchId: currentUser?.defaultBranchId || branches[0]?.id || '',
        entryType: 'EXPENSE' as LedgerEntryType,
        category: LedgerCategory.OTHER,
        amount: '',
        description: '',
        paymentMethod: 'CASH' as 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER',
    });

    // Filter state
    const [filterType, setFilterType] = useState<LedgerEntryType | 'ALL'>('ALL');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    // Derived stats
    const stats = useMemo(() => {
        const filtered = ledgerEntries.filter(e => {
            if (filterType !== 'ALL' && e.entryType !== filterType) return false;
            if (filterDateFrom && e.date < filterDateFrom) return false;
            if (filterDateTo && e.date > filterDateTo) return false;
            return true;
        });

        const income = filtered.filter(e => e.entryType === 'INCOME').reduce((s, e) => s + e.amount, 0);
        const expenses = filtered.filter(e => e.entryType === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
        const transfers = filtered.filter(e => e.entryType === 'TRANSFER').reduce((s, e) => s + e.amount, 0);

        return { income, expenses, transfers, net: income - expenses, entries: filtered };
    }, [ledgerEntries, filterType, filterDateFrom, filterDateTo]);

    const resetForm = () => {
        setFormData({
            date: getLocalISOString(),
            branchId: currentUser?.defaultBranchId || branches[0]?.id || '',
            entryType: 'EXPENSE',
            category: LedgerCategory.OTHER,
            amount: '',
            description: '',
            paymentMethod: 'CASH',
        });
        setEditingEntry(null);
        setShowForm(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.amount || !formData.description) return;

        const entryData = {
            date: formData.date,
            timestamp: Date.now(),
            branchId: formData.branchId,
            entryType: formData.entryType,
            category: formData.category,
            amount: parseFloat(formData.amount),
            description: formData.description.trim(),
            paymentMethod: formData.paymentMethod,
            createdBy: currentUser?.id || '',
            createdByName: currentUser?.name || 'Unknown',
        };

        if (editingEntry) {
            await updateLedgerEntry({ ...entryData, id: editingEntry.id });
        } else {
            await addLedgerEntry(entryData);
        }

        resetForm();
    };

    const handleEdit = (entry: LedgerEntry) => {
        setFormData({
            date: entry.date,
            branchId: entry.branchId,
            entryType: entry.entryType,
            category: entry.category,
            amount: entry.amount.toString(),
            description: entry.description,
            paymentMethod: entry.paymentMethod,
        });
        setEditingEntry(entry);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this entry?')) {
            await deleteLedgerEntry(id);
        }
    };

    const getTypeColor = (type: LedgerEntryType) => {
        switch (type) {
            case 'INCOME': return 'text-emerald-600 bg-emerald-50';
            case 'EXPENSE': return 'text-red-600 bg-red-50';
            case 'TRANSFER': return 'text-blue-600 bg-blue-50';
        }
    };

    const getTypeIcon = (type: LedgerEntryType) => {
        switch (type) {
            case 'INCOME': return <TrendingUp size={16} />;
            case 'EXPENSE': return <TrendingDown size={16} />;
            case 'TRANSFER': return <ArrowRightLeft size={16} />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#403424]">Ledger</h1>
                    <p className="text-sm text-[#403424]/60">Track income, expenses, and transfers</p>
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Beta</span>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#95a77c] text-white rounded-lg hover:bg-[#7d8f68] transition-colors shadow-md"
                >
                    <Plus size={18} /> New Entry
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    <div className="flex items-center gap-2 text-blue-600 mb-1">
                        <ArrowRightLeft size={16} /> <span className="text-xs font-medium uppercase">Transfers</span>
                    </div>
                    <p className="text-xl font-bold text-[#403424]">₹{stats.transfers.toLocaleString()}</p>
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
                        <option value="TRANSFER">Transfer</option>
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
                    {(filterType !== 'ALL' || filterDateFrom || filterDateTo) && (
                        <button
                            onClick={() => { setFilterType('ALL'); setFilterDateFrom(''); setFilterDateTo(''); }}
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
                                <th className="px-4 py-3 text-left">Type</th>
                                <th className="px-4 py-3 text-left">Category</th>
                                <th className="px-4 py-3 text-left">Description</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                                <th className="px-4 py-3 text-left">Payment</th>
                                <th className="px-4 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#403424]/5">
                            {stats.entries.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-[#403424]/40">
                                        No ledger entries yet. Click "New Entry" to add one.
                                    </td>
                                </tr>
                            ) : (
                                stats.entries.sort((a, b) => b.timestamp - a.timestamp).map(entry => (
                                    <tr key={entry.id} className="hover:bg-[#403424]/[0.02]">
                                        <td className="px-4 py-3 text-sm">{entry.date}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(entry.entryType)}`}>
                                                {getTypeIcon(entry.entryType)}
                                                {entry.entryType}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{entry.category}</td>
                                        <td className="px-4 py-3 text-sm max-w-xs truncate">{entry.description}</td>
                                        <td className={`px-4 py-3 text-sm font-semibold text-right ${entry.entryType === 'INCOME' ? 'text-emerald-600' : entry.entryType === 'EXPENSE' ? 'text-red-600' : 'text-blue-600'}`}>
                                            {entry.entryType === 'INCOME' ? '+' : entry.entryType === 'EXPENSE' ? '-' : ''}₹{entry.amount.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-[#403424]/60">{entry.paymentMethod.replace('_', ' ')}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleEdit(entry)} className="p-1.5 text-[#403424]/40 hover:text-[#95a77c] transition-colors">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(entry.id)} className="p-1.5 text-[#403424]/40 hover:text-red-500 transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
                            {/* Entry Type */}
                            <div className="flex gap-2">
                                {(['INCOME', 'EXPENSE', 'TRANSFER'] as LedgerEntryType[]).map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, entryType: type })}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${formData.entryType === type
                                                ? getTypeColor(type) + ' ring-2 ring-offset-1 ring-current'
                                                : 'bg-[#403424]/5 text-[#403424]/60 hover:bg-[#403424]/10'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
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
                                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#403424]/10 focus:outline-none focus:ring-2 focus:ring-[#95a77c]"
                                    >
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Category & Payment */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-[#403424]/60 uppercase tracking-wide">Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value as LedgerCategory })}
                                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#403424]/10 focus:outline-none focus:ring-2 focus:ring-[#95a77c]"
                                    >
                                        {Object.values(LedgerCategory).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-[#403424]/60 uppercase tracking-wide">Payment Method</label>
                                    <select
                                        value={formData.paymentMethod}
                                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#403424]/10 focus:outline-none focus:ring-2 focus:ring-[#95a77c]"
                                    >
                                        <option value="CASH">Cash</option>
                                        <option value="UPI">UPI</option>
                                        <option value="CARD">Card</option>
                                        <option value="BANK_TRANSFER">Bank Transfer</option>
                                    </select>
                                </div>
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
            )}
        </div>
    );
};

export default Ledger;
