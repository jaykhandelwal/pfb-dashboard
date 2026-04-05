import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import {
    Settings, Plus, Trash2, X, Users, User, CreditCard, ToggleLeft, ToggleRight,
    Edit2, Check, ShoppingCart, Home, Truck, Zap, Coffee, Tag, Package, Wallet, Banknote,
    Briefcase, Gift, Heart, Star, Wrench, Info, HelpCircle, Palette, Sticker, ChevronDown, ChevronUp
} from 'lucide-react';
import { LedgerAccount, LedgerCategoryDefinition } from '../types';
import { useAuth } from '../context/AuthContext';
import { ICON_CATEGORIES, ALL_ICONS, IconRenderer } from '../services/iconLibrary';
import {
    getLedgerOptionAllowedUsers,
    hasLedgerOptionUserRestrictions,
    sanitizeLedgerAllowedUserIds
} from '../utils/ledgerAccess';
import { LEDGER_COMPANY_ACCOUNT_ID, getLedgerAccounts } from '../utils/ledgerAccounts';

const LedgerSettings: React.FC = () => {
    const { appSettings, updateAppSetting } = useStore();
    const { users } = useAuth();

    // Local state for edits
    const [categories, setCategories] = useState<LedgerCategoryDefinition[]>([]);
    const [accounts, setAccounts] = useState<LedgerAccount[]>([]);

    const [newCategory, setNewCategory] = useState('');
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountPaymentMethod, setNewAccountPaymentMethod] = useState('');

    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [editingCategoryColor, setEditingCategoryColor] = useState('');
    const [editingCategoryIcon, setEditingCategoryIcon] = useState('');
    const [editingCategoryAllowedUserIds, setEditingCategoryAllowedUserIds] = useState<string[]>([]);

    const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
    const [editingAccountName, setEditingAccountName] = useState('');
    const [editingAccountColor, setEditingAccountColor] = useState('');
    const [editingAccountIcon, setEditingAccountIcon] = useState('');
    const [editingAccountAllowedUserIds, setEditingAccountAllowedUserIds] = useState<string[]>([]);
    const [editingAccountPaymentMethod, setEditingAccountPaymentMethod] = useState('');

    const PRESET_COLORS = [
        '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e',
        '#06b6d4', '#84cc16', '#71717a', '#78350f', '#064e3b', '#4c1d95', '#1e293b'
    ];

    const PRESET_ICONS = ALL_ICONS;

    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [expandedEditorPanel, setExpandedEditorPanel] = useState<'category-color' | 'category-icon' | 'account-color' | 'account-icon' | null>(null);

    // Initialize from appSettings
    useEffect(() => {
        if (appSettings.ledger_categories) setCategories(appSettings.ledger_categories);
        setAccounts(getLedgerAccounts(appSettings, users));
    }, [appSettings, users]);

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
        setExpandedEditorPanel(null);
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

    const persistAccounts = async (updatedAccounts: LedgerAccount[]) => {
        setAccounts(updatedAccounts);
        await updateAppSetting('ledger_accounts', updatedAccounts);
    };

    const toggleSelectedCategoryUser = (userId: string) => {
        setEditingCategoryAllowedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const toggleSelectedAccountUser = (userId: string) => {
        setEditingAccountAllowedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const startEditingAccount = (account: LedgerAccount) => {
        setEditingAccountId(account.id);
        setEditingAccountName(account.name);
        setEditingAccountColor(account.color || PRESET_COLORS[1]);
        setEditingAccountIcon(account.icon || PRESET_ICONS[10]);
        setEditingAccountPaymentMethod(account.paymentMethod || '');
        setExpandedEditorPanel(null);
        setEditingAccountAllowedUserIds(
            account.type === 'USER' && account.linkedUserId
                ? [account.linkedUserId]
                : (hasLedgerOptionUserRestrictions(account) ? (account.allowedUserIds || []) : users.map(user => user.id))
        );
    };

    const saveEditingAccount = async () => {
        if (!editingAccountName.trim()) return;

        const accountBeingEdited = accounts.find(account => account.id === editingAccountId);
        if (!accountBeingEdited) return;

        if (accounts.some(account =>
            account.id !== editingAccountId &&
            account.name.toLowerCase() === editingAccountName.trim().toLowerCase()
        )) {
            alert('Account with this name already exists');
            return;
        }

        const allowedUserIds = accountBeingEdited.type === 'USER' && accountBeingEdited.linkedUserId
            ? [accountBeingEdited.linkedUserId]
            : sanitizeLedgerAllowedUserIds(editingAccountAllowedUserIds, users);

        if (accountBeingEdited.type === 'CUSTOM' && (!allowedUserIds || allowedUserIds.length === 0)) {
            alert('Select at least one user for this payment account.');
            return;
        }

        const updatedAccounts = accounts.map(account => account.id === editingAccountId ? {
            ...account,
            name: editingAccountName.trim(),
            color: editingAccountColor,
            icon: editingAccountIcon,
            paymentMethod: editingAccountPaymentMethod.trim() || undefined,
            allowedUserIds,
        } : account);

        await persistAccounts(updatedAccounts);
        setEditingAccountId(null);
    };

    const getUserInitials = (name: string) =>
        name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0]?.toUpperCase() || '')
            .join('') || 'U';

    const getIconCategoryForIcon = (iconName: string) =>
        Object.entries(ICON_CATEGORIES).find(([, icons]) => icons.includes(iconName))?.[0] || Object.keys(ICON_CATEGORIES)[0];

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

    const renderColorPicker = ({
        accent,
        selectedColor,
        panelKey,
        onSelect
    }: {
        accent: 'indigo' | 'emerald';
        selectedColor: string;
        panelKey: 'category-color' | 'account-color';
        onSelect: (color: string) => void;
    }) => {
        const isOpen = expandedEditorPanel === panelKey;
        const accentClasses = accent === 'indigo'
            ? {
                ring: 'focus-visible:ring-indigo-500',
                border: 'border-indigo-200',
                bg: 'bg-indigo-50',
                text: 'text-indigo-700',
                selected: 'border-indigo-600 scale-110'
            }
            : {
                ring: 'focus-visible:ring-emerald-500',
                border: 'border-emerald-200',
                bg: 'bg-emerald-50',
                text: 'text-emerald-700',
                selected: 'border-emerald-600 scale-110'
            };

        return (
            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                    <Palette size={12} /> Color
                </div>
                <button
                    type="button"
                    onClick={() => setExpandedEditorPanel(isOpen ? null : panelKey)}
                    className={`w-full flex items-center justify-between rounded-xl border px-3 py-3 text-left transition-all focus:outline-none focus-visible:ring-2 ${isOpen ? `${accentClasses.border} ${accentClasses.bg}` : 'border-slate-200 bg-white'} ${accentClasses.ring}`}
                >
                    <div className="flex items-center gap-3">
                        <span className="h-9 w-9 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: selectedColor }} />
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-700">Current color</span>
                            <span className="text-xs text-slate-500">{selectedColor}</span>
                        </div>
                    </div>
                    <ChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''} ${isOpen ? accentClasses.text : 'text-slate-400'}`} size={16} />
                </button>
                {isOpen && (
                    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
                        {PRESET_COLORS.map(c => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => onSelect(c)}
                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${selectedColor === c ? accentClasses.selected : 'border-transparent'}`}
                                style={{ backgroundColor: c }}
                                title={c}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderIconPicker = ({
        accent,
        selectedIcon,
        panelKey,
        onSelect
    }: {
        accent: 'indigo' | 'emerald';
        selectedIcon: string;
        panelKey: 'category-icon' | 'account-icon';
        onSelect: (icon: string) => void;
    }) => {
        const isOpen = expandedEditorPanel === panelKey;
        const activeIconCategory = expandedCategory || getIconCategoryForIcon(selectedIcon);
        const accentClasses = accent === 'indigo'
            ? {
                ring: 'focus-visible:ring-indigo-500',
                border: 'border-indigo-200',
                bg: 'bg-indigo-50',
                text: 'text-indigo-700',
                iconSelected: 'border-indigo-600 bg-white text-indigo-600 shadow-sm'
            }
            : {
                ring: 'focus-visible:ring-emerald-500',
                border: 'border-emerald-200',
                bg: 'bg-emerald-50',
                text: 'text-emerald-700',
                iconSelected: 'border-emerald-600 bg-white text-emerald-600 shadow-sm'
            };

        return (
            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                    <Sticker size={12} /> Icon
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setExpandedCategory(getIconCategoryForIcon(selectedIcon));
                        setExpandedEditorPanel(isOpen ? null : panelKey);
                    }}
                    className={`w-full flex items-center justify-between rounded-xl border px-3 py-3 text-left transition-all focus:outline-none focus-visible:ring-2 ${isOpen ? `${accentClasses.border} ${accentClasses.bg}` : 'border-slate-200 bg-white'} ${accentClasses.ring}`}
                >
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700">
                            <IconRenderer name={selectedIcon} size={18} />
                        </span>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-700">Current icon</span>
                            <span className="text-xs text-slate-500">{selectedIcon}</span>
                        </div>
                    </div>
                    <ChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''} ${isOpen ? accentClasses.text : 'text-slate-400'}`} size={16} />
                </button>
                {isOpen && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-4">
                        {Object.entries(ICON_CATEGORIES).map(([catName, icons]) => (
                            <div key={catName} className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setExpandedCategory(expandedCategory === catName ? null : catName)}
                                    className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-slate-100/70 p-2 rounded-lg transition-colors"
                                >
                                    {catName}
                                    {activeIconCategory === catName ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                                {activeIconCategory === catName && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {icons.map(icon => (
                                            <button
                                                key={icon}
                                                type="button"
                                                onClick={() => onSelect(icon)}
                                                className={`p-2 rounded-lg border-2 transition-all hover:bg-slate-50 ${selectedIcon === icon ? accentClasses.iconSelected : 'border-transparent text-slate-400'}`}
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
                )}
            </div>
        );
    };

    const getAccessSummary = (option: LedgerCategoryDefinition | LedgerAccount) => {
        if ('type' in option && option.type === 'USER') {
            const linkedUser = users.find(user => user.id === option.linkedUserId);
            return {
                title: 'Private',
                subtitle: linkedUser
                    ? `Visible only to ${linkedUser.name}`
                    : 'Visible only to the linked user account'
            };
        }

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
    const handleAddAccount = async () => {
        if (!newAccountName.trim()) return;
        const id = `custom_${Date.now()}`;
        const name = newAccountName.trim();

        if (accounts.find(a => a.name.toLowerCase() === name.toLowerCase())) {
            alert('Account with this name already exists');
            return;
        }

        const newAcc: LedgerAccount = {
            id,
            name,
            type: 'CUSTOM',
            isActive: true,
            color: PRESET_COLORS[1],
            icon: 'CreditCard',
            allowedUserIds: null,
            paymentMethod: newAccountPaymentMethod.trim() || undefined,
        };
        const updatedAccounts = [...accounts, newAcc];
        await persistAccounts(updatedAccounts);
        setNewAccountName('');
        setNewAccountPaymentMethod('');
    };

    const toggleAccount = async (id: string) => {
        const updatedAccounts = accounts.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a);
        await persistAccounts(updatedAccounts);
    };

    const deleteAccount = async (id: string) => {
        const acc = accounts.find(a => a.id === id);
        if (acc?.type === 'USER') {
            alert('Cannot delete system user accounts. Disable them instead.');
            return;
        }
        if (confirm(`Delete account "${acc?.name}"?`)) {
            const updatedAccounts = accounts.filter(a => a.id !== id);
            await persistAccounts(updatedAccounts);
        }
    };

    return (
        <div className="pb-16 max-w-6xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="text-slate-600" /> Ledger Settings
                    </h2>
                    <p className="text-slate-500 text-sm md:text-base">Configure categories and payment accounts.</p>
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

                                            {renderAccessEditor({
                                                accent: 'indigo',
                                                selectedUserIds: editingCategoryAllowedUserIds,
                                                onToggleUser: toggleSelectedCategoryUser
                                            })}

                                            {renderColorPicker({
                                                accent: 'indigo',
                                                selectedColor: editingCategoryColor,
                                                panelKey: 'category-color',
                                                onSelect: setEditingCategoryColor
                                            })}

                                            {renderIconPicker({
                                                accent: 'indigo',
                                                selectedIcon: editingCategoryIcon,
                                                panelKey: 'category-icon',
                                                onSelect: setEditingCategoryIcon
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

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
                        Payment Methods Moved
                    </h3>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                        <p className="text-sm text-emerald-900">
                            Payment methods are now configured inside each payment account instead of living in a separate list.
                        </p>
                        <p className="text-xs text-emerald-700">
                            Run the ledger migration once and any old payment-method settings will be folded into accounts. After that, everything is managed from the Payment Accounts section below.
                        </p>
                        <p className="text-xs text-emerald-700">
                            User-linked accounts are always private to that specific user. Custom accounts can be shared with any set of users, just like payment methods used to be.
                        </p>
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
                        <p className="text-slate-400 text-sm mt-1">Manage staff accounts, custom funding sources, visibility, and the payment method each account represents.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr),minmax(0,1.2fr),auto] gap-2 w-full md:w-auto">
                        <input
                            type="text"
                            value={newAccountName}
                            onChange={(e) => setNewAccountName(e.target.value)}
                            placeholder="Petty Cash / Owner / etc."
                            className="w-full md:w-80 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-800 focus:outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
                        />
                        <input
                            type="text"
                            value={newAccountPaymentMethod}
                            onChange={(e) => setNewAccountPaymentMethod(e.target.value)}
                            placeholder="Method on this account (UPI / Cash / Card)"
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-6 text-sm text-slate-600">
                    User-linked accounts are created automatically for every system user. They stay visible only to that specific user, and the admin panel below shows the same rule while still letting admins rename the account and edit its visuals.
                </div>

                <div className="space-y-3">
                    {accounts
                        .slice()
                        .sort((a, b) => {
                            if (a.type !== b.type) return a.type === 'CUSTOM' ? -1 : 1;
                            return a.name.localeCompare(b.name);
                        })
                        .map((acc) => {
                            const accessSummary = getAccessSummary(acc);

                            return (
                                <div key={acc.id} className={`group rounded-2xl border p-4 transition-all ${acc.isActive ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-50 border-slate-100 opacity-70'}`}>
                                    {editingAccountId === acc.id ? (
                                        <div className="space-y-4">
                                            <div className="flex flex-col md:flex-row gap-3">
                                                <input
                                                    value={editingAccountName}
                                                    onChange={(e) => setEditingAccountName(e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-bold"
                                                    autoFocus
                                                />
                                                <input
                                                    value={editingAccountPaymentMethod}
                                                    onChange={(e) => setEditingAccountPaymentMethod(e.target.value)}
                                                    placeholder="Payment method on this account"
                                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                                />
                                                <div className="flex gap-2">
                                                    <button onClick={saveEditingAccount} className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                                                        <Check size={18} />
                                                    </button>
                                                    <button onClick={() => setEditingAccountId(null)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-xl border border-slate-200">
                                                        <X size={18} />
                                                    </button>
                                                </div>
                                            </div>

                                            {acc.type === 'USER' ? (
                                                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                                                    This user account is only visible to <span className="font-bold">{acc.name}</span>. Admins can rename it and update its visuals or payment method, but its visibility stays locked to that user.
                                                </div>
                                            ) : (
                                                renderAccessEditor({
                                                    accent: 'emerald',
                                                    selectedUserIds: editingAccountAllowedUserIds,
                                                    onToggleUser: toggleSelectedAccountUser
                                                })
                                            )}

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                {renderColorPicker({
                                                    accent: 'emerald',
                                                    selectedColor: editingAccountColor,
                                                    panelKey: 'account-color',
                                                    onSelect: setEditingAccountColor
                                                })}

                                                {renderIconPicker({
                                                    accent: 'emerald',
                                                    selectedIcon: editingAccountIcon,
                                                    panelKey: 'account-icon',
                                                    onSelect: setEditingAccountIcon
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                            <div className="flex items-start gap-4 min-w-0">
                                                <div
                                                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
                                                    style={{ backgroundColor: acc.color || (acc.type === 'USER' ? PRESET_COLORS[4] : PRESET_COLORS[1]) }}
                                                >
                                                    <IconRenderer name={acc.icon || (acc.type === 'USER' ? 'User' : 'CreditCard')} size={22} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h4 className="font-black text-lg text-slate-800 truncate">{acc.name}</h4>
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${acc.type === 'USER' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {acc.type === 'USER' ? 'User Account' : 'Custom Account'}
                                                        </span>
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${acc.isActive ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'}`}>
                                                            {acc.isActive ? 'Active' : 'Disabled'}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider font-bold text-slate-400">
                                                        <span>{accessSummary.title}</span>
                                                        {acc.paymentMethod && (
                                                            <>
                                                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                                <span>Method: {acc.paymentMethod}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-slate-500 mt-1">
                                                        {accessSummary.subtitle}
                                                    </p>
                                                    {acc.type === 'USER' && (
                                                        <p className="text-xs text-blue-600 mt-2">
                                                            This account is locked to the linked user and will not appear for other teammates.
                                                        </p>
                                                    )}
                                                    {acc.id === LEDGER_COMPANY_ACCOUNT_ID && (
                                                        <p className="text-xs text-slate-400 mt-2">Default company-level account.</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 md:self-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => startEditingAccount(acc)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => toggleAccount(acc.id)} className={`p-2 rounded-lg transition-all ${acc.isActive ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                                                    {acc.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                                </button>
                                                {acc.type === 'CUSTOM' && acc.id !== LEDGER_COMPANY_ACCOUNT_ID && (
                                                    <button onClick={() => deleteAccount(acc.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>
            </div>
        </div>
    );
};

export default LedgerSettings;
