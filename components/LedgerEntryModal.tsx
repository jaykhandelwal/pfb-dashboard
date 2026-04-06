import React, { useState, useEffect, useMemo } from 'react';
import {
    X, CheckCircle2, ChevronDown, Info, UploadCloud
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { LedgerAccount, LedgerEntry, LedgerEntryType } from '../types';
import { uploadImageToBunny } from '../services/bunnyStorage';
import { IconRenderer } from '../services/iconLibrary';
import { isLedgerOptionAvailableToUser } from '../utils/ledgerAccess';
import { LEDGER_COMPANY_ACCOUNT_NAME, getLedgerAccounts } from '../utils/ledgerAccounts';
import { findLedgerPaymentMethod, getLedgerPaymentMethods, normalizeLedgerPaymentMethod } from '../utils/ledgerPaymentMethods';

interface LedgerEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: LedgerEntry | null;
    forcedType?: LedgerEntryType; // If provided, locks the type
    dialogTitle?: string;
    submitLabel?: string;
    preferredCategoryName?: string;
    lockedSourceAccountId?: string;
    lockedSourceAccountName?: string;
    lockSourceAccount?: boolean;
}

const LedgerEntryModal: React.FC<LedgerEntryModalProps> = ({
    isOpen,
    onClose,
    initialData,
    forcedType,
    dialogTitle,
    submitLabel,
    preferredCategoryName,
    lockedSourceAccountId,
    lockedSourceAccountName,
    lockSourceAccount
}) => {
    const { addLedgerEntry, updateLedgerEntry, updateLedgerEntryStatus, appSettings } = useStore();
    const { currentUser, users } = useAuth();

    const getLocalDateInputValue = () => {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().split('T')[0];
    };

    // Form State
    const [formData, setFormData] = useState({
        date: getLocalDateInputValue(),
        entryType: 'EXPENSE' as LedgerEntryType,
        category: '',
        categoryId: '',
        amount: '',
        description: '',
        sourceAccount: LEDGER_COMPANY_ACCOUNT_NAME,
        sourceAccountId: '',
        destinationAccount: '',
        destinationAccountId: '',
    });

    const [existingBillUrls, setExistingBillUrls] = useState<string[]>([]);
    const [newBillFiles, setNewBillFiles] = useState<File[]>([]);
    const [newBillPreviews, setNewBillPreviews] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const activeCategories = useMemo(
        () => appSettings.ledger_categories?.filter(category => category.isActive) || [],
        [appSettings.ledger_categories]
    );

    const activeAccounts = useMemo(
        () => getLedgerAccounts(appSettings, users).filter(account => account.isActive),
        [appSettings, users]
    );

    const paymentMethods = useMemo(
        () => getLedgerPaymentMethods(appSettings),
        [appSettings]
    );

    const accessibleCategories = useMemo(
        () => activeCategories.filter(category => isLedgerOptionAvailableToUser(category, currentUser?.id)),
        [activeCategories, currentUser?.id]
    );

    const accessibleAccounts = useMemo(
        () => activeAccounts.filter(account => isLedgerOptionAvailableToUser(account, currentUser?.id)),
        [activeAccounts, currentUser?.id]
    );

    const isSourceAccountLocked = Boolean(lockSourceAccount && (lockedSourceAccountId || lockedSourceAccountName));

    const lockedSourceAccount = useMemo(() => {
        if (!isSourceAccountLocked) {
            return undefined;
        }

        const normalizedLockedName = lockedSourceAccountName?.trim().toLowerCase();

        return activeAccounts.find(account =>
            (lockedSourceAccountId && account.id === lockedSourceAccountId)
            || (!!normalizedLockedName && account.name.toLowerCase() === normalizedLockedName)
        );
    }, [activeAccounts, isSourceAccountLocked, lockedSourceAccountId, lockedSourceAccountName]);

    const lockedSourceAccountAccessible = useMemo(() => (
        !isSourceAccountLocked || (!!lockedSourceAccount && isLedgerOptionAvailableToUser(lockedSourceAccount, currentUser?.id))
    ), [currentUser?.id, isSourceAccountLocked, lockedSourceAccount]);

    const categoryOptions = useMemo(() => {
        const selected = activeCategories.find(category =>
            category.id === formData.categoryId || category.name === formData.category
        );

        if (selected && !accessibleCategories.some(category => category.id === selected.id)) {
            return [selected, ...accessibleCategories];
        }

        return accessibleCategories;
    }, [accessibleCategories, activeCategories, formData.category, formData.categoryId]);

    const selectedCategoryHelperText = useMemo(() => {
        const selectedCategory = appSettings.ledger_categories?.find(category =>
            category.id === formData.categoryId || category.name === formData.category
        );

        return selectedCategory?.description?.trim() || '';
    }, [appSettings.ledger_categories, formData.category, formData.categoryId]);

    const shouldShowCategoryField = formData.entryType !== 'INCOME';

    const sourceAccountOptions = useMemo(() => {
        if (isSourceAccountLocked) {
            return lockedSourceAccount ? [lockedSourceAccount] : [];
        }

        const selected = activeAccounts.find(account =>
            account.id === formData.sourceAccountId || account.name === formData.sourceAccount
        );

        if (selected && !accessibleAccounts.some(account => account.id === selected.id)) {
            return [selected, ...accessibleAccounts];
        }

        return accessibleAccounts;
    }, [accessibleAccounts, activeAccounts, formData.sourceAccount, formData.sourceAccountId, isSourceAccountLocked, lockedSourceAccount]);

    const destinationAccountOptions = useMemo(() => {
        const selected = activeAccounts.find(account =>
            account.id === formData.destinationAccountId || account.name === formData.destinationAccount
        );
        const filteredAccessible = accessibleAccounts.filter(account => account.name !== formData.sourceAccount);

        if (selected && !filteredAccessible.some(account => account.id === selected.id)) {
            return [selected, ...filteredAccessible];
        }

        return filteredAccessible;
    }, [accessibleAccounts, activeAccounts, formData.destinationAccount, formData.destinationAccountId, formData.sourceAccount]);

    const accessIssue = useMemo(() => {
        if (isSourceAccountLocked && !lockedSourceAccount) {
            return 'Record Cash is not configured with a valid active payment account. Ask an admin to update Ledger Settings.';
        }

        if (isSourceAccountLocked && !lockedSourceAccountAccessible) {
            return 'The configured Record Cash account is not assigned to your user. Ask an admin to update Ledger Settings.';
        }

        if (shouldShowCategoryField && categoryOptions.length === 0) {
            return 'No ledger categories are assigned to your user yet. Ask an admin to update Ledger Settings.';
        }

        if (sourceAccountOptions.length === 0) {
            return 'No payment accounts are assigned to your user yet. Ask an admin to update Ledger Settings.';
        }

        return null;
    }, [categoryOptions.length, isSourceAccountLocked, lockedSourceAccount, lockedSourceAccountAccessible, shouldShowCategoryField, sourceAccountOptions.length]);

    // Load defaults or initial data
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    date: initialData.date,
                    entryType: initialData.entryType,
                    category: initialData.category,
                    categoryId: initialData.categoryId || '',
                    amount: initialData.amount.toString(),
                    description: initialData.description,
                    sourceAccount: initialData.sourceAccount || LEDGER_COMPANY_ACCOUNT_NAME,
                    sourceAccountId: initialData.sourceAccountId || '',
                    destinationAccount: initialData.destinationAccount || '',
                    destinationAccountId: initialData.destinationAccountId || '',
                });
                setExistingBillUrls(initialData.billUrls || []);
                setNewBillFiles([]);
                setNewBillPreviews([]);
            } else {
                // Set defaults
                const defaultCategory = accessibleCategories.find(category =>
                    preferredCategoryName && category.name.toLowerCase() === preferredCategoryName.toLowerCase()
                ) || accessibleCategories[0];
                const defaultAccount = isSourceAccountLocked ? lockedSourceAccount : sourceAccountOptions[0];

                setFormData({
                    date: getLocalDateInputValue(),
                    entryType: forcedType || 'EXPENSE',
                    category: defaultCategory?.name || '',
                    categoryId: defaultCategory?.id || '',
                    amount: '',
                    description: '',
                    sourceAccount: defaultAccount?.name || LEDGER_COMPANY_ACCOUNT_NAME,
                    sourceAccountId: defaultAccount?.id || '',
                    destinationAccount: '',
                    destinationAccountId: '',
                });
                setExistingBillUrls([]);
                setNewBillFiles([]);
                setNewBillPreviews([]);
            }
        }
    }, [isOpen, initialData, forcedType, currentUser, accessibleCategories, sourceAccountOptions, preferredCategoryName, isSourceAccountLocked, lockedSourceAccount]);

    useEffect(() => {
        if (!isOpen || initialData) return;

        setFormData(prev => {
            const selectedCategoryStillAccessible = accessibleCategories.some(category =>
                category.id === prev.categoryId || category.name === prev.category
            );
            const preferredCategory = accessibleCategories.find(category =>
                preferredCategoryName && category.name.toLowerCase() === preferredCategoryName.toLowerCase()
            ) || accessibleCategories[0];
            const selectedSourceStillAccessible = isSourceAccountLocked
                ? Boolean(lockedSourceAccount && lockedSourceAccountAccessible)
                : accessibleAccounts.some(account =>
                    account.id === prev.sourceAccountId || account.name === prev.sourceAccount
                );
            const nextSourceAccount = isSourceAccountLocked
                ? (lockedSourceAccount?.name || '')
                : (selectedSourceStillAccessible ? prev.sourceAccount : (accessibleAccounts[0]?.name || LEDGER_COMPANY_ACCOUNT_NAME));
            const nextSourceAccountId = isSourceAccountLocked
                ? (lockedSourceAccount?.id || '')
                : (selectedSourceStillAccessible ? prev.sourceAccountId : (accessibleAccounts[0]?.id || ''));

            return {
                ...prev,
                category: selectedCategoryStillAccessible ? prev.category : (preferredCategory?.name || ''),
                categoryId: selectedCategoryStillAccessible ? prev.categoryId : (preferredCategory?.id || ''),
                sourceAccount: nextSourceAccount,
                sourceAccountId: nextSourceAccountId,
                destinationAccount: prev.destinationAccount === nextSourceAccount ? '' : prev.destinationAccount,
                destinationAccountId: prev.destinationAccount === nextSourceAccount ? '' : prev.destinationAccountId,
            };
        });
    }, [isOpen, initialData, accessibleCategories, accessibleAccounts, activeAccounts, preferredCategoryName, isSourceAccountLocked, lockedSourceAccount, lockedSourceAccountAccessible]);

    useEffect(() => {
        if (!isOpen || formData.entryType !== 'INCOME') return;

        const preferredIncomeCategoryName = preferredCategoryName?.trim() || 'Other';
        const preferredIncomeCategory = activeCategories.find(category =>
            category.name.toLowerCase() === preferredIncomeCategoryName.toLowerCase()
        );

        const nextCategory = preferredIncomeCategory?.name || preferredIncomeCategoryName;
        const nextCategoryId = preferredIncomeCategory?.id || '';

        if (formData.category === nextCategory && (formData.categoryId || '') === nextCategoryId) {
            return;
        }

        setFormData(prev => ({
            ...prev,
            category: nextCategory,
            categoryId: nextCategoryId
        }));
    }, [isOpen, formData.entryType, formData.category, formData.categoryId, preferredCategoryName, activeCategories]);

    useEffect(() => {
        if (!isOpen && newBillPreviews.length > 0) {
            newBillPreviews.forEach(url => URL.revokeObjectURL(url));
            setNewBillFiles([]);
            setNewBillPreviews([]);
        }
    }, [isOpen, newBillPreviews]);

    const availableAccounts = activeAccounts;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files) as File[];
            setNewBillFiles(prev => [...prev, ...newFiles]);

            // Create previews
            const newPreviews = newFiles.map(file => URL.createObjectURL(file));
            setNewBillPreviews(prev => [...prev, ...newPreviews]);
        }
    };

    const removeExistingBill = (index: number) => {
        setExistingBillUrls(prev => prev.filter((_, i) => i !== index));
    };

    const removeNewBill = (index: number) => {
        setNewBillFiles(prev => prev.filter((_, i) => i !== index));
        setNewBillPreviews(prev => {
            const previewToRemove = prev[index];
            if (previewToRemove) {
                URL.revokeObjectURL(previewToRemove);
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    const areArraysEqual = (left: string[] = [], right: string[] = []) => (
        left.length === right.length && left.every((value, index) => value === right[index])
    );

    const hasEntryChanged = (original: LedgerEntry, next: LedgerEntry) => {
        return (
            original.date !== next.date ||
            (original.branchId || '') !== (next.branchId || '') ||
            original.entryType !== next.entryType ||
            original.category !== next.category ||
            (original.categoryId || '') !== (next.categoryId || '') ||
            original.amount !== next.amount ||
            original.description !== next.description ||
            (original.sourceAccount || '') !== (next.sourceAccount || '') ||
            (original.sourceAccountId || '') !== (next.sourceAccountId || '') ||
            (original.destinationAccount || '') !== (next.destinationAccount || '') ||
            (original.destinationAccountId || '') !== (next.destinationAccountId || '') ||
            !areArraysEqual(original.billUrls || [], next.billUrls || [])
        );
    };

    const handleSubmit = async (e?: React.FormEvent, statusOverride?: 'APPROVED' | 'REJECTED', rejectionReason?: string) => {
        if (e) e.preventDefault();
        if (!formData.amount || !formData.description || accessIssue) return;

        setIsUploading(true);

        // Upload new files
        let billUrls: string[] = [...existingBillUrls];

        if (newBillFiles.length > 0) {
            const uploadPromises = newBillFiles.map(file => new Promise<string | null>((resolve) => {
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

        const selectedSourceAccount = availableAccounts.find(account =>
            account.id === formData.sourceAccountId || account.name === formData.sourceAccount
        );
        const selectedDestinationAccount = availableAccounts.find(account =>
            account.id === formData.destinationAccountId || account.name === formData.destinationAccount
        );
        const parsedAmount = parseFloat(formData.amount);
        const entryData = {
            date: formData.date,
            timestamp: Date.now(),
            branchId: undefined,
            entryType: formData.entryType,
            category: formData.category,
            categoryId: formData.categoryId,
            amount: parsedAmount,
            description: formData.description.trim(),
            sourceAccount: selectedSourceAccount?.name || formData.sourceAccount || LEDGER_COMPANY_ACCOUNT_NAME,
            sourceAccountId: selectedSourceAccount?.id,
            destinationAccount: formData.entryType === 'REIMBURSEMENT'
                ? (selectedDestinationAccount?.name || formData.destinationAccount)
                : undefined,
            destinationAccountId: formData.entryType === 'REIMBURSEMENT' ? selectedDestinationAccount?.id : undefined,
            createdBy: initialData?.createdBy || currentUser?.id || '',
            createdByName: initialData?.createdByName || currentUser?.name || 'Unknown',
            billUrls,
        };

        try {
            if (initialData) {
                const updatedEntry: LedgerEntry = {
                    ...initialData,
                    ...entryData,
                    id: initialData.id,
                };

                if (hasEntryChanged(initialData, updatedEntry)) {
                    await updateLedgerEntry(updatedEntry);
                }

                if (statusOverride) {
                    await updateLedgerEntryStatus(initialData.id, statusOverride, rejectionReason);
                }
            } else {
                await addLedgerEntry(entryData);
            }

            onClose();
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Unable to save ledger entry.');
        } finally {
            setIsUploading(false);
        }
    };

    const getTypeColor = (type: LedgerEntryType) => {
        switch (type) {
            case 'INCOME': return 'text-emerald-600 bg-emerald-50';
            case 'EXPENSE': return 'text-red-600 bg-red-50';
            case 'REIMBURSEMENT': return 'text-purple-600 bg-purple-50';
        }
    };

    const CustomDropdown = <T extends { id: string, name: string, icon?: string, color?: string, paymentMethod?: string, type?: string }>({
        label,
        value,
        options,
        onSelect,
        placeholder,
        helperText
    }: {
        label: string,
        value: string,
        options: T[],
        onSelect: (option: T) => void,
        placeholder: string,
        helperText?: string
    }) => {
        const selected = options.find(o => o.id === value || o.name === value);
        const defaultColor = label === 'Category' ? '#6366f1' : '#0f766e';
        const defaultIcon = label === 'Category' ? 'Package' : 'Wallet';
        const getSubtitle = (option?: T) => {
            if (!option) return '';
            if (option.paymentMethod) {
                return findLedgerPaymentMethod(paymentMethods, option.paymentMethod)
                    ? `Method: ${option.paymentMethod}`
                    : `Update deleted method: ${option.paymentMethod}`;
            }
            if (option.type === 'USER') return 'User account';
            return label;
        };

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
                            <div className="w-5 h-5 rounded flex items-center justify-center text-white" style={{ backgroundColor: selected.color || defaultColor }}>
                                <IconRenderer name={selected.icon || defaultIcon} size={12} />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="font-bold text-sm text-[#403424]">{selected.name}</span>
                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">{getSubtitle(selected)}</span>
                            </div>
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
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0" style={{ backgroundColor: opt.color || defaultColor }}>
                                        <IconRenderer name={opt.icon || defaultIcon} size={18} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`font-bold text-sm text-[#403424] ${opt.id === value ? 'text-[#95a77c]' : ''}`}>{opt.name}</span>
                                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{getSubtitle(opt)}</span>
                                    </div>
                                    {opt.id === value && <CheckCircle2 size={16} className="ml-auto text-[#95a77c]" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {helperText && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-[#95a77c]/25 bg-[#95a77c]/10 px-3 py-2">
                        <Info size={14} className="mt-0.5 shrink-0 text-[#7e8f68]" />
                        <p className="text-xs font-medium leading-relaxed text-[#5f513f]">
                            {helperText}
                        </p>
                    </div>
                )}
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-[#403424]/10">
                    <h2 className="text-lg font-bold text-[#403424]">
                        {dialogTitle || (initialData ? 'Edit Entry' : 'New Entry')}
                    </h2>
                    <button onClick={onClose} className="p-1 text-[#403424]/40 hover:text-[#403424]">
                        <X size={20} />
                    </button>
                </div>
                <form data-draft-preserve onSubmit={handleSubmit} className="p-4 space-y-4">
                    {accessIssue && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            {accessIssue}
                        </div>
                    )}

                    {/* Hidden Type Selector - Only if not forced */}
                    {!forcedType && (
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
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {forcedType && (
                        <div className="flex justify-end -mb-2">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm border border-current/20 ${getTypeColor(forcedType)}`}>{forcedType}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-[#403424]/60 uppercase tracking-wide">Date</label>
                            <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#403424]/10 focus:outline-none focus:ring-2 focus:ring-[#95a77c] bg-[#403424]/5 font-medium text-sm text-[#403424]"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[#403424]/60 uppercase tracking-wide">Amount (₹)</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="any"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                placeholder="0.00"
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#403424]/10 focus:outline-none focus:ring-2 focus:ring-[#95a77c] bg-[#403424]/5 font-bold text-lg text-[#403424]"
                            />
                        </div>
                    </div>

                    {/* Category Selection */}
                    {shouldShowCategoryField && CustomDropdown({
                        label: "Category",
                        value: formData.categoryId || formData.category,
                        options: categoryOptions,
                        onSelect: (opt) => setFormData({ ...formData, category: opt.name, categoryId: opt.id }),
                        placeholder: "Select Category",
                        helperText: selectedCategoryHelperText
                    })}

                    <div>
                        <label className="text-xs font-medium text-[#403424]/60 uppercase tracking-wide">Description</label>
                        <textarea
                            required
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="What was this for?"
                            rows={2}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-[#403424]/10 focus:outline-none focus:ring-2 focus:ring-[#95a77c] bg-[#403424]/5 text-sm text-[#403424] resize-none"
                        />
                    </div>

                    {isSourceAccountLocked ? (
                        <div>
                            <label className="text-xs font-medium text-[#403424]/60 uppercase tracking-wide">
                                {formData.entryType === 'REIMBURSEMENT' ? 'Paid From' : 'Payment Account'}
                            </label>
                            <div className="mt-1 flex items-center gap-3 rounded-lg border border-[#403424]/10 bg-[#403424]/5 px-3 py-3">
                                <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0"
                                    style={{ backgroundColor: lockedSourceAccount?.color || '#0f766e' }}
                                >
                                    <IconRenderer name={lockedSourceAccount?.icon || 'Wallet'} size={18} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-sm text-[#403424] truncate">
                                        {lockedSourceAccount?.name || lockedSourceAccountName || 'Unavailable Account'}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                        Locked from Ledger Settings
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : CustomDropdown({
                        label: formData.entryType === 'REIMBURSEMENT' ? 'Paid From' : 'Payment Account',
                        value: formData.sourceAccountId || formData.sourceAccount,
                        options: sourceAccountOptions,
                        onSelect: (opt: LedgerAccount) => {
                            setFormData({
                                ...formData,
                                sourceAccount: opt.name,
                                sourceAccountId: opt.id,
                                destinationAccount: formData.destinationAccount === opt.name ? '' : formData.destinationAccount,
                                destinationAccountId: formData.destinationAccount === opt.name ? '' : formData.destinationAccountId,
                            });
                        },
                        placeholder: 'Select Account'
                    })}

                    {(() => {
                        const selectedAccount = isSourceAccountLocked
                            ? lockedSourceAccount
                            : availableAccounts.find(account =>
                                account.id === formData.sourceAccountId || account.name === formData.sourceAccount
                            );
                        const paymentMethod = normalizeLedgerPaymentMethod(selectedAccount?.paymentMethod);

                        if (!paymentMethod) {
                            return null;
                        }

                        const isDeletedPaymentMethod = !findLedgerPaymentMethod(paymentMethods, paymentMethod);

                        return (
                            <div className={`rounded-xl px-3 py-2 text-xs ${isDeletedPaymentMethod ? 'border border-amber-200 bg-amber-50 text-amber-900' : 'border border-teal-100 bg-teal-50 text-teal-800'}`}>
                                {isDeletedPaymentMethod ? (
                                    <>
                                        This account still references deleted payment method <span className="font-bold">{paymentMethod}</span>. Update the account in Ledger Settings.
                                    </>
                                ) : (
                                    <>
                                        This account is tagged with the <span className="font-bold">{paymentMethod}</span> payment method.
                                    </>
                                )}
                            </div>
                        );
                    })()}

                    {/* Destination Account (For Reimbursements) */}
                    {formData.entryType === 'REIMBURSEMENT' && (
                        <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                            <label className="text-xs font-bold text-purple-700 uppercase tracking-wide">Reimbursing To (Beneficiary)</label>
                            <select
                                value={formData.destinationAccountId || formData.destinationAccount}
                                onChange={(e) => {
                                    const selected = destinationAccountOptions.find(account => account.id === e.target.value || account.name === e.target.value);
                                    setFormData({
                                        ...formData,
                                        destinationAccount: selected?.name || e.target.value,
                                        destinationAccountId: selected?.id || '',
                                    });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm font-bold text-purple-900"
                            >
                                <option value="">Select Beneficiary</option>
                                {destinationAccountOptions.map(account => (
                                    <option key={account.id} value={account.id}>{account.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* File Upload */}
                    <div>
                        <label className="text-xs font-medium text-[#403424]/60 uppercase tracking-wide mb-1 block">Attach Bill / Receipt</label>
                        <div className="flex items-center gap-2 overflow-x-auto py-1">
                            <label className="flex items-center justify-center w-16 h-16 rounded-lg border-2 border-dashed border-[#403424]/20 hover:border-[#95a77c] hover:bg-[#95a77c]/5 cursor-pointer flex-shrink-0 transition-colors">
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <UploadCloud size={20} className="text-[#403424]/40" />
                            </label>

                            {existingBillUrls.map((url, index) => (
                                <div key={index} className="relative w-16 h-16 rounded-lg border border-[#403424]/10 group flex-shrink-0">
                                    <img src={url} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                                    <button
                                        type="button"
                                        onClick={() => removeExistingBill(index)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}

                            {newBillPreviews.map((url, index) => (
                                <div key={`${url}-${index}`} className="relative w-16 h-16 rounded-lg border border-[#403424]/10 group flex-shrink-0">
                                    <img src={url} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                                    <button
                                        type="button"
                                        onClick={() => removeNewBill(index)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2">
                        <div className="pt-2 flex flex-col gap-2">
                            {/* Auditor Actions for Pending Entries */}
                            {currentUser?.isLedgerAuditor && initialData && (!initialData.status || initialData.status === 'PENDING') ? (
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={(e) => handleSubmit(e, 'APPROVED')}
                                        disabled={isUploading || !!accessIssue}
                                        className="col-span-2 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:bg-emerald-700 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        Update & Approve
                                        <CheckCircle2 size={18} />
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isUploading || !!accessIssue}
                                        className="py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                    >
                                        Update Only
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const reason = prompt("Enter reason for rejection:");
                                            if (reason) {
                                                // Handle rejection directly via context if possible, or close and let parent handle?
                                                // Since we are in modal, we should probably call context function relative to ID.
                                                // But for consistency let's use the update flow OR just call context.
                                                // context.updateLedgerEntryStatus is available.
                                                // We need to import it first. 
                                                // Actually, let's just close and trigger a rejection? 
                                                // Better: Call simple context function.
                                                // Since I need to import updateLedgerEntryStatus, I will assume it's exposed in useStore. 
                                                // Wait, I need to check useStore destructuring.
                                                // Let's rely on adding updateLedgerEntryStatus to destructuring in next step if missed, 
                                                // OR reuse updateLedgerEntry with rejected status.
                                                // Reusing updateLedgerEntry:
                                                handleSubmit(undefined, 'REJECTED', reason);
                                            }
                                        }}
                                        disabled={isUploading || !!accessIssue}
                                        className="py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 hover:shadow-xl hover:bg-red-700 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        Reject Entry
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={isUploading || !!accessIssue}
                                    className="w-full py-3 bg-[#95a77c] text-white rounded-xl font-bold shadow-lg shadow-[#95a77c]/20 hover:shadow-xl hover:bg-[#7d8f68] transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {isUploading ? (
                                        <span className="animate-pulse">Uploading...</span>
                                    ) : (
                                        <>
                                            {submitLabel || (initialData ? 'Update Entry' : 'Save Entry')}
                                            <CheckCircle2 size={18} />
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LedgerEntryModal;
