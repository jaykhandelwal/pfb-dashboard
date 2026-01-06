
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Transaction, SKU, Branch, SalesRecord, Order, DailyReportItem, 
  Todo, AppSettings, MenuItem, MenuCategory, Customer, MembershipRule, 
  RewardResult, AttendanceRecord, AttendanceOverride, TaskTemplate,
  TransactionType, SalesPlatform, AttendanceOverrideType, ArchivedTransaction, CustomerCoupon, OrderItem
} from '../types';
import { 
  INITIAL_BRANCHES, INITIAL_SKUS, INITIAL_MENU_CATEGORIES, 
  INITIAL_MENU_ITEMS, INITIAL_MEMBERSHIP_RULES, INITIAL_CUSTOMERS 
} from '../constants';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

// --- DATA MAPPERS (DB snake_case <-> App camelCase) ---

// Helper to safely get a timestamp number. Prevents NaN.
const getSafeTimestamp = (obj: any): number => {
    if (obj.timestamp && !isNaN(Number(obj.timestamp))) return Number(obj.timestamp);
    if (obj.created_at) return new Date(obj.created_at).getTime();
    if (obj.createdAt) return new Date(obj.createdAt).getTime(); // handle camelCase source
    return Date.now(); // Last resort fallback
};

const mapTransactionFromDB = (t: any): Transaction => ({
  id: t.id,
  batchId: t.batch_id || t.batchId, 
  date: t.date,
  timestamp: getSafeTimestamp(t),
  skuId: t.sku_id || t.skuId,
  branchId: t.branch_id || t.branchId,
  type: t.type,
  quantityPieces: Number(t.quantity_pieces || t.quantityPieces || t.quantity || 0), 
  userId: t.user_id || t.userId,
  userName: t.user_name || t.userName,
  imageUrls: t.image_urls || (t.image_url ? [t.image_url] : [])
});

const mapTransactionToDB = (t: Partial<Transaction>) => ({
  id: t.id,
  batch_id: t.batchId,
  date: t.date,
  timestamp: t.timestamp,
  sku_id: t.skuId,
  branch_id: t.branchId,
  type: t.type,
  quantity_pieces: t.quantityPieces,
  user_id: t.userId,
  user_name: t.userName,
  image_urls: t.imageUrls
});

const mapOrderItemFromDB = (i: any): OrderItem => ({
  id: i.id,
  menuItemId: i.menuItemId || i.menu_item_id, 
  name: i.name,
  price: Number(i.price || 0),
  quantity: Number(i.quantity || 0),
  variant: i.variant,
  consumed: Array.isArray(i.consumed) ? i.consumed.map((c: any) => ({
      skuId: c.skuId || c.sku_id,
      quantity: Number(c.quantity || 0)
  })) : undefined
});

const mapOrderFromDB = (o: any): Order => ({
  id: o.id,
  branchId: o.branch_id || o.branchId,
  customerId: o.customer_id || o.customerId,
  customerName: o.customer_name || o.customerName,
  platform: o.platform,
  totalAmount: Number(o.total_amount || o.totalAmount || 0),
  status: o.status,
  paymentMethod: o.payment_method || o.paymentMethod,
  paymentSplit: o.payment_split || o.paymentSplit,
  date: o.date,
  timestamp: getSafeTimestamp(o),
  items: Array.isArray(o.items) ? o.items.map(mapOrderItemFromDB) : [],
  customAmount: Number(o.custom_amount || o.customAmount || 0),
  customAmountReason: o.custom_amount_reason || o.customAmountReason,
  customSkuItems: o.custom_sku_items || o.customSkuItems,
  customSkuReason: o.custom_sku_reason || o.customSkuReason
});

const mapOrderToDB = (o: Order) => ({
  id: o.id,
  branch_id: o.branchId,
  customer_id: o.customerId,
  customer_name: o.customerName,
  platform: o.platform,
  total_amount: o.totalAmount,
  status: o.status,
  payment_method: o.paymentMethod,
  payment_split: o.paymentSplit,
  date: o.date,
  timestamp: o.timestamp,
  items: o.items, 
  custom_amount: o.customAmount,
  custom_amount_reason: o.customAmountReason,
  custom_sku_items: o.customSkuItems,
  custom_sku_reason: o.customSkuReason
});

const mapSkuFromDB = (s: any): SKU => {
  // Prevent Division by Zero later in the app
  const rawPieces = Number(s.pieces_per_packet || s.piecesPerPacket || 0);
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    dietary: s.dietary,
    piecesPerPacket: rawPieces > 0 ? rawPieces : 1, // Safe default
    order: Number(s.order || 0)
  };
};

const mapSkuToDB = (s: SKU) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  dietary: s.dietary,
  pieces_per_packet: s.piecesPerPacket,
  order: s.order
});

const mapSalesRecordFromDB = (r: any): SalesRecord => ({
  id: r.id,
  orderId: r.order_id || r.orderId,
  date: r.date,
  branchId: r.branch_id || r.branchId,
  platform: r.platform,
  skuId: r.sku_id || r.skuId,
  quantitySold: Number(r.quantity_sold || r.quantitySold || 0),
  timestamp: getSafeTimestamp(r),
  customerId: r.customer_id || r.customerId,
  orderAmount: Number(r.order_amount || r.orderAmount || 0)
});

const mapSalesRecordToDB = (r: SalesRecord) => ({
  id: r.id,
  order_id: r.orderId,
  date: r.date,
  branch_id: r.branchId,
  platform: r.platform,
  sku_id: r.skuId,
  quantity_sold: r.quantitySold,
  timestamp: r.timestamp,
  customer_id: r.customerId,
  order_amount: r.orderAmount
});

const mapCustomerFromDB = (c: any): Customer => ({
  id: c.id,
  name: c.name,
  phoneNumber: c.phone_number || c.phoneNumber,
  totalSpend: Number(c.total_spend || c.totalSpend || 0),
  orderCount: Number(c.order_count || c.orderCount || 0),
  joinedAt: c.joined_at || c.joinedAt,
  lastOrderDate: c.last_order_date || c.lastOrderDate
});

const mapRuleFromDB = (r: any): MembershipRule => ({
  id: r.id,
  triggerOrderCount: Number(r.trigger_order_count || r.triggerOrderCount || 0),
  type: r.type,
  value: r.value,
  description: r.description,
  timeFrameDays: Number(r.time_frame_days || r.timeFrameDays || 30),
  validityDays: Number(r.validity_days || r.validityDays || 0),
  minOrderValue: Number(r.min_order_value || r.minOrderValue || 0),
  rewardVariant: r.reward_variant || r.rewardVariant || 'FULL'
});

const mapRuleToDB = (r: MembershipRule) => ({
  id: r.id,
  trigger_order_count: r.triggerOrderCount,
  type: r.type,
  value: r.value,
  description: r.description,
  time_frame_days: r.timeFrameDays,
  validity_days: r.validityDays,
  min_order_value: r.minOrderValue,
  reward_variant: r.rewardVariant
});

const mapCouponFromDB = (c: any): CustomerCoupon => ({
  id: c.id,
  customerId: c.customer_id || c.customerId,
  ruleId: c.rule_id || c.ruleId,
  status: c.status,
  expiresAt: c.expires_at || c.expiresAt,
  createdAt: c.created_at || c.createdAt
});

const mapAttendanceFromDB = (a: any): AttendanceRecord => ({
  id: a.id,
  userId: a.user_id || a.userId,
  userName: a.user_name || a.userName,
  branchId: a.branch_id || a.branchId,
  date: a.date,
  timestamp: getSafeTimestamp(a),
  imageUrl: a.image_url || a.imageUrl
});

const mapAttendanceToDB = (a: AttendanceRecord) => ({
  id: a.id,
  user_id: a.userId,
  user_name: a.userName,
  branch_id: a.branchId,
  date: a.date,
  timestamp: a.timestamp,
  image_url: a.imageUrl
});

const mapTodoFromDB = (t: any): Todo => ({
  id: t.id,
  text: t.text,
  assignedTo: t.assigned_to || t.assignedTo,
  assignedBy: t.assigned_by || t.assignedBy,
  isCompleted: t.is_completed || t.isCompleted,
  createdAt: Number(t.created_at_ts || t.createdAt || Date.now()),
  completedAt: t.completed_at_ts ? Number(t.completed_at_ts) : undefined,
  dueDate: t.due_date || t.dueDate,
  templateId: t.template_id || t.templateId,
  priority: t.priority
});

const mapTodoToDB = (t: Todo) => ({
  id: t.id,
  text: t.text,
  assigned_to: t.assignedTo,
  assigned_by: t.assignedBy,
  is_completed: t.isCompleted,
  created_at_ts: t.createdAt,
  completed_at_ts: t.completedAt,
  due_date: t.dueDate,
  template_id: t.templateId,
  priority: t.priority
});

const mapTemplateFromDB = (t: any): TaskTemplate => ({
  id: t.id,
  title: t.title,
  assignedTo: t.assigned_to || t.assignedTo,
  assignedBy: t.assigned_by || t.assignedBy,
  frequency: t.frequency,
  weekDays: t.week_days || t.weekDays,
  monthDays: t.month_days || t.monthDays,
  startDate: t.start_date || t.startDate,
  isActive: t.is_active || t.isActive,
  lastGeneratedDate: t.last_generated_date || t.lastGeneratedDate
});

const mapTemplateToDB = (t: TaskTemplate) => ({
  id: t.id,
  title: t.title,
  assigned_to: t.assignedTo,
  assigned_by: t.assignedBy,
  frequency: t.frequency,
  week_days: t.weekDays,
  month_days: t.monthDays,
  start_date: t.startDate,
  is_active: t.isActive,
  last_generated_date: t.lastGeneratedDate
});

const mapMenuItemFromDB = (m: any): MenuItem => ({
  id: m.id,
  name: m.name,
  price: Number(m.price || 0),
  halfPrice: m.half_price ? Number(m.half_price) : undefined,
  description: m.description,
  category: m.category,
  ingredients: Array.isArray(m.ingredients) ? m.ingredients.map((i: any) => ({
      skuId: i.skuId || i.sku_id,
      quantity: Number(i.quantity || 0)
  })) : [],
  halfIngredients: Array.isArray(m.half_ingredients || m.halfIngredients) 
    ? (m.half_ingredients || m.halfIngredients).map((i: any) => ({
      skuId: i.skuId || i.sku_id,
      quantity: Number(i.quantity || 0)
    })) 
    : undefined
});

const mapMenuItemToDB = (m: MenuItem) => ({
  id: m.id,
  name: m.name,
  price: m.price,
  half_price: m.halfPrice,
  description: m.description,
  category: m.category,
  ingredients: m.ingredients,
  half_ingredients: m.halfIngredients
});

// ----------------------------------------------

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
    whatsapp_webhook_url: '',
    debug_whatsapp_webhook: false
  });

  const [isLoading, setIsLoading] = useState(true);

  // Load from LocalStorage & Fetch from Supabase
  useEffect(() => {
    const initializeStore = async () => {
        try {
            // 1. Load LocalStorage (Instant UI)
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

            // 2. Fetch from Supabase (Source of Truth)
            if (isSupabaseConfigured()) {
                console.log("Syncing data from Supabase...");
                
                const [
                    { data: txData },
                    { data: ordData },
                    { data: skuData },
                    { data: brData },
                    { data: menuData },
                    { data: catData },
                    { data: custData },
                    { data: ruleData },
                    { data: cpnData },
                    { data: attData },
                    { data: tmplData },
                    { data: todoData },
                    { data: salesData },
                    { data: settingsData }
                ] = await Promise.all([
                    supabase.from('transactions').select('*'),
                    supabase.from('orders').select('*'),
                    supabase.from('skus').select('*').order('order', { ascending: true }),
                    supabase.from('branches').select('*'),
                    supabase.from('menu_items').select('*'),
                    supabase.from('menu_categories').select('*').order('order', { ascending: true }),
                    supabase.from('customers').select('*'),
                    supabase.from('membership_rules').select('*'),
                    supabase.from('customer_coupons').select('*'),
                    supabase.from('attendance').select('*'),
                    supabase.from('task_templates').select('*'),
                    supabase.from('todos').select('*'),
                    supabase.from('sales_records').select('*'),
                    supabase.from('app_settings').select('*')
                ]);

                // Update State & LocalStorage with MAPPED data
                if (txData) { 
                    const mapped = txData.map(mapTransactionFromDB);
                    setTransactions(mapped); 
                    save('transactions', mapped); 
                }
                if (ordData) { 
                    const mapped = ordData.map(mapOrderFromDB);
                    setOrders(mapped); 
                    save('orders', mapped); 
                }
                if (skuData) { 
                    const mapped = skuData.map(mapSkuFromDB);
                    setSkus(mapped); 
                    save('skus', mapped); 
                }
                if (brData) { setBranches(brData); save('branches', brData); }
                if (menuData) { 
                    const mapped = menuData.map(mapMenuItemFromDB);
                    setMenuItems(mapped); 
                    save('menuItems', mapped); 
                }
                if (catData) { setMenuCategories(catData); save('menuCategories', catData); }
                if (custData) { 
                    const mapped = custData.map(mapCustomerFromDB);
                    setCustomers(mapped); 
                    save('customers', mapped); 
                }
                if (ruleData) { 
                    const mapped = ruleData.map(mapRuleFromDB);
                    setMembershipRules(mapped); 
                    save('membershipRules', mapped); 
                }
                if (cpnData) { 
                    const mapped = cpnData.map(mapCouponFromDB);
                    setCustomerCoupons(mapped); 
                    save('customerCoupons', mapped); 
                }
                if (attData) { 
                    const mapped = attData.map(mapAttendanceFromDB);
                    setAttendanceRecords(mapped); 
                    save('attendanceRecords', mapped); 
                }
                if (tmplData) { 
                    const mapped = tmplData.map(mapTemplateFromDB);
                    setTaskTemplates(mapped); 
                    save('taskTemplates', mapped); 
                }
                if (todoData) { 
                    const mapped = todoData.map(mapTodoFromDB);
                    setTodos(mapped); 
                    save('todos', mapped); 
                }
                if (salesData) { 
                    const mapped = salesData.map(mapSalesRecordFromDB);
                    setSalesRecords(mapped); 
                    save('salesRecords', mapped); 
                }
                
                if (settingsData) {
                    const settingsMap = settingsData.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
                    setAppSettings(prev => ({ ...prev, ...settingsMap }));
                    save('appSettings', settingsMap);
                }
            }

        } catch (e) {
            console.error("Failed to load/sync data", e);
        } finally {
            setIsLoading(false);
        }
    };

    initializeStore();

    // 3. Realtime Listener (Coupons Only for now, extendable)
    if (isSupabaseConfigured()) {
        const channel = supabase.channel('public:customer_coupons')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_coupons' }, (payload: any) => {
                const { eventType, new: newRecord, old: oldRecord } = payload;
                
                setCustomerCoupons(prev => {
                    let updated = [...prev];
                    if (eventType === 'INSERT') {
                        if (!updated.find(c => c.id === newRecord.id)) updated.push(mapCouponFromDB(newRecord));
                    } else if (eventType === 'UPDATE') {
                        updated = updated.map(c => c.id === newRecord.id ? mapCouponFromDB(newRecord) : c);
                    } else if (eventType === 'DELETE') {
                        updated = updated.filter(c => c.id !== oldRecord.id);
                    }
                    save('customerCoupons', updated);
                    return updated;
                });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
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
    
    // Optimistic Update
    const updated = [...transactions, ...newTxs];
    setTransactions(updated);
    save('transactions', updated);

    if (isSupabaseConfigured()) {
        try {
            const mappedTxs = newTxs.map(mapTransactionToDB);
            await supabase.from('transactions').insert(mappedTxs);
        } catch (e) { console.error("Supabase Insert Error", e); }
    }
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

    if (isSupabaseConfigured()) {
        try {
            await supabase.from('transactions').delete().eq('batch_id', batchId);
            // Optionally insert into deleted_transactions table if it existed
        } catch (e) { console.error("Supabase Delete Error", e); }
    }
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

    if (isSupabaseConfigured()) {
        try { 
            const mapped = newRecords.map(mapSalesRecordToDB);
            await supabase.from('sales_records').insert(mapped); 
        } catch (e) { console.error(e); }
    }
  };

  const deleteSalesRecordsForDate = async (date: string, branchId: string, platform: SalesPlatform) => {
    const updated = salesRecords.filter(r => 
      !(r.date === date && r.branchId === branchId && r.platform === platform)
    );
    setSalesRecords(updated);
    save('salesRecords', updated);

    if (isSupabaseConfigured()) {
        try {
            await supabase.from('sales_records').delete()
                .eq('date', date)
                .eq('branch_id', branchId)
                .eq('platform', platform);
        } catch (e) { console.error(e); }
    }
  };

  // --- SKU CRUD ---
  const addSku = async (sku: any) => {
    const newSku = { ...sku, id: `sku-${Date.now()}`, order: skus.length };
    const updated = [...skus, newSku];
    setSkus(updated);
    save('skus', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('skus').insert(mapSkuToDB(newSku)); } catch (e) { console.error(e); }
    }
  };

  const updateSku = async (sku: SKU) => {
    const updated = skus.map(s => s.id === sku.id ? sku : s);
    setSkus(updated);
    save('skus', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('skus').update(mapSkuToDB(sku)).eq('id', sku.id); } catch (e) { console.error(e); }
    }
  };

  const deleteSku = async (id: string) => {
    const updated = skus.filter(s => s.id !== id);
    setSkus(updated);
    save('skus', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('skus').delete().eq('id', id); } catch (e) { console.error(e); }
    }
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

    if (isSupabaseConfigured()) {
        try {
            await Promise.all(ordered.map(s => supabase.from('skus').update({ order: s.order }).eq('id', s.id)));
        } catch (e) { console.error(e); }
    }
  };

  // --- Branch CRUD ---
  const addBranch = async (branch: any) => {
    const newBranch = { ...branch, id: `br-${Date.now()}` };
    const updated = [...branches, newBranch];
    setBranches(updated);
    save('branches', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('branches').insert(newBranch); } catch (e) { console.error(e); }
    }
  };

  const updateBranch = async (branch: Branch) => {
    const updated = branches.map(b => b.id === branch.id ? branch : b);
    setBranches(updated);
    save('branches', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('branches').update(branch).eq('id', branch.id); } catch (e) { console.error(e); }
    }
  };

  const deleteBranch = async (id: string) => {
    const updated = branches.filter(b => b.id !== id);
    setBranches(updated);
    save('branches', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('branches').delete().eq('id', id); } catch (e) { console.error(e); }
    }
  };

  // --- Menu CRUD ---
  const addMenuItem = async (item: any) => {
    const newItem = { ...item, id: item.id || `menu-${Date.now()}` };
    const updated = [...menuItems, newItem];
    setMenuItems(updated);
    save('menuItems', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('menu_items').insert(mapMenuItemToDB(newItem)); } catch (e) { console.error(e); }
    }
  };

  const updateMenuItem = async (item: MenuItem) => {
    const updated = menuItems.map(i => i.id === item.id ? item : i);
    setMenuItems(updated);
    save('menuItems', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('menu_items').update(mapMenuItemToDB(item)).eq('id', item.id); } catch (e) { console.error(e); }
    }
  };

  const deleteMenuItem = async (id: string) => {
    const updated = menuItems.filter(i => i.id !== id);
    setMenuItems(updated);
    save('menuItems', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('menu_items').delete().eq('id', id); } catch (e) { console.error(e); }
    }
  };

  // --- Category CRUD ---
  const addMenuCategory = async (cat: any) => {
    const newCat = { ...cat, id: `cat-${Date.now()}` };
    const updated = [...menuCategories, newCat];
    setMenuCategories(updated);
    save('menuCategories', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('menu_categories').insert(newCat); } catch (e) { console.error(e); }
    }
  };

  const updateMenuCategory = async (cat: MenuCategory, oldName: string) => {
    const updatedCats = menuCategories.map(c => c.id === cat.id ? cat : c);
    setMenuCategories(updatedCats);
    save('menuCategories', updatedCats);

    if (isSupabaseConfigured()) {
        try { await supabase.from('menu_categories').update(cat).eq('id', cat.id); } catch (e) { console.error(e); }
    }

    // Update items if name changed
    if (cat.name !== oldName) {
        const updatedItems = menuItems.map(item => {
            if (item.category === oldName) return { ...item, category: cat.name };
            return item;
        });
        setMenuItems(updatedItems);
        save('menuItems', updatedItems);
        
        // Note: For full consistency, we should update items in DB too, but might be heavy.
        // Assuming user will update manually or we do bulk update later.
    }
  };

  const deleteMenuCategory = async (id: string, name: string) => {
    const updatedCats = menuCategories.filter(c => c.id !== id);
    setMenuCategories(updatedCats);
    save('menuCategories', updatedCats);

    if (isSupabaseConfigured()) {
        try { await supabase.from('menu_categories').delete().eq('id', id); } catch (e) { console.error(e); }
    }

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

    if (isSupabaseConfigured()) {
        try { 
            await Promise.all(final.map(c => supabase.from('menu_categories').update({ order: c.order }).eq('id', c.id)));
        } catch (e) { console.error(e); }
    }
  };

  // --- Orders & Customers & Coupons ---
  const addOrder = async (order: Order, redeemedCouponId?: string) => {
    // 1. Save Order Locally
    const updatedOrders = [...orders, order];
    setOrders(updatedOrders);
    save('orders', updatedOrders);

    // 2. Sync to Supabase (If Online)
    // NOTE: This triggers the SQL Function `handle_new_order_loyalty` on the server
    if (isSupabaseConfigured()) {
        try {
            await supabase.from('orders').insert(mapOrderToDB(order));

            // Mark coupon as used in DB
            if (redeemedCouponId) {
                await supabase.from('customer_coupons')
                    .update({ status: 'USED' })
                    .eq('id', redeemedCouponId);
            }
        } catch (e) {
            console.error("Supabase Order Sync Failed:", e);
        }
    }

    // 3. Local State Updates (Optimistic UI)
    let currentCustomerOrderCount = 0;

    // Update Local Customer Stats
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

    // --- COUPON LOGIC ---
    let updatedCoupons = [...customerCoupons];

    // Mark as USED locally
    if (redeemedCouponId) {
        updatedCoupons = updatedCoupons.map(c => 
            c.id === redeemedCouponId ? { ...c, status: 'USED' } : c
        );
    }

    // If Offline mode, simulate generation
    if (!isSupabaseConfigured() && order.customerId && membershipRules.length > 0) {
        // Calculate next target (Current + 1)
        const nextOrderCount = currentCustomerOrderCount + 1;
        
        const maxCycle = Math.max(...membershipRules.map(r => r.triggerOrderCount));
        let cyclePosition = nextOrderCount % maxCycle;
        if (cyclePosition === 0) cyclePosition = maxCycle;

        const nextRule = membershipRules.find(r => r.triggerOrderCount === cyclePosition);
        
        // If rule exists for NEXT visit, create coupon
        if (nextRule) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + (nextRule.validityDays || 3650));

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

    if (isSupabaseConfigured()) {
        await supabase.from('orders').delete().eq('id', id);
    }

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

    if (isSupabaseConfigured()) {
        try { await supabase.from('membership_rules').insert(mapRuleToDB(newRule)); } catch (e) { console.error(e); }
    }
  };

  const deleteMembershipRule = async (id: string) => {
    const updated = membershipRules.filter(r => r.id !== id);
    setMembershipRules(updated);
    save('membershipRules', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('membership_rules').delete().eq('id', id); } catch (e) { console.error(e); }
    }
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

    if (isSupabaseConfigured()) {
        try { 
            await supabase.from('attendance').insert(mapAttendanceToDB(newRecord)); 
        } catch (e) { console.error(e); }
    }
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
    
    // Note: Overrides are currently local-only in this implementation, 
    // unless a table is created in Supabase.
  };

  // --- Todos ---
  const addTodo = async (todo: Todo) => {
    const updated = [todo, ...todos];
    setTodos(updated);
    save('todos', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('todos').insert(mapTodoToDB(todo)); } catch (e) { console.error(e); }
    }
  };

  const toggleTodo = async (id: string, isCompleted: boolean) => {
    const updated = todos.map(t => t.id === id ? { ...t, isCompleted, completedAt: isCompleted ? Date.now() : undefined } : t);
    setTodos(updated);
    save('todos', updated);

    if (isSupabaseConfigured()) {
        try { 
            await supabase.from('todos').update({ is_completed: isCompleted, completed_at_ts: isCompleted ? Date.now() : null }).eq('id', id); 
        } catch (e) { console.error(e); }
    }
  };

  const deleteTodo = async (id: string) => {
    const updated = todos.filter(t => t.id !== id);
    setTodos(updated);
    save('todos', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('todos').delete().eq('id', id); } catch (e) { console.error(e); }
    }
  };

  // --- Templates ---
  const addTaskTemplate = async (template: TaskTemplate) => {
    const newTmpl = { ...template, id: `tmpl-${Date.now()}` };
    const updated = [...taskTemplates, newTmpl];
    setTaskTemplates(updated);
    save('taskTemplates', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('task_templates').insert(mapTemplateToDB(newTmpl)); } catch (e) { console.error(e); }
    }
  };

  const updateTaskTemplate = async (template: TaskTemplate) => {
    const updated = taskTemplates.map(t => t.id === template.id ? template : t);
    setTaskTemplates(updated);
    save('taskTemplates', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('task_templates').update(mapTemplateToDB(template)).eq('id', template.id); } catch (e) { console.error(e); }
    }
  };

  const deleteTaskTemplate = async (id: string) => {
    const updated = taskTemplates.filter(t => t.id !== id);
    setTaskTemplates(updated);
    save('taskTemplates', updated);

    if (isSupabaseConfigured()) {
        try { await supabase.from('task_templates').delete().eq('id', id); } catch (e) { console.error(e); }
    }
  };

  // --- Settings ---
  const updateAppSetting = async (key: string, value: any) => {
    const updated = { ...appSettings, [key]: value };
    setAppSettings(updated);
    save('appSettings', updated);

    if (isSupabaseConfigured()) {
        try { 
            const { error } = await supabase.from('app_settings').upsert({ key, value });
            if(error) throw error;
        } catch (e) { 
            console.error(e);
            return false;
        }
    }
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
