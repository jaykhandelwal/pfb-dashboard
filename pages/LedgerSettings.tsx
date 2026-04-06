import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../context/StoreContext';
import {
    Settings, Plus, Trash2, X, Users, User, CreditCard, ToggleLeft, ToggleRight,
    Edit2, Check, ShoppingCart, Home, Truck, Zap, Coffee, Tag, Package, Wallet, Banknote, AlertTriangle,
    Briefcase, Gift, Heart, Star, Wrench, Info, HelpCircle, Palette, Sticker, ChevronDown, ChevronUp
} from 'lucide-react';
import { LedgerAccount, LedgerCategoryDefinition, LedgerRecordCashSettings } from '../types';
import { useAuth } from '../context/AuthContext';
import { ICON_CATEGORIES, ALL_ICONS, IconRenderer } from '../services/iconLibrary';
import {
    isLedgerOptionAvailableToUser,
    getLedgerOptionAllowedUsers,
    hasLedgerOptionUserRestrictions,
    sanitizeLedgerAllowedUserIds
} from '../utils/ledgerAccess';
import { LEDGER_COMPANY_ACCOUNT_ID, getLedgerAccounts } from '../utils/ledgerAccounts';
import {
    accountHasDeletedPaymentMethod,
    findLedgerPaymentMethod,
    getLedgerPaymentMethodKey,
    getLedgerPaymentMethods,
    normalizeLedgerPaymentMethod
} from '../utils/ledgerPaymentMethods';
import { findLedgerRecordCashAccount, getLedgerRecordCashSettings } from '../utils/ledgerRecordCash';

const LedgerSettings: React.FC = () => {
    const { appSettings, updateAppSetting } = useStore();
    const { users } = useAuth();

    // Local state for edits
    const [categories, setCategories] = useState<LedgerCategoryDefinition[]>([]);
    const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<string[]>([]);

    const [newCategory, setNewCategory] = useState('');
    const [newCategoryDescription, setNewCategoryDescription] = useState('');
    const [newAccountName, setNewAccountName] = useState('');
    const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
    const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);

    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [editingCategoryDescription, setEditingCategoryDescription] = useState('');
    const [editingCategoryColor, setEditingCategoryColor] = useState('');
    const [editingCategoryIcon, setEditingCategoryIcon] = useState('');
    const [editingCategoryAllowedUserIds, setEditingCategoryAllowedUserIds] = useState<string[]>([]);

    const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
    const [editingAccountName, setEditingAccountName] = useState('');
    const [editingAccountColor, setEditingAccountColor] = useState('');
    const [editingAccountIcon, setEditingAccountIcon] = useState('');
    const [editingAccountAllowedUserIds, setEditingAccountAllowedUserIds] = useState<string[]>([]);
    const [editingAccountPaymentMethod, setEditingAccountPaymentMethod] = useState('');
    const [recordCashAccountId, setRecordCashAccountId] = useState('');
    const [recordCashAllowedUserIds, setRecordCashAllowedUserIds] = useState<string[]>([]);

    const PRESET_COLORS = [
        '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e',
        '#06b6d4', '#84cc16', '#71717a', '#78350f', '#064e3b', '#4c1d95', '#1e293b'
    ];

    const PRESET_ICONS = ALL_ICONS;

    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [expandedEditorPanel, setExpandedEditorPanel] = useState<'category-color' | 'category-icon' | 'account-color' | 'account-icon' | null>(null);
    const [activePaymentMethodMenu, setActivePaymentMethodMenu] = useState<string | null>(null);
    const activePaymentMethodMenuRef = useRef<HTMLDivElement | null>(null);

    // Initialize from appSettings
    useEffect(() => {
        if (appSettings.ledger_categories) setCategories(appSettings.ledger_categories);
        setAccounts(getLedgerAccounts(appSettings, users));
        setPaymentMethods(getLedgerPaymentMethods(appSettings));
        const recordCashSettings = getLedgerRecordCashSettings(appSettings);
        const resolvedRecordCashAccount = findLedgerRecordCashAccount(appSettings, users);
        setRecordCashAccountId(resolvedRecordCashAccount?.id || recordCashSettings.accountId || '');
        setRecordCashAllowedUserIds(
            hasLedgerOptionUserRestrictions(recordCashSettings)
                ? (recordCashSettings.allowedUserIds || [])
                : users.map(user => user.id)
        );
    }, [appSettings, users]);

    useEffect(() => {
        if (!activePaymentMethodMenu) {
            activePaymentMethodMenuRef.current = null;
            return;
        }

        const handlePointerDown = (event: MouseEvent) => {
            if (
                activePaymentMethodMenuRef.current
                && !activePaymentMethodMenuRef.current.contains(event.target as Node)
            ) {
                setActivePaymentMethodMenu(null);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [activePaymentMethodMenu]);

    const closeAddCategoryModal = () => {
        setIsAddCategoryModalOpen(false);
        setNewCategory('');
        setNewCategoryDescription('');
    };

    const closeAddAccountModal = () => {
        setIsAddAccountModalOpen(false);
        setNewAccountName('');
        setActivePaymentMethodMenu(null);
    };

    // CATEGORIES
    const handleAddCategory = () => {
        if (!newCategory.trim()) return false;
        const id = `cat_${Date.now()}`;
        const normalizedName = newCategory.trim();
        const normalizedDescription = newCategoryDescription.trim();

        if (categories.find(c => c.name.toLowerCase() === normalizedName.toLowerCase())) {
            alert('Category already exists');
            return false;
        }

        const updatedCategories = [...categories, {
            id,
            name: normalizedName,
            description: normalizedDescription,
            isActive: true,
            color: PRESET_COLORS[0],
            icon: 'Package',
            allowedUserIds: null
        }];
        setCategories(updatedCategories);
        updateAppSetting('ledger_categories', updatedCategories);
        closeAddCategoryModal();
        return true;
    };

    const startEditingCategory = (cat: LedgerCategoryDefinition) => {
        setEditingCategoryId(cat.id);
        setEditingCategoryName(cat.name);
        setEditingCategoryDescription(cat.description || '');
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

        if (allowedUserIds !== null && allowedUserIds.length === 0) {
            alert('Select at least one user for this category.');
            return;
        }

        const updatedCategories = categories.map(c => c.id === editingCategoryId ? {
            ...c,
            name: editingCategoryName.trim(),
            description: editingCategoryDescription.trim(),
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

    const persistPaymentMethods = async (updatedPaymentMethods: string[]) => {
        setPaymentMethods(updatedPaymentMethods);
        await updateAppSetting('ledger_payment_methods', updatedPaymentMethods);
    };

    const ensurePaymentMethodOption = async (candidate: string) => {
        const normalized = normalizeLedgerPaymentMethod(candidate);

        if (!normalized) {
            return undefined;
        }

        const existing = findLedgerPaymentMethod(paymentMethods, normalized);
        if (existing) {
            return existing;
        }

        const updatedPaymentMethods = [...paymentMethods, normalized];
        await persistPaymentMethods(updatedPaymentMethods);
        return normalized;
    };

    const resolveAccountPaymentMethod = async (nextValue: string, previousValue?: string) => {
        const normalizedNext = normalizeLedgerPaymentMethod(nextValue);

        if (!normalizedNext) {
            return undefined;
        }

        const existing = findLedgerPaymentMethod(paymentMethods, normalizedNext);
        if (existing) {
            return existing;
        }

        if (getLedgerPaymentMethodKey(previousValue) === getLedgerPaymentMethodKey(normalizedNext)) {
            return normalizedNext;
        }

        return ensurePaymentMethodOption(normalizedNext);
    };

    const getDeletedPaymentMethodLabel = (account: Pick<LedgerAccount, 'paymentMethod'>) => {
        const paymentMethod = normalizeLedgerPaymentMethod(account.paymentMethod);

        if (!paymentMethod) {
            return null;
        }

        return findLedgerPaymentMethod(paymentMethods, paymentMethod) ? null : paymentMethod;
    };

    const getPaymentMethodUsageCount = (paymentMethod: string) =>
        accounts.filter(account => getLedgerPaymentMethodKey(account.paymentMethod) === getLedgerPaymentMethodKey(paymentMethod)).length;

    const deletePaymentMethod = async (paymentMethod: string) => {
        const usageCount = getPaymentMethodUsageCount(paymentMethod);
        const usageMessage = usageCount > 0
            ? ` ${usageCount} account${usageCount === 1 ? '' : 's'} still use it and will show an error until updated.`
            : '';

        if (!confirm(`Delete payment method "${paymentMethod}" from the selector?${usageMessage}`)) {
            return false;
        }

        const updatedPaymentMethods = paymentMethods.filter(
            method => getLedgerPaymentMethodKey(method) !== getLedgerPaymentMethodKey(paymentMethod)
        );
        await persistPaymentMethods(updatedPaymentMethods);
        return true;
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

    const toggleSelectedRecordCashUser = (userId: string) => {
        setRecordCashAllowedUserIds(prev =>
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
        setActivePaymentMethodMenu(null);
        setEditingAccountAllowedUserIds(
            account.type === 'USER' && account.linkedUserId
                ? [account.linkedUserId]
                : (hasLedgerOptionUserRestrictions(account) ? (account.allowedUserIds || []) : users.map(user => user.id))
        );
    };

    const saveRecordCashSettings = async () => {
        const allowedUserIds = sanitizeLedgerAllowedUserIds(recordCashAllowedUserIds, users);

        if (allowedUserIds !== null && allowedUserIds.length === 0) {
            alert('Select at least one user for Record Cash.');
            return;
        }

        const selectedAccount = accounts.find(account => account.id === recordCashAccountId);
        if (selectedAccount && !selectedAccount.isActive) {
            alert('Select an active payment account for Record Cash.');
            return;
        }

        const nextSettings: LedgerRecordCashSettings = {
            accountId: selectedAccount?.id || '',
            accountName: selectedAccount?.name || '',
            allowedUserIds,
        };

        await updateAppSetting('ledger_record_cash', nextSettings);
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

        if (accountBeingEdited.type === 'CUSTOM' && allowedUserIds !== null && allowedUserIds.length === 0) {
            alert('Select at least one user for this payment account.');
            return;
        }

        const paymentMethod = await resolveAccountPaymentMethod(
            editingAccountPaymentMethod,
            accountBeingEdited.paymentMethod
        );

        const updatedAccounts = accounts.map(account => account.id === editingAccountId ? {
            ...account,
            name: editingAccountName.trim(),
            color: editingAccountColor,
            icon: editingAccountIcon,
            paymentMethod,
            allowedUserIds,
        } : account);

        await persistAccounts(updatedAccounts);
        setEditingAccountId(null);
        setActivePaymentMethodMenu(null);
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

    const renderPaymentMethodInput = ({
        inputId,
        accent,
        value,
        previousValue,
        onChange,
        placeholder,
        label,
        compact = false,
        className = '',
        onKeyDown
    }: {
        inputId: string;
        accent: 'slate' | 'emerald';
        value: string;
        previousValue?: string;
        onChange: (value: string) => void;
        placeholder: string;
        label?: string;
        compact?: boolean;
        className?: string;
        onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
    }) => {
        const normalizedValue = normalizeLedgerPaymentMethod(value);
        const existingMethod = findLedgerPaymentMethod(paymentMethods, normalizedValue);
        const matchesDeletedPreviousMethod = Boolean(normalizedValue)
            && !existingMethod
            && getLedgerPaymentMethodKey(previousValue) === getLedgerPaymentMethodKey(normalizedValue);
        const isOpen = activePaymentMethodMenu === inputId;
        const filteredPaymentMethods = paymentMethods.filter(method =>
            !normalizedValue || getLedgerPaymentMethodKey(method).includes(getLedgerPaymentMethodKey(normalizedValue))
        );
        const canCreateNewMethod = Boolean(normalizedValue) && !existingMethod;
        const accentClasses = accent === 'emerald'
            ? {
                field: isOpen ? 'border-emerald-200 bg-emerald-50/50 shadow-emerald-100/70' : 'border-slate-200 bg-white',
                ring: 'focus-within:ring-emerald-500',
                toggle: isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                selected: 'border-emerald-200 bg-emerald-50/90 shadow-sm shadow-emerald-100/80',
                badge: 'border-emerald-200 bg-white text-emerald-700',
                icon: 'bg-emerald-600 text-white',
                helper: 'text-emerald-600'
            }
            : {
                field: isOpen ? 'border-slate-300 bg-slate-50/90 shadow-slate-200/90' : 'border-slate-200 bg-white',
                ring: 'focus-within:ring-slate-800',
                toggle: isOpen ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                selected: 'border-slate-300 bg-slate-100/90 shadow-sm shadow-slate-200/80',
                badge: 'border-slate-300 bg-white text-slate-700',
                icon: 'bg-slate-800 text-white',
                helper: 'text-slate-500'
            };

        return (
            <div
                className={`relative flex flex-col gap-2 ${className} ${isOpen ? 'z-30' : ''}`}
                ref={(node) => {
                    if (isOpen) {
                        activePaymentMethodMenuRef.current = node;
                    }
                }}
            >
                {label && <span className="text-xs font-semibold text-slate-500">{label}</span>}
                <div className={`rounded-2xl border shadow-[0_18px_40px_-30px_rgba(15,23,42,0.35)] transition-all focus-within:ring-2 ${accentClasses.field} ${accentClasses.ring}`}>
                    <div className={`flex items-center gap-2 ${compact ? 'px-3 py-2.5' : 'px-4 py-3.5'}`}>
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                            <Tag size={16} />
                        </div>
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => {
                                onChange(e.target.value);
                                setActivePaymentMethodMenu(inputId);
                            }}
                            onFocus={() => setActivePaymentMethodMenu(inputId)}
                            onClick={() => setActivePaymentMethodMenu(inputId)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    setActivePaymentMethodMenu(null);
                                }

                                onKeyDown?.(e);
                            }}
                            placeholder={placeholder}
                            className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                        />
                        {value && (
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => onChange('')}
                                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                aria-label="Clear payment method"
                            >
                                <X size={16} />
                            </button>
                        )}
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setActivePaymentMethodMenu(isOpen ? null : inputId)}
                            className={`rounded-xl p-2 transition-all ${accentClasses.toggle}`}
                            aria-label={isOpen ? 'Close payment method options' : 'Open payment method options'}
                        >
                            <ChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} size={16} />
                        </button>
                    </div>
                </div>
                {isOpen && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-3 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-[0_32px_80px_-32px_rgba(15,23,42,0.45)]">
                        <div className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                                        <Tag size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Saved payment methods</p>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Choose a label from the list, or type a new one and save the account.
                                        </p>
                                    </div>
                                </div>
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                    {paymentMethods.length} saved
                                </span>
                            </div>
                        </div>
                        <div className="max-h-80 space-y-3 overflow-y-auto p-3">
                            {canCreateNewMethod && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange(normalizedValue);
                                        setActivePaymentMethodMenu(null);
                                    }}
                                    className="flex w-full items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-left transition-all hover:border-emerald-300 hover:bg-emerald-100/80"
                                >
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                                        <Plus size={18} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-emerald-900">{normalizedValue}</span>
                                        <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                                            New label, saved when this account is saved
                                        </span>
                                    </span>
                                </button>
                            )}
                            {filteredPaymentMethods.length > 0 ? (
                                filteredPaymentMethods.map(method => {
                                    const usageCount = getPaymentMethodUsageCount(method);
                                    const isSelected = getLedgerPaymentMethodKey(method) === getLedgerPaymentMethodKey(value);

                                    return (
                                        <div
                                            key={method}
                                            className={`flex items-center gap-2 rounded-2xl border p-2 transition-all ${isSelected ? accentClasses.selected : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onChange(method);
                                                    setActivePaymentMethodMenu(null);
                                                }}
                                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                            >
                                                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isSelected ? accentClasses.icon : 'bg-slate-100 text-slate-500'}`}>
                                                    <CreditCard size={18} />
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-semibold text-slate-700">{method}</span>
                                                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                                        <span>{usageCount} account{usageCount === 1 ? '' : 's'}</span>
                                                        {isSelected && (
                                                            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${accentClasses.badge}`}>
                                                                Selected
                                                            </span>
                                                        )}
                                                    </span>
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const deleted = await deletePaymentMethod(method);

                                                    if (
                                                        deleted
                                                        && getLedgerPaymentMethodKey(value) === getLedgerPaymentMethodKey(method)
                                                        && getLedgerPaymentMethodKey(previousValue) !== getLedgerPaymentMethodKey(method)
                                                    ) {
                                                        onChange('');
                                                    }
                                                }}
                                                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600 transition-all hover:border-red-200 hover:bg-red-100"
                                                aria-label={`Delete payment method ${method}`}
                                            >
                                                <Trash2 size={13} />
                                                Delete
                                            </button>
                                        </div>
                                    );
                                })
                            ) : !canCreateNewMethod ? (
                                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                                    {paymentMethods.length > 0
                                        ? 'No saved payment methods match this search.'
                                        : 'No payment methods saved yet. Type a label here and save an account to create the first one.'}
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
                {matchesDeletedPreviousMethod ? (
                    <span className="text-xs font-medium text-amber-700">
                        This deleted payment method will stay invalid until you replace it.
                    </span>
                ) : canCreateNewMethod ? (
                    <span className="text-xs font-medium text-emerald-600">
                        This new payment method will be saved when you submit the account.
                    </span>
                ) : paymentMethods.length > 0 ? (
                    <span className={`text-xs ${accentClasses.helper}`}>
                        Open the menu to pick or delete a saved label, or type a new one.
                    </span>
                ) : (
                    <span className="text-xs text-slate-400">
                        No payment methods saved yet. Type one here to create the first option.
                    </span>
                )}
            </div>
        );
    };

    const getAccessSummary = (option: LedgerCategoryDefinition | LedgerAccount | LedgerRecordCashSettings) => {
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
        if (!newAccountName.trim()) return false;
        const id = `custom_${Date.now()}`;
        const name = newAccountName.trim();

        if (accounts.find(a => a.name.toLowerCase() === name.toLowerCase())) {
            alert('Account with this name already exists');
            return false;
        }

        const newAcc: LedgerAccount = {
            id,
            name,
            type: 'CUSTOM',
            isActive: true,
            color: PRESET_COLORS[1],
            icon: 'CreditCard',
            allowedUserIds: null,
        };
        const updatedAccounts = [...accounts, newAcc];
        await persistAccounts(updatedAccounts);
        closeAddAccountModal();
        return true;
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

    const accountsWithDeletedPaymentMethods = accounts.filter(account =>
        accountHasDeletedPaymentMethod(account, paymentMethods)
    );

    const savedRecordCashSettings = getLedgerRecordCashSettings(appSettings);
    const savedRecordCashAccount = findLedgerRecordCashAccount(appSettings, users);
    const selectableRecordCashAccounts = accounts
        .slice()
        .sort((a, b) => {
            if (a.type !== b.type) return a.type === 'CUSTOM' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    const recordCashSelectedAccount = selectableRecordCashAccounts.find(account => account.id === recordCashAccountId);
    const recordCashAccessOption: LedgerRecordCashSettings = {
        allowedUserIds: recordCashAllowedUserIds.length === users.length ? null : recordCashAllowedUserIds
    };
    const recordCashAccessSummary = getAccessSummary(recordCashAccessOption);
    const recordCashUsersWithButtonAccess = getLedgerOptionAllowedUsers(recordCashAccessOption, users);
    const recordCashUsersMissingAccountAccess = recordCashSelectedAccount
        ? recordCashUsersWithButtonAccess.filter(user => !isLedgerOptionAvailableToUser(recordCashSelectedAccount, user.id))
        : [];
    const hasInvalidSavedRecordCashAccount = Boolean(
        (savedRecordCashSettings.accountId || savedRecordCashSettings.accountName) && !savedRecordCashAccount
    );
    const activeCategoriesCount = categories.filter(category => category.isActive).length;
    const customAccountsCount = accounts.filter(account => account.type === 'CUSTOM').length;

    return (
        <div className="pb-16 max-w-6xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="text-slate-600" /> Ledger Settings
                    </h2>
                    <p className="text-slate-500 text-sm md:text-base">Configure categories, payment accounts, and cash recording.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
            {/* Categories */}
            <div className="min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="mb-6 border-b border-slate-100 pb-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <h3 className="text-xl font-bold text-slate-800 flex flex-wrap items-center gap-2">
                                Expense Categories
                                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{categories.length}</span>
                            </h3>
                            <p className="mt-2 max-w-xl text-sm text-slate-500">
                                Keep the ledger entry flow easy to scan. Add categories only when needed, then tune color, icon, and access from the list.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsAddCategoryModalOpen(true)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 sm:self-start"
                        >
                            <Plus size={18} />
                            Add Category
                        </button>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Cleaner create flow</p>
                            <p className="mt-1 text-sm text-slate-600">
                                New categories open in a modal, and helper text stays tucked away until you actually need to add it.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                {activeCategoriesCount} active
                            </span>
                            <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
                                Helper text supported
                            </span>
                        </div>
                    </div>
                </div>
                <div className="space-y-3 max-h-[560px] overflow-y-auto pr-2 custom-scrollbar">
                    {categories.map((cat) => (
                        <div key={cat.id} className={`group rounded-2xl border p-4 transition-all ${cat.isActive ? 'bg-white border-slate-200 hover:border-indigo-300' : 'bg-slate-50 border-slate-100 opacity-70'}`}>
                            {editingCategoryId === cat.id ? (
                                <div className="space-y-4">
                                        <div className="flex flex-col gap-3 sm:flex-row">
                                            <input
                                                value={editingCategoryName}
                                                onChange={(e) => setEditingCategoryName(e.target.value)}
                                                className="min-w-0 flex-1 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 font-bold capitalize text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                autoFocus
                                            />
                                            <div className="flex shrink-0 items-center gap-2">
                                                <button onClick={saveEditingCategory} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200 text-emerald-500 transition-all hover:bg-emerald-50">
                                                    <Check size={18} />
                                                </button>
                                                <button onClick={() => setEditingCategoryId(null)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-all hover:bg-slate-50">
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        </div>

                                        <label className="flex flex-col gap-2">
                                            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                                                Helper Text
                                            </span>
                                            <textarea
                                                value={editingCategoryDescription}
                                                onChange={(e) => setEditingCategoryDescription(e.target.value)}
                                                placeholder="Explain what transactions belong in this category"
                                                rows={3}
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                            />
                                            <span className="text-xs text-slate-500">
                                                This appears below the category dropdown in the New Entry modal.
                                            </span>
                                        </label>

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
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0 flex items-start gap-3">
                                            <div
                                                className="h-11 w-11 shrink-0 rounded-xl flex items-center justify-center text-white shadow-sm"
                                                style={{ backgroundColor: cat.color || '#6366f1' }}
                                            >
                                                <IconRenderer name={cat.icon || PRESET_ICONS[0]} size={20} />
                                            </div>
                                            <div className="min-w-0 flex flex-col">
                                                {(() => {
                                                    const accessSummary = getAccessSummary(cat);
                                                    return (
                                                        <>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className={`break-words font-bold capitalize ${cat.isActive ? 'text-slate-700' : 'text-slate-400'}`}>{cat.name}</span>
                                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                                                    {accessSummary.title}
                                                                </span>
                                                                {!cat.isActive && (
                                                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                                                        Disabled
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                                                <span>Category</span>
                                                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                                <span>{cat.icon || PRESET_ICONS[0]}</span>
                                                            </div>
                                                            <span className="mt-1 text-xs text-slate-500">{accessSummary.subtitle}</span>
                                                            {cat.description?.trim() && (
                                                                <p className="mt-2 max-w-xl break-words text-sm leading-relaxed text-slate-600">
                                                                    {cat.description.trim()}
                                                                </p>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                        </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1 self-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => startEditingCategory(cat)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => toggleCategory(cat.id)} className={`p-2 rounded-lg transition-all ${cat.isActive ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                                                {cat.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                            </button>
                                            <button onClick={() => deleteCategory(cat.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Payment Accounts Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg">
                                <CreditCard className="text-slate-600" size={24} />
                            </div>
                            Payment Accounts
                        </h3>
                        <p className="text-slate-400 text-sm mt-1">Manage staff accounts, funding sources, visibility, and optional payment-method labels.</p>
                    </div>
                    <div className="w-full md:w-auto">
                        <div className="mb-2">
                            <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Add custom account</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr),auto] gap-2 w-full md:w-auto">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-slate-500">Account name</span>
                                <input
                                    type="text"
                                    aria-label="Account name"
                                    value={newAccountName}
                                    onChange={(e) => setNewAccountName(e.target.value)}
                                    placeholder="Petty Cash / Owner / etc."
                                    className="w-full md:w-80 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-800 focus:outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
                                />
                            </label>
                            <div className="flex items-end">
                                <button
                                    onClick={handleAddAccount}
                                    className="bg-slate-800 text-white px-6 py-3 rounded-xl hover:bg-slate-900 transition-all flex items-center gap-2 font-bold shadow-lg shadow-slate-200"
                                >
                                    <Plus size={20} />
                                    Add Account
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <p className="font-semibold text-slate-700">How it works</p>
                        <span className="self-start rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                            {paymentMethods.length} saved labels
                        </span>
                    </div>
                    <p className="mt-2">
                        User accounts are created automatically and stay private to that user. Custom accounts can be shared. Payment methods are optional labels attached to accounts.
                    </p>
                    <p className="mt-2">
                        Deleting a payment method from the dropdown does not erase it from existing accounts. Those accounts show a warning until an admin edits them and picks a current method.
                    </p>
                </div>

                {accountsWithDeletedPaymentMethods.length > 0 && (
                    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
                                <AlertTriangle size={16} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-amber-900">
                                    {accountsWithDeletedPaymentMethods.length} account{accountsWithDeletedPaymentMethods.length === 1 ? '' : 's'} still reference deleted payment methods.
                                </p>
                                <p className="mt-1 text-xs text-amber-700">
                                    Edit the affected accounts below and choose a current payment method or type a replacement label.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    {accounts
                        .slice()
                        .sort((a, b) => {
                            if (a.type !== b.type) return a.type === 'CUSTOM' ? -1 : 1;
                            return a.name.localeCompare(b.name);
                        })
                        .map((acc) => {
                            const accessSummary = getAccessSummary(acc);
                            const deletedPaymentMethod = getDeletedPaymentMethodLabel(acc);

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
                                                {renderPaymentMethodInput({
                                                    inputId: `account-payment-method-${acc.id}`,
                                                    accent: 'emerald',
                                                    value: editingAccountPaymentMethod,
                                                    previousValue: acc.paymentMethod,
                                                    onChange: setEditingAccountPaymentMethod,
                                                    placeholder: 'Select or type a payment method',
                                                    compact: true,
                                                    className: 'flex-1',
                                                    onKeyDown: (e) => e.key === 'Enter' && saveEditingAccount()
                                                })}
                                                <div className="flex gap-2">
                                                    <button onClick={saveEditingAccount} className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                                                        <Check size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditingAccountId(null);
                                                            setActivePaymentMethodMenu(null);
                                                        }}
                                                        className="text-slate-400 hover:bg-slate-100 p-2 rounded-xl border border-slate-200"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </div>
                                            </div>

                                            {deletedPaymentMethod && getLedgerPaymentMethodKey(editingAccountPaymentMethod) === getLedgerPaymentMethodKey(deletedPaymentMethod) && (
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                                    This account still points to deleted payment method <span className="font-bold">{deletedPaymentMethod}</span>. Pick a current option or type a replacement before you save.
                                                </div>
                                            )}

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
                                                                <span className={deletedPaymentMethod ? 'text-amber-700' : ''}>
                                                                    {deletedPaymentMethod ? `Method deleted: ${deletedPaymentMethod}` : `Method: ${acc.paymentMethod}`}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-slate-500 mt-1">
                                                        {accessSummary.subtitle}
                                                    </p>
                                                    {deletedPaymentMethod && (
                                                        <p className="mt-2 text-xs text-amber-700">
                                                            This account still references deleted payment method <span className="font-bold">{deletedPaymentMethod}</span>. Edit the account to update it.
                                                        </p>
                                                    )}
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

            <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    <div className="max-w-2xl">
                        <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-lg">
                                <Banknote className="text-amber-700" size={24} />
                            </div>
                            Record Cash
                        </h3>
                        <p className="text-slate-400 text-sm mt-1">
                            Configure the sidebar shortcut that records cash sales directly as ledger income.
                        </p>
                    </div>
                    <div className={`self-start rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${recordCashSelectedAccount ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-slate-200 bg-slate-50 text-slate-500'}`}>
                        {recordCashSelectedAccount ? 'Enabled' : 'Hidden'}
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr),minmax(0,1fr)] gap-6">
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                            Entries created from <span className="font-bold">Record Cash</span> are saved as <span className="font-bold">INCOME</span> and posted to the payment account you choose here.
                        </div>

                        <label className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Payment Account</span>
                            <select
                                value={recordCashAccountId}
                                onChange={(e) => setRecordCashAccountId(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                                <option value="">No account selected (hide button)</option>
                                {selectableRecordCashAccounts.map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                        {account.type === 'USER' ? ' • User account' : ' • Custom account'}
                                        {account.isActive ? '' : ' • Disabled'}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                                <span>{recordCashAccessSummary.title}</span>
                                {recordCashSelectedAccount && (
                                    <>
                                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                                        <span>{recordCashSelectedAccount.name}</span>
                                    </>
                                )}
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
                                {recordCashSelectedAccount
                                    ? `The sidebar button will record income to ${recordCashSelectedAccount.name}. ${recordCashAccessSummary.subtitle}.`
                                    : 'Choose a payment account to show the Record Cash button in the sidebar.'}
                            </p>
                        </div>

                        {recordCashSelectedAccount && !recordCashSelectedAccount.isActive && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                The selected payment account is currently disabled. Re-enable it or pick another account before saving.
                            </div>
                        )}

                        {recordCashUsersMissingAccountAccess.length > 0 && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                {recordCashUsersMissingAccountAccess.map(user => user.name).join(', ')} will not see the Record Cash button because the selected payment account is not assigned to them.
                            </div>
                        )}

                        {hasInvalidSavedRecordCashAccount && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                The previously saved Record Cash account no longer exists. Select a new payment account and save to restore the shortcut.
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={saveRecordCashSettings}
                                className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-amber-100 transition-all hover:bg-amber-700"
                            >
                                Save Record Cash Settings
                            </button>
                        </div>
                    </div>

                    {renderAccessEditor({
                        accent: 'emerald',
                        selectedUserIds: recordCashAllowedUserIds,
                        onToggleUser: toggleSelectedRecordCashUser
                    })}
                </div>
            </div>
        </div>
    );
};

export default LedgerSettings;
