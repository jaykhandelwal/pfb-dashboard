
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Transaction, SKU, Branch, SalesRecord, Order, DailyReportItem, 
  Todo, AppSettings, MenuItem, MenuCategory, Customer, MembershipRule, 
  RewardResult, AttendanceRecord, AttendanceOverride, TaskTemplate,
  TransactionType, SalesPlatform, AttendanceOverrideType, ArchivedTransaction, CustomerCoupon
} from '../types';
import { 
  INITIAL_BRANCHES, INITIAL_SKUS, INITIAL_MENU_CATEGORIES, 
  INITIAL_MENU_ITEMS, INITIAL_MEMBERSHIP_RULES, INITIAL_CUSTOMERS 
} from '../constants';

interface StoreContextType {
  transactions: Transaction[];
  salesRecords: SalesRecord[];
  skus: SKU[];
  branches: Branch[];
  orders: Order[];
  todos: Todo[];
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  customers: Customer[];
  membershipRules: MembershipRule[];
  customerCoupons: CustomerCoupon[]; // New
  attendanceRecords: AttendanceRecord[];
  attendanceOverrides: AttendanceOverride[];
  deletedTransactions: ArchivedTransaction[];
  taskTemplates: TaskTemplate[];
  appSettings: AppSettings;
  isLoading: boolean;

  // Transactions
  addBatchTransactions: (txs: Omit<Transaction, 'id' | 'timestamp' | 'batchId'>[]) => Promise<void>;
  deleteTransactionBatch: (batchId: string, deletedBy: string) => Promise<void>;
  resetData: () => void;

  // Sales Records
  addSalesRecords: (records: Omit<SalesRecord, 'id' | 'timestamp'>[]) => Promise<void>;
  deleteSalesRecordsForDate: (date: string, branchId: string, platform: SalesPlatform) => Promise<void>;

  // CRUD
  addSku: (sku: Omit<SKU, 'id' | 'order'>) => Promise<void>;
  updateSku: (sku: SKU) => Promise<void>;
  deleteSku: (id: string) => Promise<void>;
  reorderSku: (id: string, direction: 'up' | 'down') => Promise<void>;

  addBranch: (branch: Omit<Branch, 'id'>) => Promise<void>;
  updateBranch: (branch: Branch) => Promise<void>;
  deleteBranch: (id: string) => Promise<void>;

  addMenuItem: (item: Omit<MenuItem, 'id'>) => Promise<void>;
  updateMenuItem: (item: MenuItem) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;

  addMenuCategory: (category: Omit<MenuCategory, 'id'>) => Promise<void>;
  updateMenuCategory: (category: MenuCategory, oldName: string) => Promise<void>;
  deleteMenuCategory: (id: string, name: string) => Promise<void>;
  reorderMenuCategory: (id: string, direction: 'up' | 'down') => Promise<void>;

  addOrder: (order: Order, redeemedCouponId?: string) => Promise<void>; // Updated signature
  deleteOrder: (id: string) => Promise<void>;

  // Customer & Loyalty
  addMembershipRule: (rule: Omit<MembershipRule, 'id'>) => Promise<void>;
  deleteMembershipRule: (id: string) => Promise<void>;
  checkCustomerReward: (customerId: string) => RewardResult | null;

  // Attendance
  addAttendance: (record: Omit<AttendanceRecord, 'id'>) => Promise<void>;
  setAttendanceStatus: (userId: string, date: string, type: AttendanceOverrideType | null) => Promise<void>;

  // Todos
  addTodo: (todo: Todo) => Promise<void>;
  toggleTodo: (id: string, isCompleted: boolean) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;

  // Task Templates
  addTaskTemplate: (template: TaskTemplate) => Promise<void>;
  updateTaskTemplate: (template: TaskTemplate) => Promise<void>;
  deleteTaskTemplate: (id: string) => Promise<void>;

  // Settings
  updateAppSetting: (key: string, value: any) => Promise<boolean>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State Initialization
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [skus, setSkus] = useState<SKU[]>(INITIAL_SKUS);
  const [branches, setBranches] = useState<Branch[]>(INITIAL_BRANCHES);
  const [orders, setOrders] = useState<Order[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU_ITEMS);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>(INITIAL_MENU_CATEGORIES);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [membershipRules, setMembershipRules] = useState<MembershipRule[]>(INITIAL_MEMBERSHIP_RULES);
  const [customerCoupons, setCustomerCoupons] = useState<CustomerCoupon[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceOverrides, setAttendanceOverrides] = useState<AttendanceOverride[]>([]);
  const [deletedTransactions, setDeletedTransactions] = useState<ArchivedTransaction[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  
  const [appSettings, setAppSettings] = useState<AppSettings>({
    require_customer_phone: false,
    require_customer_name: false,
    enable_beta_tasks: false,
    enable_whatsapp_webhook: false,
    whatsapp_webhook_url: ''
  });

  const [isLoading, setIsLoading] = useState(true);

  // Load from LocalStorage
  useEffect(() => {
    try {
      const load = (key: string, setter: any, fallback: any) => {
        const stored = localStorage.getItem(`pakaja_${key}`);
        if (stored) setter(JSON.parse(stored));
        else setter(fallback);
      };

      load('transactions', setTransactions, []);
      load('salesRecords', setSalesRecords, []);
      load('skus', setSkus, INITIAL_SKUS);
      load('branches', setBranches, INITIAL_BRANCHES);
      load('orders', setOrders, []);
      load('todos', setTodos, []);
      load('menuItems', setMenuItems, INITIAL_MENU_ITEMS);
      load('menuCategories', setMenuCategories, INITIAL_MENU_CATEGORIES);
      load('customers', setCustomers, INITIAL_CUSTOMERS);
      load('membershipRules', setMembershipRules, INITIAL_MEMBERSHIP_RULES);
      load('customerCoupons', setCustomerCoupons, []);
      load('attendanceRecords', setAttendanceRecords, []);
      load('attendanceOverrides', setAttendanceOverrides, []);
      load('deletedTransactions', setDeletedTransactions, []);
      load('taskTemplates', setTaskTemplates, []);
      
      const storedSettings = localStorage.getItem('pakaja_appSettings');
      if (storedSettings) {
          setAppSettings(prev => ({ ...prev, ...JSON.parse(storedSettings) }));
      }

    } catch (e) {
      console.error("Failed to load local data", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to LocalStorage helpers
  const save = (key: string, data: any) => {
    localStorage.setItem(`pakaja_${key}`, JSON.stringify(data));
  };

  // --- Transactions ---
  const addBatchTransactions = async (txs: any[]) => {
    const batchId = `batch-${Date.now()}`;
    const newTxs = txs.map((t, idx) => ({
      ...t,
      id: `tx-${Date.now()}-${idx}`,
      batchId,
      timestamp: Date.now()
    }));
    
    const updated = [...transactions, ...newTxs];
    setTransactions(updated);
    save('transactions', updated);
  };

  const deleteTransactionBatch = async (batchId: string, deletedBy: string) => {
    const toDelete = transactions.filter(t => t.batchId === batchId);
    const keep = transactions.filter(t => t.batchId !== batchId);
    
    // Archive
    const archived = toDelete.map(t => ({
        ...t,
        deletedAt: new Date().toISOString(),
        deletedBy
    }));

    setTransactions(keep);
    save('transactions', keep);
    
    const newDeleted = [...deletedTransactions, ...archived];
    setDeletedTransactions(newDeleted);
    save('deletedTransactions', newDeleted);
  };

  const resetData = () => {
    setTransactions([]); save('transactions', []);
    setSalesRecords([]); save('salesRecords', []);
    setOrders([]); save('orders', []);
    setAttendanceRecords([]); save('attendanceRecords', []);
    setAttendanceOverrides([]); save('attendanceOverrides', []);
    setTodos([]); save('todos', []);
    setCustomerCoupons([]); save('customerCoupons', []);
  };

  // --- Sales Records ---
  const addSalesRecords = async (records: any[]) => {
    const newRecords = records.map((r, idx) => ({
      ...r,
      id: `sr-${Date.now()}-${idx}`,
      timestamp: Date.now()
    }));
    const updated = [...salesRecords, ...newRecords];
    setSalesRecords(updated);
    save('salesRecords', updated);
  };

  const deleteSalesRecordsForDate = async (date: string, branchId: string, platform: SalesPlatform) => {
    const updated = salesRecords.filter(r => 
      !(r.date === date && r.branchId === branchId && r.platform === platform)
    );
    setSalesRecords(updated);
    save('salesRecords', updated);
  };

  // --- SKU CRUD ---
  const addSku = async (sku: any) => {
    const newSku = { ...sku, id: `sku-${Date.now()}`, order: skus.length };
    const updated = [...skus, newSku];
    setSkus(updated);
    save('skus', updated);
  };

  const updateSku = async (sku: SKU) => {
    const updated = skus.map(s => s.id === sku.id ? sku : s);
    setSkus(updated);
    save('skus', updated);
  };

  const deleteSku = async (id: string) => {
    const updated = skus.filter(s => s.id !== id);
    setSkus(updated);
    save('skus', updated);
  };

  const reorderSku = async (id: string, direction: 'up' | 'down') => {
    const index = skus.findIndex(s => s.id === id);
    if (index === -1) return;
    const newSkus = [...skus];
    if (direction === 'up' && index > 0) {
      [newSkus[index], newSkus[index - 1]] = [newSkus[index - 1], newSkus[index]];
    } else if (direction === 'down' && index < newSkus.length - 1) {
      [newSkus[index], newSkus[index + 1]] = [newSkus[index + 1], newSkus[index]];
    }
    // Reassign order
    const ordered = newSkus.map((s, idx) => ({ ...s, order: idx }));
    setSkus(ordered);
    save('skus', ordered);
  };

  // --- Branch CRUD ---
  const addBranch = async (branch: any) => {
    const newBranch = { ...branch, id: `br-${Date.now()}` };
    const updated = [...branches, newBranch];
    setBranches(updated);
    save('branches', updated);
  };

  const updateBranch = async (branch: Branch) => {
    const updated = branches.map(b => b.id === branch.id ? branch : b);
    setBranches(updated);
    save('branches', updated);
  };

  const deleteBranch = async (id: string) => {
    const updated = branches.filter(b => b.id !== id);
    setBranches(updated);
    save('branches', updated);
  };

  // --- Menu CRUD ---
  const addMenuItem = async (item: any) => {
    const newItem = { ...item, id: item.id || `menu-${Date.now()}` };
    const updated = [...menuItems, newItem];
    setMenuItems(updated);
    save('menuItems', updated);
  };

  const updateMenuItem = async (item: MenuItem) => {
    const updated = menuItems.map(i => i.id === item.id ? item : i);
    setMenuItems(updated);
    save('menuItems', updated);
  };

  const deleteMenuItem = async (id: string) => {
    const updated = menuItems.filter(i => i.id !== id);
    setMenuItems(updated);
    save('menuItems', updated);
  };

  // --- Category CRUD ---
  const addMenuCategory = async (cat: any) => {
    const newCat = { ...cat, id: `cat-${Date.now()}` };
    const updated = [...menuCategories, newCat];
    setMenuCategories(updated);
    save('menuCategories', updated);
  };

  const updateMenuCategory = async (cat: MenuCategory, oldName: string) => {
    const updatedCats = menuCategories.map(c => c.id === cat.id ? cat : c);
    setMenuCategories(updatedCats);
    save('menuCategories', updatedCats);

    // Update items if name changed
    if (cat.name !== oldName) {
        const updatedItems = menuItems.map(item => {
            if (item.category === oldName) return { ...item, category: cat.name };
            return item;
        });
        setMenuItems(updatedItems);
        save('menuItems', updatedItems);
    }
  };

  const deleteMenuCategory = async (id: string, name: string) => {
    const updatedCats = menuCategories.filter(c => c.id !== id);
    setMenuCategories(updatedCats);
    save('menuCategories', updatedCats);

    // Reset items to Uncategorized
    const updatedItems = menuItems.map(item => {
        if (item.category === name) return { ...item, category: 'Uncategorized' };
        return item;
    });
    setMenuItems(updatedItems);
    save('menuItems', updatedItems);
  };

  const reorderMenuCategory = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...menuCategories].sort((a,b) => a.order - b.order);
    const index = sorted.findIndex(c => c.id === id);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      [sorted[index], sorted[index - 1]] = [sorted[index - 1], sorted[index]];
    } else if (direction === 'down' && index < sorted.length - 1) {
      [sorted[index], sorted[index + 1]] = [sorted[index + 1], sorted[index]];
    }
    const final = sorted.map((c, idx) => ({ ...c, order: idx }));
    setMenuCategories(final);
    save('menuCategories', final);
  };

  // --- Orders & Customers & Coupons ---
  const addOrder = async (order: Order, redeemedCouponId?: string) => {
    const updatedOrders = [...orders, order];
    setOrders(updatedOrders);
    save('orders', updatedOrders);

    let currentCustomerOrderCount = 0;

    // Update Customer Stats
    if (order.customerId) {
        let customer = customers.find(c => c.id === order.customerId || c.phoneNumber === order.customerId);
        let newCustomers = [...customers];
        
        if (customer) {
            currentCustomerOrderCount = customer.orderCount + 1;
            customer = {
                ...customer,
                totalSpend: customer.totalSpend + order.totalAmount,
                orderCount: currentCustomerOrderCount,
                lastOrderDate: order.date
            };
            newCustomers = newCustomers.map(c => c.id === customer!.id ? customer! : c);
        } else {
            currentCustomerOrderCount = 1;
            // Create New Customer if not exists
            const newC: Customer = {
                id: order.customerId,
                name: order.customerName || 'Unknown',
                phoneNumber: order.customerId, // Assuming ID is Phone
                totalSpend: order.totalAmount,
                orderCount: 1,
                joinedAt: order.date,
                lastOrderDate: order.date
            };
            newCustomers.push(newC);
        }
        setCustomers(newCustomers);
        save('customers', newCustomers);
    }

    // --- COUPON LOGIC (Simulating DB Trigger) ---
    let updatedCoupons = [...customerCoupons];

    // 1. Mark coupon as USED if provided
    if (redeemedCouponId) {
        updatedCoupons = updatedCoupons.map(c => 
            c.id === redeemedCouponId ? { ...c, status: 'USED' } : c
        );
    }

    // 2. Generate NEXT Coupon (Trigger Simulation)
    if (order.customerId && membershipRules.length > 0) {
        // Calculate next target (Current + 1)
        const nextOrderCount = currentCustomerOrderCount + 1;
        
        const maxCycle = Math.max(...membershipRules.map(r => r.triggerOrderCount));
        let cyclePosition = nextOrderCount % maxCycle;
        if (cyclePosition === 0) cyclePosition = maxCycle;

        const nextRule = membershipRules.find(r => r.triggerOrderCount === cyclePosition);
        
        // If rule exists for NEXT visit, create coupon
        if (nextRule) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + (nextRule.validityDays || 3650)); // Default 10 years if no expiry

            const newCoupon: CustomerCoupon = {
                id: `cpn-${Date.now()}`,
                customerId: order.customerId,
                ruleId: nextRule.id,
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                expiresAt: expiryDate.toISOString()
            };
            updatedCoupons.push(newCoupon);
        }
    }

    setCustomerCoupons(updatedCoupons);
    save('customerCoupons', updatedCoupons);
  };

  const deleteOrder = async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    // Revert Customer Stats
    if (order.customerId) {
        const customer = customers.find(c => c.id === order.customerId || c.phoneNumber === order.customerId);
        if (customer) {
            const updatedC = {
                ...customer,
                totalSpend: Math.max(0, customer.totalSpend - order.totalAmount),
                orderCount: Math.max(0, customer.orderCount - 1)
            };
            const newCustomers = customers.map(c => c.id === updatedC.id ? updatedC : c);
            setCustomers(newCustomers);
            save('customers', newCustomers);
        }
    }

    const updatedOrders = orders.filter(o => o.id !== id);
    setOrders(updatedOrders);
    save('orders', updatedOrders);
  };

  // --- Loyalty Rules ---
  const addMembershipRule = async (rule: any) => {
    const newRule = { ...rule, id: `rule-${Date.now()}` };
    const updated = [...membershipRules, newRule];
    setMembershipRules(updated);
    save('membershipRules', updated);
  };

  const deleteMembershipRule = async (id: string) => {
    const updated = membershipRules.filter(r => r.id !== id);
    setMembershipRules(updated);
    save('membershipRules', updated);
  };

  // UPDATED: Check for AVAILABLE COUPON instead of calculating rule
  const checkCustomerReward = (customerId: string): RewardResult | null => {
      // Find active coupon for this customer
      const coupon = customerCoupons.find(c => 
          c.customerId === customerId && 
          c.status === 'ACTIVE'
      );

      if (!coupon) return null;

      // Check Expiry
      const now = new Date();
      const expiry = new Date(coupon.expiresAt);
      
      if (expiry < now) {
          // It's expired, update status internally (lazy update)
          // Ideally we'd update state, but for read-only check we just return expired status
          const rule = membershipRules.find(r => r.id === coupon.ruleId);
          if (!rule) return null;
          return { coupon, rule, status: 'EXPIRED' };
      }

      const rule = membershipRules.find(r => r.id === coupon.ruleId);
      if (!rule) return null;

      const diffTime = Math.abs(expiry.getTime() - now.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      return { 
          coupon,
          rule, 
          status: 'ACTIVE',
          daysLeft: diffDays
      };
  };

  // --- Attendance ---
  const addAttendance = async (record: any) => {
    const newRecord = { ...record, id: `att-${Date.now()}` };
    const updated = [...attendanceRecords, newRecord];
    setAttendanceRecords(updated);
    save('attendanceRecords', updated);
  };

  const setAttendanceStatus = async (userId: string, date: string, type: AttendanceOverrideType | null) => {
    let updated = [...attendanceOverrides];
    // Remove existing for this user/date
    updated = updated.filter(o => !(o.userId === userId && o.date === date));
    
    if (type) {
        updated.push({
            id: `ovr-${Date.now()}`,
            userId,
            date,
            type
        });
    }
    setAttendanceOverrides(updated);
    save('attendanceOverrides', updated);
  };

  // --- Todos ---
  const addTodo = async (todo: Todo) => {
    const updated = [todo, ...todos];
    setTodos(updated);
    save('todos', updated);
  };

  const toggleTodo = async (id: string, isCompleted: boolean) => {
    const updated = todos.map(t => t.id === id ? { ...t, isCompleted, completedAt: isCompleted ? Date.now() : undefined } : t);
    setTodos(updated);
    save('todos', updated);
  };

  const deleteTodo = async (id: string) => {
    const updated = todos.filter(t => t.id !== id);
    setTodos(updated);
    save('todos', updated);
  };

  // --- Templates ---
  const addTaskTemplate = async (template: TaskTemplate) => {
    const newTmpl = { ...template, id: `tmpl-${Date.now()}` };
    const updated = [...taskTemplates, newTmpl];
    setTaskTemplates(updated);
    save('taskTemplates', updated);
  };

  const updateTaskTemplate = async (template: TaskTemplate) => {
    const updated = taskTemplates.map(t => t.id === template.id ? template : t);
    setTaskTemplates(updated);
    save('taskTemplates', updated);
  };

  const deleteTaskTemplate = async (id: string) => {
    const updated = taskTemplates.filter(t => t.id !== id);
    setTaskTemplates(updated);
    save('taskTemplates', updated);
  };

  // --- Settings ---
  const updateAppSetting = async (key: string, value: any) => {
    const updated = { ...appSettings, [key]: value };
    setAppSettings(updated);
    save('appSettings', updated);
    return true;
  };

  return (
    <StoreContext.Provider value={{
      transactions, salesRecords, skus, branches, orders, todos, 
      menuItems, menuCategories, customers, membershipRules, customerCoupons,
      attendanceRecords, attendanceOverrides, deletedTransactions, 
      taskTemplates, appSettings, isLoading,
      addBatchTransactions, deleteTransactionBatch, resetData,
      addSalesRecords, deleteSalesRecordsForDate,
      addSku, updateSku, deleteSku, reorderSku,
      addBranch, updateBranch, deleteBranch,
      addMenuItem, updateMenuItem, deleteMenuItem,
      addMenuCategory, updateMenuCategory, deleteMenuCategory, reorderMenuCategory,
      addOrder, deleteOrder,
      addMembershipRule, deleteMembershipRule, checkCustomerReward,
      addAttendance, setAttendanceStatus,
      addTodo, toggleTodo, deleteTodo,
      addTaskTemplate, updateTaskTemplate, deleteTaskTemplate,
      updateAppSetting
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
