
import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, ArrowRightLeft, Package, History, Store, Trash2, Snowflake,
  Users, LogOut, Menu, X, Scale, Receipt, Contact, Award, Utensils,
  ChevronDown, ChevronRight, Settings, TrendingUp, TrendingDown, UserCheck, Tag, Sliders, CheckSquare, Sparkles, Truck, Wifi, BookOpen, Banknote, RefreshCw, CheckCircle2, AlertTriangle, WifiOff
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { LedgerEntryType, Permission } from '../types';
import { UselessDashboard } from './UselessDashboard';
import { APP_VERSION } from '../version';
import LedgerEntryModal from './LedgerEntryModal';
import { canUserAccessLedgerRecordCash, findLedgerRecordCashAccount } from '../utils/ledgerRecordCash';

interface LayoutProps {
  children: React.ReactNode;
}

type NavItem = {
  label: string;
  icon?: React.ReactNode;
  path?: string;
  permission?: Permission;
  children?: NavItem[];
  id?: string; // Unique ID for collapsible sections
  onClick?: () => void;
};

type LayoutToast = {
  variant: 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  durationMs?: number;
};

const LAYOUT_TOAST_STYLES: Record<LayoutToast['variant'], {
  shell: string;
  border: string;
  iconWrap: string;
  iconRing: string;
  iconGlow: string;
  panelGlow: string;
  title: string;
  body: string;
  closeIcon: string;
  closeButton: string;
}> = {
  success: {
    shell: 'bg-gradient-to-br from-emerald-600 via-emerald-600 to-emerald-500',
    border: 'border-emerald-400/35',
    iconWrap: 'bg-white/14 text-white ring-white/20',
    iconRing: 'bg-emerald-200/24',
    iconGlow: 'bg-emerald-100/22',
    panelGlow: 'bg-emerald-100/18',
    title: 'text-white',
    body: 'text-white',
    closeIcon: 'text-white/80',
    closeButton: 'hover:bg-white/10 hover:text-white',
  },
  warning: {
    shell: 'bg-white/95',
    border: 'border-amber-100/90',
    iconWrap: 'bg-amber-50 text-amber-600 ring-amber-100',
    iconRing: 'bg-amber-300/30',
    iconGlow: 'bg-amber-200/35',
    panelGlow: 'bg-amber-200/28',
    title: 'text-slate-900',
    body: 'text-slate-600',
    closeIcon: 'text-slate-400',
    closeButton: 'hover:bg-amber-50 hover:text-amber-700',
  },
  error: {
    shell: 'bg-white/95',
    border: 'border-rose-100/90',
    iconWrap: 'bg-rose-50 text-rose-600 ring-rose-100',
    iconRing: 'bg-rose-300/30',
    iconGlow: 'bg-rose-200/35',
    panelGlow: 'bg-rose-200/28',
    title: 'text-slate-900',
    body: 'text-slate-600',
    closeIcon: 'text-slate-400',
    closeButton: 'hover:bg-rose-50 hover:text-rose-700',
  },
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { currentUser, users, logout, hasPermission } = useAuth();
  const { appSettings, lastUpdated, isLiveConnected, refreshStore } = useStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Easter Egg State
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const dashboardClickRef = useRef<number>(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync Status State
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ledgerModal, setLedgerModal] = useState<{ isOpen: boolean; type?: LedgerEntryType; mode?: 'STANDARD' | 'RECORD_CASH' }>({ isOpen: false });
  const [layoutToast, setLayoutToast] = useState<LayoutToast | null>(null);

  // Track expanded state of dropdowns - Default collapsed
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const showNotificationTester = import.meta.env.DEV
    || (typeof window !== 'undefined'
      && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Live Sync Timer Logic
  useEffect(() => {
    const updateSyncStatus = () => {
      const now = Date.now();
      const diffSeconds = Math.floor((now - lastUpdated) / 1000);

      if (diffSeconds < 2) {
        setSyncStatus('Synced just now');
      } else if (diffSeconds < 60) {
        setSyncStatus(`Synced ${diffSeconds}s ago`);
      } else if (diffSeconds < 3600) {
        setSyncStatus(`Synced ${Math.floor(diffSeconds / 60)}m ago`);
      } else {
        setSyncStatus(`Last sync: ${new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      }
    };

    // Update immediately and then every second
    updateSyncStatus();
    const timer = setInterval(updateSyncStatus, 1000);

    return () => clearInterval(timer);
  }, [lastUpdated]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshStore();
    } finally {
      setIsRefreshing(false);
    }
  };

  // If no user (e.g. login page), render simple layout
  if (!currentUser) {
    return <main className="bg-[#eff2e7] min-h-screen">{children}</main>;
  }

  const recordCashAccount = findLedgerRecordCashAccount(appSettings, users);
  const canRecordCash = canUserAccessLedgerRecordCash(appSettings, users, currentUser.id);

  const navStructure: NavItem[] = [
    { id: 'add-expense', label: 'Add Expense', icon: <TrendingDown size={20} />, onClick: () => setLedgerModal({ isOpen: true, type: 'EXPENSE', mode: 'STANDARD' }) },
    { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, permission: 'VIEW_DASHBOARD' },
    { path: '/operations', label: 'Operations', icon: <ArrowRightLeft size={20} />, permission: 'MANAGE_OPERATIONS' },
    { path: '/attendance', label: 'Attendance', icon: <UserCheck size={20} />, permission: 'MANAGE_ATTENDANCE' },
  ];

  if (canRecordCash && recordCashAccount) {
    navStructure.splice(1, 0, {
      id: 'record-cash',
      label: 'Record Cash',
      icon: <Banknote size={20} />,
      onClick: () => setLedgerModal({ isOpen: true, type: 'INCOME', mode: 'RECORD_CASH' })
    });
  }

  // Conditionally add Tasks based on Beta Flag
  if (appSettings.enable_beta_tasks) {
    navStructure.push({ path: '/tasks', label: 'Tasks', icon: <CheckSquare size={20} />, permission: 'MANAGE_TASKS' });
  }

  // Conditionally add Ledger based on Beta Flag and Admin Role
  if (appSettings.enable_beta_ledger && currentUser?.role === 'ADMIN') {
    navStructure.push({ path: '/ledger', label: 'Ledger', icon: <BookOpen size={20} />, permission: 'MANAGE_LEDGER' });
  }

  navStructure.push(
    { path: '/stock-ordering', label: 'Stock Ordering', icon: <Truck size={20} />, permission: 'MANAGE_INVENTORY' },
    { path: '/wastage', label: 'Wastage', icon: <Trash2 size={20} />, permission: 'MANAGE_WASTAGE' },
    { path: '/inventory', label: 'Deep Freezer', icon: <Snowflake size={20} />, permission: 'MANAGE_INVENTORY' },
    { path: '/reconciliation', label: 'Reconciliation', icon: <Scale size={20} />, permission: 'MANAGE_RECONCILIATION' }
  );

  // Sales Group
  navStructure.push({
    id: 'sales',
    label: 'Sales',
    icon: <TrendingUp size={20} />,
    children: [
      { path: '/orders', label: 'Orders & Sales', icon: <Receipt size={18} />, permission: 'VIEW_ORDERS' },
      { path: '/customers', label: 'Customers', icon: <Contact size={18} />, permission: 'MANAGE_CUSTOMERS' },
      { path: '/membership', label: 'Membership Plan', icon: <Award size={18} />, permission: 'MANAGE_MEMBERSHIP' },
    ]
  });

  // Manage Group
  navStructure.push({
    id: 'manage',
    label: 'Manage',
    icon: <Settings size={20} />,
    children: [
      { path: '/menu', label: 'Menu & Pricing', icon: <Utensils size={18} />, permission: 'MANAGE_MENU' },
      { path: '/menu-categories', label: 'Menu Categories', icon: <Tag size={18} />, permission: 'MANAGE_MENU' },
      { path: '/ledger-settings', label: 'Ledger Settings', icon: <BookOpen size={18} />, permission: 'MANAGE_LEDGER' },
      { path: '/skus', label: 'Raw SKUs', icon: <Package size={18} />, permission: 'MANAGE_SKUS' },
      { path: '/branches', label: 'Branches', icon: <Store size={18} />, permission: 'MANAGE_BRANCHES' },
      { path: '/users', label: 'User Management', icon: <Users size={18} />, permission: 'MANAGE_USERS' },
      { path: '/settings', label: 'Settings', icon: <Sliders size={18} />, permission: 'MANAGE_SETTINGS' },
    ]
  });

  navStructure.push({ path: '/logs', label: 'Transaction Logs', icon: <History size={20} />, permission: 'VIEW_LOGS' });

  // Helper to filter nav items based on permission
  const getFilteredNav = (items: NavItem[]): NavItem[] => {
    return items.reduce((acc: NavItem[], item) => {
      if (item.children) {
        const filteredChildren = getFilteredNav(item.children);
        if (filteredChildren.length > 0) {
          acc.push({ ...item, children: filteredChildren });
        }
      } else if (item.permission) {
        if (hasPermission(item.permission)) {
          acc.push(item);
        }
      } else {
        // No permission required (unlikely in this app, but good for safety)
        acc.push(item);
      }
      return acc;
    }, []);
  };

  const visibleNav = getFilteredNav(navStructure);

  const handleMobileNavClick = () => {
    setIsMobileMenuOpen(false);
  };

  const showLayoutToast = ({ durationMs = 4000, ...toast }: LayoutToast) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setLayoutToast({ ...toast, durationMs });
    toastTimeoutRef.current = setTimeout(() => {
      setLayoutToast(null);
      toastTimeoutRef.current = null;
    }, durationMs);
  };

  const handleNotificationTest = () => {
    showLayoutToast({
      variant: 'success',
      title: 'Expense Added',
      message: 'Rs 23 expense saved under Utilities from Company Account.',
      durationMs: 5000,
    });
  };

  const handleDashboardClick = (e: React.MouseEvent) => {
    // Only admins get the easter egg
    if (currentUser?.role !== 'ADMIN') return;

    // Increment click counter
    dashboardClickRef.current += 1;

    // Clear existing timeout
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);

    // Set timeout to reset counter if clicks stop
    clickTimeoutRef.current = setTimeout(() => {
      dashboardClickRef.current = 0;
    }, 500); // 500ms window for double click

    if (dashboardClickRef.current >= 2) {
      setShowEasterEgg(true);
      dashboardClickRef.current = 0; // Reset
    }
  };

  // Render a single nav item (recursive for children)
  const renderNavItem = (item: NavItem, depth = 0) => {
    // If it's a Group (Parent)
    if (item.children && item.id) {
      const isExpanded = expandedSections[item.id];
      const isActiveParent = item.children.some(child => child.path === location.pathname);

      return (
        <div key={item.id} className="mb-1">
          <button
            onClick={() => toggleSection(item.id!)}
            className={`w-full flex items-center justify-between px-4 h-12 rounded-lg transition-colors font-medium text-base ${isActiveParent ? 'text-[#403424] bg-[#403424]/5' : 'text-[#403424] hover:bg-[#403424]/5'
              }`}
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span>{item.label}</span>
            </div>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {/* Children Container */}
          <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col space-y-1 ml-4 border-l border-[#403424]/10 pl-2">
              {item.children.map(child => renderNavItem(child, depth + 1))}
            </div>
          </div>
        </div>
      );
    }

    // If it's an action button (Leaf)
    if (item.onClick) {
      const isRecordCashAction = item.id === 'record-cash';
      return (
        <button
          key={item.id || item.label}
          type="button"
          onClick={() => {
            item.onClick?.();
            handleMobileNavClick();
          }}
          className={`flex items-center space-x-3 px-4 h-12 w-full rounded-lg transition-colors font-medium text-base shadow-sm ${
            isRecordCashAction
              ? 'text-white bg-emerald-600 border border-emerald-600 hover:bg-emerald-700'
              : 'text-[#eef1e6] bg-[#403424] border border-[#403424] hover:bg-[#4b3d2c]'
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      );
    }

    // If it's a Link (Leaf)
    const isActive = location.pathname === item.path;
    const isDashboard = item.path === '/dashboard';

    return (
      <Link
        key={item.path}
        to={item.path!}
        onClick={(e) => {
          handleMobileNavClick();
          if (isDashboard) handleDashboardClick(e);
        }}
        className={`flex items-center space-x-3 px-4 h-12 rounded-lg transition-colors font-medium text-base ${isActive
          ? 'bg-[#95a77c] text-white shadow-md'
          : 'text-[#403424] hover:bg-[#403424]/5'
          }`}
      >
        {item.icon}
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-[#f9faf7] text-[#403424] font-sans overflow-hidden">
      {/* Easter Egg Overlay */}
      {showEasterEgg && <UselessDashboard onClose={() => setShowEasterEgg(false)} />}

      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-[#eff2e7] text-[#403424] flex-shrink-0 hidden md:flex flex-col shadow-xl z-20 border-r border-[#403424]/5">
        <div className="p-6 border-b border-[#403424]/10 flex flex-col items-center">
          <img src="https://pakaja.b-cdn.net/assets/logo.png" alt="Pakaja" className="h-16 w-auto object-contain mb-2" />
          <p className="text-xs text-[#403424] tracking-widest uppercase mt-1">Pakaja Operations</p>
        </div>

        <div className="px-6 py-4 flex items-center gap-3 border-b border-[#403424]/10">
          <div className="w-10 h-10 rounded-full bg-[#403424]/5 flex items-center justify-center font-bold text-[#95a77c] border border-[#403424]/10">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold truncate">{currentUser.name}</p>
            <p className="text-[10px] text-[#403424] uppercase tracking-wide">{currentUser.role}</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#403424]/10">
          {visibleNav.map(item => renderNavItem(item))}
        </nav>

        <div className="p-4 border-t border-[#403424]/10">
          <button
            onClick={logout}
            className="flex items-center space-x-3 px-4 h-12 w-full text-[#403424] hover:text-red-600 hover:bg-[#403424]/5 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>

          {/* Live Status Indicator */}
          <div className={`mt-4 flex justify-center items-center gap-2 text-[10px] font-mono tracking-tighter transition-colors ${isLiveConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
            <Wifi size={10} className={`${isLiveConnected ? 'text-emerald-500' : 'text-amber-500'}`} />
            {isLiveConnected ? 'Live' : 'Offline'} • {syncStatus}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh data"
              className={`inline-flex items-center gap-1 rounded-full border border-current/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] transition-colors ${isRefreshing ? 'cursor-wait opacity-70' : 'hover:bg-current/10'}`}
            >
              <RefreshCw size={9} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          <div className="flex justify-center items-center mt-0.5 opacity-40 text-[9px] font-mono tracking-tight cursor-default select-none">
            v{APP_VERSION}
          </div>
        </div>
      </aside>

      {/* Mobile Header & Menu Container */}
      <div className="md:hidden fixed top-0 w-full z-50">
        {/* Header Bar */}
        <div className="bg-[#eff2e7] text-[#403424] px-4 h-16 flex justify-between items-center shadow-md relative z-50 border-b border-[#403424]/5">
          <div className="flex items-center gap-2">
            <img src="https://pakaja.b-cdn.net/assets/logo.png" alt="Pakaja" className="h-8 w-auto object-contain" />
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-[#403424] hover:text-[#403424]/70 transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="absolute top-16 left-0 w-full bg-[#eff2e7] shadow-2xl border-t border-[#403424]/10 flex flex-col max-h-[85vh] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
            {/* User Info (Mobile) */}
            <div className="p-4 bg-[#403424]/5 border-b border-[#403424]/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#403424]/10 flex items-center justify-center font-bold text-[#95a77c] border border-[#403424]/10">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-[#403424]">{currentUser.name}</p>
                <p className="text-[10px] text-[#403424] uppercase tracking-wide">{currentUser.role}</p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col p-2 space-y-1">
              {visibleNav.map(item => renderNavItem(item))}
            </nav>

            {/* Logout (Mobile) */}
            <div className="p-4 border-t border-[#403424]/10 mt-2 pb-6">
              <button
                onClick={() => {
                  handleMobileNavClick();
                  logout();
                }}
                className="flex items-center justify-center space-x-2 px-4 py-3 w-full text-red-600 bg-[#403424]/5 hover:bg-[#403424]/10 rounded-lg transition-colors font-medium border border-[#403424]/10"
              >
                <LogOut size={20} />
                <span>Sign Out</span>
              </button>
              <div className={`mt-4 flex justify-center items-center gap-2 text-[10px] font-mono transition-colors ${isLiveConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
                <Wifi size={10} className={`${isLiveConnected ? 'text-emerald-500' : 'text-amber-500'}`} />
                {isLiveConnected ? 'Live' : 'Offline'} • {syncStatus}
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  aria-label="Refresh data"
                  className={`inline-flex items-center gap-1 rounded-full border border-current/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] transition-colors ${isRefreshing ? 'cursor-wait opacity-70' : 'hover:bg-current/10'}`}
                >
                  <RefreshCw size={9} className={isRefreshing ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
              <div className="flex justify-center items-center mt-1 opacity-40 text-[8px] font-mono tracking-widest uppercase">
                Version {APP_VERSION}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <LedgerEntryModal
        isOpen={ledgerModal.isOpen}
        onClose={() => setLedgerModal(prev => ({ ...prev, isOpen: false }))}
        forcedType={ledgerModal.type}
        submissionContext={ledgerModal.mode}
        dialogTitle={ledgerModal.mode === 'RECORD_CASH' ? 'Record Cash' : undefined}
        submitLabel={ledgerModal.mode === 'RECORD_CASH' ? 'Record Cash' : undefined}
        preferredCategoryName={ledgerModal.mode === 'RECORD_CASH' ? 'Other' : undefined}
        lockedSourceAccountId={ledgerModal.mode === 'RECORD_CASH' ? recordCashAccount?.id : undefined}
        lockedSourceAccountName={ledgerModal.mode === 'RECORD_CASH' ? recordCashAccount?.name : undefined}
        lockSourceAccount={ledgerModal.mode === 'RECORD_CASH'}
        manualSelectionUntilSingleOption={ledgerModal.mode === 'STANDARD' && ledgerModal.type === 'EXPENSE'}
        useBusinessDayDefaultDate={ledgerModal.mode === 'RECORD_CASH'}
        showToast={showLayoutToast}
      />

      {layoutToast && (() => {
        const tone = LAYOUT_TOAST_STYLES[layoutToast.variant];
        const showSuccessWash = layoutToast.variant === 'success';

        return (
          <>
            {showSuccessWash && (
              <div className="pointer-events-none fixed inset-0 z-[140] overflow-hidden" aria-hidden="true">
                <div
                  className="panel-toast-overlay absolute inset-0"
                  style={{
                    background: 'radial-gradient(76rem 34rem at calc(100% - 10rem) 7.25rem, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.13) 20%, rgba(16, 185, 129, 0.07) 36%, rgba(16, 185, 129, 0.028) 54%, rgba(16, 185, 129, 0.01) 66%, transparent 78%), linear-gradient(180deg, rgba(16, 185, 129, 0.035) 0%, rgba(16, 185, 129, 0.012) 18%, transparent 36%)',
                  }}
                />
                <div
                  className="panel-toast-overlay-orb absolute -right-16 top-5 h-[22rem] w-[30rem] blur-3xl"
                  style={{
                    background: 'radial-gradient(circle, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.08) 28%, transparent 68%)',
                  }}
                />
              </div>
            )}

            <div className="pointer-events-none fixed left-4 right-4 top-20 z-[150] md:left-auto md:right-6 md:w-[25rem]">
              <div
                className={`panel-toast-enter pointer-events-auto relative isolate overflow-hidden rounded-[20px] border px-5 py-4 shadow-[0_20px_50px_rgba(15,23,42,0.16)] backdrop-blur-xl ${tone.shell} ${tone.border}`}
              >
                <div className={`panel-toast-glow absolute -left-6 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full blur-3xl ${tone.panelGlow}`} />
                <div className="panel-toast-glint absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                <div className={`absolute inset-0 ${layoutToast.variant === 'success'
                  ? 'bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_36%)]'
                  : 'bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,255,255,0.6)_42%,rgba(255,255,255,0.14))]'
                }`} />

                <div className="relative flex items-start gap-3">
                  <div className="relative flex h-11 w-11 shrink-0 self-center items-center justify-center">
                    <span className={`panel-toast-icon-ring absolute inset-0 rounded-2xl ${tone.iconRing}`} />
                    <span className={`absolute inset-1 rounded-2xl blur-xl ${tone.iconGlow}`} />
                    <div className={`relative flex h-11 w-11 items-center justify-center rounded-2xl ring-1 shadow-[0_10px_25px_rgba(15,23,42,0.06)] ${tone.iconWrap}`}>
                      {layoutToast.variant === 'success' && <CheckCircle2 size={18} />}
                      {layoutToast.variant === 'warning' && <WifiOff size={18} />}
                      {layoutToast.variant === 'error' && <AlertTriangle size={18} />}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    {layoutToast.title && <p className={`text-[15px] font-semibold tracking-[-0.01em] ${tone.title}`}>{layoutToast.title}</p>}
                    <p className={layoutToast.title ? `mt-1 text-[15px] leading-6 ${tone.body}` : 'text-[15px] font-medium text-slate-800'}>
                      {layoutToast.message}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (toastTimeoutRef.current) {
                        clearTimeout(toastTimeoutRef.current);
                        toastTimeoutRef.current = null;
                      }
                      setLayoutToast(null);
                    }}
                    className={`rounded-lg p-1.5 transition-colors ${tone.closeIcon} ${tone.closeButton}`}
                    aria-label="Dismiss toast"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {showNotificationTester && (
        <button
          type="button"
          onClick={handleNotificationTest}
          className="fixed bottom-4 right-4 z-[130] inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/95 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-[0_16px_40px_rgba(15,23,42,0.14)] backdrop-blur transition-transform hover:-translate-y-0.5 hover:bg-emerald-50"
        >
          <Sparkles size={16} />
          Test Toast
        </button>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full bg-[#f9faf7] relative z-0">
        <div className="max-w-7xl mx-auto p-4 md:p-8 mt-16 md:mt-0">
          {children}
        </div>
      </main>
    </div >
  );
};

export default Layout;
