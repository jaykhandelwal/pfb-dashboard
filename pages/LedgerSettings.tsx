import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import {
    Settings, Plus, Trash2, X, Users, User, CreditCard, ToggleLeft, ToggleRight,
    Edit2, Check, ShoppingCart, Home, Truck, Zap, Coffee, Tag, Package, Wallet, Banknote,
    Briefcase, Gift, Heart, Star, Wrench, Info, HelpCircle, Palette, Sticker, ChevronDown, ChevronUp
} from 'lucide-react';
import { LedgerAccount, LedgerCategoryDefinition, LedgerPaymentMethod } from '../types';
import { useAuth } from '../context/AuthContext';
import { ICON_CATEGORIES, ALL_ICONS, IconRenderer } from '../services/iconLibrary';
import {
    getLedgerOptionAllowedUsers,
    hasLedgerOptionUserRestrictions,
    sanitizeLedgerAllowedUserIds
} from '../utils/ledgerAccess';

const LedgerSettings: React.FC = () => {
    const { appSettings, updateAppSetting } = useStore();
    const { users } = useAuth();

    // Local state for edits
    const [categories, setCategories] = useState<LedgerCategoryDefinition[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<LedgerPaymentMethod[]>([]);
    const [accounts, setAccounts] = useState<LedgerAccount[]>([]);

    const [newCategory, setNewCategory] = useState('');
    const [newMethod, setNewMethod] = useState('');
    const [newAccountName, setNewAccountName] = useState('');

    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [editingCategoryColor, setEditingCategoryColor] = useState('');
    const [editingCategoryIcon, setEditingCategoryIcon] = useState('');
    const [editingCategoryAllowedUserIds, setEditingCategoryAllowedUserIds] = useState<string[]>([]);

    const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
    const [editingMethodName, setEditingMethodName] = useState('');
    const [editingMethodColor, setEditingMethodColor] = useState('');
    const [editingMethodIcon, setEditingMethodIcon] = useState('');
    const [editingMethodAllowedUserIds, setEditingMethodAllowedUserIds] = useState<string[]>([]);

    const PRESET_COLORS = [
        '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e',
        '#06b6d4', '#84cc16', '#71717a', '#78350f', '#064e3b', '#4c1d95', '#1e293b'
    ];

    const PRESET_ICONS = ALL_ICONS;

    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    // Initialize from appSettings
    useEffect(() => {
        if (appSettings.ledger_categories) setCategories(appSettings.ledger_categories);
        if (appSettings.payment_methods) setPaymentMethods(appSettings.payment_methods);
        if (appSettings.ledger_accounts) setAccounts(appSettings.ledger_accounts);
    }, [appSettings]);

    // Sync users into accounts state
    useEffect(() => {
        setAccounts(prev => {
            let updated = [...prev];

            // 1. Mark existing USER accounts that no longer have a matching system user as "disconnected"
            updated = updated.map(acc => {
                if (acc.type === 'USER' && acc.linkedUserId) {
                    const stillExists = users.find(u => u.id === acc.linkedUserId);
                    if (!stillExists) {
                        return { ...acc, name: acc.name.includes('(Disconnected)') ? acc.name : `${acc.name} (Disconnected)`, isActive: false };
                    }
                }
                return acc;
            });

            // 2. Add new system users that don't have an account entry yet
            users.forEach(user => {
                const exists = updated.find(a => a.linkedUserId === user.id);
                if (!exists) {
                    updated.push({
                        id: `user_${user.id}`,
                        name: user.name,
                        type: 'USER',
                        linkedUserId: user.id,
                        isActive: true
                    });
                } else if (exists.name !== user.name && !exists.name.includes('(Disconnected)')) {
                    // Update name if it changed in user management
                    exists.name = user.name;
                }
            });
            return updated;
        });
    }, [users]);

    // CATEGORIES
    const handleAddCategory = () => {
        if (!newCategory.trim()) return;
        const id = `cat_${Date.now()}`;
        const normalizedName = newCategory.trim();

        if (categories.find(c => c.name.toLowerCase() === normalizedName.toLowerCase())) {
            alert('Category already exists');
            return;
        }

        const updatedCategories = [...categories, {
            id,
            name: normalizedName,
            isActive: true,
            color: PRESET_COLORS[0],
            icon: 'Package',
            allowedUserIds: null
        }];
        setCategories(updatedCategories);
        updateAppSetting('ledger_categories', updatedCategories);
        setNewCategory('');
    };

    const startEditingCategory = (cat: LedgerCategoryDefinition) => {
        setEditingCategoryId(cat.id);
        setEditingCategoryName(cat.name);
        setEditingCategoryColor(cat.color || PRESET_COLORS[0]);
        setEditingCategoryIcon(cat.icon || PRESET_ICONS[0]);
        setEditingCategoryAllowedUserIds(
            hasLedgerOptionUserRestrictions(cat) ? (cat.allowedUserIds || []) : users.map(user => user.id)
        );
    };

    const saveEditingCategory = () => {
        if (!editingCategoryName.trim()) return;
        const allowedUserIds = sanitizeLedgerAllowedUserIds(editingCategoryAllowedUserIds, users);

        if (!allowedUserIds || allowedUserIds.length === 0) {
            alert('Select at least one user for this category.');
            return;
        }

        const updatedCategories = categories.map(c => c.id === editingCategoryId ? {
            ...c,
            name: editingCategoryName.trim(),
            color: editingCategoryColor,
            icon: editingCategoryIcon,
            allowedUserIds
        } : c);
        setCategories(updatedCategories);
        updateAppSetting('ledger_categories', updatedCategories);
        setEditingCategoryId(null);
    };

    const toggleCategory = (id: string) => {
        const updatedCategories = categories.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c);
        setCategories(updatedCategories);
        updateAppSetting('ledger_categories', updatedCategories);
    };

    const deleteCategory = (id: string) => {
        if (confirm('Are you sure you want to delete this category? This might affect existing records.')) {
            const updatedCategories = categories.filter(c => c.id !== id);
            setCategories(updatedCategories);
            updateAppSetting('ledger_categories', updatedCategories);
        }
    };

    // PAYMENT METHODS
    const handleAddMethod = () => {
        if (!newMethod.trim()) return;
        const id = `method_${Date.now()}`;
        const normalizedName = newMethod.trim();

        if (paymentMethods.find(m => m.name.toLowerCase() === normalizedName.toLowerCase())) {
            alert('Method already exists');
            return;
        }

        const updatedMethods = [...paymentMethods, {
            id,
            name: normalizedName,
            isActive: true,
            color: PRESET_COLORS[1],
            icon: 'CreditCard',
            allowedUserIds: null
        }];
        setPaymentMethods(updatedMethods);
        updateAppSetting('payment_methods', updatedMethods);
        setNewMethod('');
    };

    const startEditingMethod = (method: LedgerPaymentMethod) => {
        setEditingMethodId(method.id);
        setEditingMethodName(method.name);
        setEditingMethodColor(method.color || PRESET_COLORS[1]);
        setEditingMethodIcon(method.icon || PRESET_ICONS[10]);
        setEditingMethodAllowedUserIds(
            hasLedgerOptionUserRestrictions(method) ? (method.allowedUserIds || []) : users.map(user => user.id)
        );
    };

    const saveEditingMethod = () => {
        if (!editingMethodName.trim()) return;
        const allowedUserIds = sanitizeLedgerAllowedUserIds(editingMethodAllowedUserIds, users);

        if (!allowedUserIds || allowedUserIds.length === 0) {
            alert('Select at least one user for this payment method.');
            return;
        }

        const updatedMethods = paymentMethods.map(m => m.id === editingMethodId ? {
            ...m,
            name: editingMethodName.trim(),
            color: editingMethodColor,
            icon: editingMethodIcon,
            allowedUserIds
        } : m);
        setPaymentMethods(updatedMethods);
        updateAppSetting('payment_methods', updatedMethods);
        setEditingMethodId(null);
    };

    const toggleMethod = (id: string) => {
        const updatedMethods = paymentMethods.map(m => m.id === id ? { ...m, isActive: !m.isActive } : m);
        setPaymentMethods(updatedMethods);
        updateAppSetting('payment_methods', updatedMethods);
    };

    const deleteMethod = (id: string) => {
        if (confirm('Delete this payment method?')) {
            const updatedMethods = paymentMethods.filter(m => m.id !== id);
            setPaymentMethods(updatedMethods);
            updateAppSetting('payment_methods', updatedMethods);
        }
    };

    const toggleSelectedCategoryUser = (userId: string) => {
        setEditingCategoryAllowedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const toggleSelectedMethodUser = (userId: string) => {
        setEditingMethodAllowedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const getUserInitials = (name: string) =>
        name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0]?.toUpperCase() || '')
            .join('') || 'U';

    const renderAccessEditor = ({
        accent,
        selectedUserIds,
        onToggleUser
    }: {
        accent: 'indigo' | 'emerald';
        selectedUserIds: string[];
        onToggleUser: (userId: string) => void;
    }) => {
        const accentClasses = accent === 'indigo'
            ? {
                active: 'border-indigo-200 bg-indigo-50 text-indigo-700',
                inactive: 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-700',
                selectedUser: 'border-indigo-200 bg-indigo-50 text-indigo-700',
                userIcon: 'bg-indigo-100 text-indigo-700',
                helper: 'text-indigo-600'
            }
            : {
                active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                inactive: 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-700',
                selectedUser: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                userIcon: 'bg-emerald-100 text-emerald-700',
                helper: 'text-emerald-600'
            };

        return (
            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                    <Users size={12} /> Access
                </div>

                {users.length === 0 ? (
                    <p className="text-xs text-slate-500">No users available yet.</p>
                ) : (
                    <>
                        <p className="text-xs text-slate-500">
                            Everyone starts selected. Click any teammate to remove or restore access for this option.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {users.map(user => {
                                const isSelected = selectedUserIds.includes(user.id);
                                return (
                                    <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => onToggleUser(user.id)}
                                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${isSelected ? accentClasses.selectedUser : accentClasses.inactive}`}
                                    >
                                        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black ${accentClasses.userIcon}`}>
                                            {getUserInitials(user.name)}
                                        </span>
                                        <span className="max-w-[120px] truncate">{user.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className={`text-xs font-medium ${selectedUserIds.length > 0 ? accentClasses.helper : 'text-amber-600'}`}>
                            {selectedUserIds.length > 0
                                ? `${selectedUserIds.length} of ${users.length} users currently have access`
                                : 'Choose at least one user for this option.'}
                        </p>
                    </>
                )}
            </div>
        );
    };

    const getAccessSummary = (option: LedgerCategoryDefinition | LedgerPaymentMethod) => {
        if (!hasLedgerOptionUserRestrictions(option)) {
            return {
                title: 'All users',
                subtitle: users.length > 0 ? `Visible to all ${users.length} users` : 'Visible to everyone by default'
            };
        }

        const allowedUsers = getLedgerOptionAllowedUsers(option, users);
        const preview = allowedUsers.slice(0, 2).map(user => user.name).join(', ');
        const remaining = allowedUsers.length - Math.min(allowedUsers.length, 2);

        return {
            title: `${allowedUsers.length} ${allowedUsers.length === 1 ? 'user' : 'users'}`,
            subtitle: allowedUsers.length === 0
                ? 'No users selected'
                : remaining > 0
                    ? `${preview} +${remaining} more`
                    : preview
        };
    };

    // ACCOUNTS
    const handleAddAccount = () => {
        if (!newAccountName.trim()) return;
        const id = `custom_${Date.now()}`;
        const name = newAccountName.trim();

        if (accounts.find(a => a.name.toLowerCase() === name.toLowerCase())) {
            alert('Account with this name already exists');
            return;
        }

        const newAcc: LedgerAccount = { id, name, type: 'CUSTOM', isActive: true };
        const updatedAccounts = [...accounts, newAcc];
        setAccounts(updatedAccounts);
        updateAppSetting('ledger_accounts', updatedAccounts);
        setNewAccountName('');
    };

    const toggleAccount = (id: string) => {
        const updatedAccounts = accounts.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a);
        setAccounts(updatedAccounts);
        updateAppSetting('ledger_accounts', updatedAccounts);
    };

    const deleteAccount = (id: string) => {
        const acc = accounts.find(a => a.id === id);
        if (acc?.type === 'USER') {
            alert('Cannot delete system user accounts. Disable them instead.');
            return;
        }
        if (confirm(`Delete account "${acc?.name}"?`)) {
            const updatedAccounts = accounts.filter(a => a.id !== id);
            setAccounts(updatedAccounts);
            updateAppSetting('ledger_accounts', updatedAccounts);
        }
    };

    return (
        <div className="pb-16 max-w-6xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="text-slate-600" /> Ledger Settings
                    </h2>
                    <p className="text-slate-500 text-sm md:text-base">Configure categories, payment methods, and accounts.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Categories */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            Expense Categories
                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{categories.length}</span>
                        </h3>
                    </div>
                    <div className="flex gap-2 mb-6">
                        <input
                            type="text"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="Add New Category (e.g. Rent)"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                        />
                        <button
                            onClick={handleAddCategory}
                            className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {categories.map((cat) => (
                            <div key={cat.id} className={`group flex flex-col p-3 rounded-xl border transition-all ${cat.isActive ? 'bg-white border-slate-200 hover:border-indigo-300' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                <div className="flex items-center justify-between w-full">
                                    {editingCategoryId === cat.id ? (
                                        <div className="flex-1 flex flex-col gap-4 mr-4">
                                            <div className="flex gap-2">
                                                <input
                                                    value={editingCategoryName}
                                                    onChange={(e) => setEditingCategoryName(e.target.value)}
                                                    className="flex-1 px-2 py-1 border-b-2 border-indigo-500 focus:outline-none bg-transparent font-bold capitalize"
                                                    autoFocus
                                                />
                                                <button onClick={saveEditingCategory} className="text-emerald-500 hover:bg-emerald-50 p-1 rounded-lg">
                                                    <Check size={18} />
                                                </button>
                                                <button onClick={() => setEditingCategoryId(null)} className="text-slate-400 hover:bg-slate-50 p-1 rounded-lg">
                                                    <X size={18} />
                                                </button>
                                            </div>

                                            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                                                    <Palette size={12} /> Pick Color
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {PRESET_COLORS.map(c => (
                                                        <button
                                                            key={c}
                                                            onClick={() => setEditingCategoryColor(c)}
                                                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${editingCategoryColor === c ? 'border-indigo-600 scale-110' : 'border-transparent'}`}
                                                            style={{ backgroundColor: c }}
                                                        />
                                                    ))}
                                                </div>

                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mt-4">
                                                    <Sticker size={12} /> Pick Icon
                                                </div>
                                                <div className="max-h-60 overflow-y-auto pr-2 space-y-4">
                                                    {Object.entries(ICON_CATEGORIES).map(([catName, icons]) => (
                                                        <div key={catName} className="space-y-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedCategory(expandedCategory === catName ? null : catName)}
                                                                className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-slate-100/50 p-1.5 rounded transition-colors"
                                                            >
                                                                {catName}
                                                                {expandedCategory === catName ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                                            </button>
                                                            {(expandedCategory === catName || !expandedCategory) && (
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {icons.map(icon => (
                                                                        <button
                                                                            key={icon}
                                                                            type="button"
                                                                            onClick={() => setEditingCategoryIcon(icon)}
                                                                            className={`p-2 rounded-lg border-2 transition-all hover:bg-white ${editingCategoryIcon === icon ? 'border-indigo-600 bg-white text-indigo-600 shadow-sm' : 'border-transparent text-slate-400'}`}
                                                                            title={icon}
                                                                        >
                                                                            <IconRenderer name={icon} size={18} />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {renderAccessEditor({
                                                accent: 'indigo',
                                                selectedUserIds: editingCategoryAllowedUserIds,
                                                onToggleUser: toggleSelectedCategoryUser
                                            })}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                                                    style={{ backgroundColor: cat.color || '#6366f1' }}
                                                >
                                                    <IconRenderer name={cat.icon || PRESET_ICONS[0]} size={20} />
                                                </div>
                                                <div className="flex flex-col">
                                                    {(() => {
                                                        const accessSummary = getAccessSummary(cat);
                                                        return (
                                                            <>
                                                                <span className={`font-bold capitalize ${cat.isActive ? 'text-slate-700' : 'text-slate-400'}`}>{cat.name}</span>
                                                                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                                                    <span>Category</span>
                                                                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                                    <span>{accessSummary.title}</span>
                                                                </div>
                                                                <span className="text-xs text-slate-500">{accessSummary.subtitle}</span>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!editingCategoryId && (
                                                    <>
                                                        <button onClick={() => startEditingCategory(cat)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={() => toggleCategory(cat.id)} className={`p-2 rounded-lg transition-all ${cat.isActive ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                                                            {cat.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                                        </button>
                                                        <button onClick={() => deleteCategory(cat.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Payment Methods */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
                        Payment Methods
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{paymentMethods.length}</span>
                    </h3>
                    <div className="flex gap-2 mb-6">
                        <input
                            type="text"
                            value={newMethod}
                            onChange={(e) => setNewMethod(e.target.value)}
                            placeholder="Add Payment Method (e.g. Card)"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddMethod()}
                        />
                        <button
                            onClick={handleAddMethod}
                            className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {paymentMethods.map((method) => (
                            <div key={method.id} className={`group flex flex-col p-3 rounded-xl border transition-all ${method.isActive ? 'bg-white border-slate-200 hover:border-emerald-300' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                <div className="flex items-center justify-between w-full">
                                    {editingMethodId === method.id ? (
                                        <div className="flex-1 flex flex-col gap-4 mr-4">
                                            <div className="flex gap-2">
                                                <input
                                                    value={editingMethodName}
                                                    onChange={(e) => setEditingMethodName(e.target.value)}
                                                    className="flex-1 px-2 py-1 border-b-2 border-emerald-500 focus:outline-none bg-transparent font-bold uppercase"
                                                    autoFocus
                                                />
                                                <button onClick={saveEditingMethod} className="text-emerald-500 hover:bg-emerald-50 p-1 rounded-lg">
                                                    <Check size={18} />
                                                </button>
                                                <button onClick={() => setEditingMethodId(null)} className="text-slate-400 hover:bg-slate-50 p-1 rounded-lg">
                                                    <X size={18} />
                                                </button>
                                            </div>

                                            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                                                    <Palette size={12} /> Pick Color
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {PRESET_COLORS.map(c => (
                                                        <button
                                                            key={c}
                                                            onClick={() => setEditingMethodColor(c)}
                                                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${editingMethodColor === c ? 'border-emerald-600 scale-110' : 'border-transparent'}`}
                                                            style={{ backgroundColor: c }}
                                                        />
                                                    ))}
                                                </div>

                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mt-4">
                                                    <Sticker size={12} /> Pick Icon
                                                </div>
                                                <div className="max-h-60 overflow-y-auto pr-2 space-y-4">
                                                    {Object.entries(ICON_CATEGORIES).map(([catName, icons]) => (
                                                        <div key={catName} className="space-y-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedCategory(expandedCategory === catName ? null : catName)}
                                                                className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-slate-100/50 p-1.5 rounded transition-colors"
                                                            >
                                                                {catName}
                                                                {expandedCategory === catName ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                                            </button>
                                                            {(expandedCategory === catName || !expandedCategory) && (
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {icons.map(icon => (
                                                                        <button
                                                                            key={icon}
                                                                            type="button"
                                                                            onClick={() => setEditingMethodIcon(icon)}
                                                                            className={`p-2 rounded-lg border-2 transition-all hover:bg-white ${editingMethodIcon === icon ? 'border-emerald-600 bg-white text-emerald-600 shadow-sm' : 'border-transparent text-slate-400'}`}
                                                                            title={icon}
                                                                        >
                                                                            <IconRenderer name={icon} size={18} />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {renderAccessEditor({
                                                accent: 'emerald',
                                                selectedUserIds: editingMethodAllowedUserIds,
                                                onToggleUser: toggleSelectedMethodUser
                                            })}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                                                    style={{ backgroundColor: method.color || '#10b981' }}
                                                >
                                                    <IconRenderer name={method.icon || PRESET_ICONS[10]} size={20} />
                                                </div>
                                                <div className="flex flex-col">
                                                    {(() => {
                                                        const accessSummary = getAccessSummary(method);
                                                        return (
                                                            <>
                                                                <span className={`font-bold uppercase ${method.isActive ? 'text-slate-700' : 'text-slate-400'}`}>{method.name}</span>
                                                                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                                                    <span>Payment Method</span>
                                                                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                                    <span>{accessSummary.title}</span>
                                                                </div>
                                                                <span className="text-xs text-slate-500">{accessSummary.subtitle}</span>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!editingMethodId && (
                                                    <>
                                                        <button onClick={() => startEditingMethod(method)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={() => toggleMethod(method.id)} className={`p-2 rounded-lg transition-all ${method.isActive ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                                                            {method.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                                        </button>
                                                        <button onClick={() => deleteMethod(method.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Payment Accounts Section */}
            <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg">
                                <CreditCard className="text-slate-600" size={24} />
                            </div>
                            Payment Accounts
                        </h3>
                        <p className="text-slate-400 text-sm mt-1">Manage staff and custom funding sources.</p>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newAccountName}
                            onChange={(e) => setNewAccountName(e.target.value)}
                            placeholder="Petty Cash / Owner / etc."
                            className="w-full md:w-80 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-800 focus:outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
                        />
                        <button
                            onClick={handleAddAccount}
                            className="bg-slate-800 text-white px-6 py-3 rounded-xl hover:bg-slate-900 transition-all flex items-center gap-2 font-bold shadow-lg shadow-slate-200"
                        >
                            <Plus size={20} />
                            Add Account
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {accounts.sort((a, b) => b.type.localeCompare(a.type)).map((acc) => (
                        <div key={acc.id} className={`p-6 rounded-2xl border transition-all flex flex-col justify-between h-40 group ${acc.isActive ? 'bg-white border-slate-200 shadow-sm hover:shadow-md' : 'bg-slate-50 border-slate-100 grayscale hover:grayscale-0'}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl ${acc.type === 'USER' ? 'bg-blue-50 text-blue-600 shadow-inner' : 'bg-emerald-50 text-emerald-600 shadow-inner'}`}>
                                        {acc.type === 'USER' ? <User size={24} /> : <CreditCard size={24} />}
                                    </div>
                                    <div className="overflow-hidden">
                                        <h4 className="font-black text-lg text-slate-800 truncate leading-tight">{acc.name}</h4>
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 inline-block ${acc.type === 'USER' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {acc.type === 'USER' ? 'Staff' : 'Custom'}
                                        </span>
                                    </div>
                                </div>
                                {acc.type === 'CUSTOM' && (
                                    <button onClick={() => deleteAccount(acc.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center justify-between mt-4">
                                <div className="flex flex-col">
                                    <span className={`text-xs font-black uppercase tracking-widest ${acc.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {acc.isActive ? 'Active' : 'Disabled'}
                                    </span>
                                    <span className="text-[10px] text-slate-400">Status</span>
                                </div>
                                <button
                                    onClick={() => toggleAccount(acc.id)}
                                    className={`transition-all transform hover:scale-110 ${acc.isActive ? 'text-emerald-500' : 'text-slate-300'}`}
                                >
                                    {acc.isActive ? <ToggleRight size={38} /> : <ToggleLeft size={38} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LedgerSettings;
