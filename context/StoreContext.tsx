
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Transaction, SKU, Branch, SalesRecord, Order, DailyReportItem, 
  Todo, AppSettings, MenuItem, MenuCategory, Customer, MembershipRule, 
  RewardResult, AttendanceRecord, AttendanceOverride, TaskTemplate, StorageUnit,
  TransactionType, SalesPlatform, AttendanceOverrideType, ArchivedTransaction, CustomerCoupon, OrderItem, SKUCategory
} from '../types';
import { 
  INITIAL_BRANCHES, INITIAL_SKUS, INITIAL_MENU_CATEGORIES, 
  INITIAL_MENU_ITEMS, INITIAL_MEMBERSHIP_RULES, INITIAL_CUSTOMERS, DUMMY_CUSTOMER_PHONE 
} from '../constants';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

// --- DATA MAPPERS (DB snake_case <-> App camelCase) ---

const getSafeTimestamp = (obj: any): number => {
    if (obj.timestamp && !isNaN(Number(obj.timestamp))) return Number(obj.timestamp);
    if (obj.created_at) return new Date(obj.created_at).getTime();
    if (obj.createdAt) return new Date(obj.createdAt).getTime();
    return Date.now();
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

const mapOrderItemFromDB = (i: any): OrderItem => {
  let consumedData: OrderItem['consumed'];
  if (Array.isArray(i.consumed)) {
    consumedData = i.consumed.map((c: any) => ({
      skuId: c.skuId || c.sku_id,
      quantity: Number(c.quantity || 0)
    }));
  } else if (i.consumed && typeof i.consumed === 'object') {
    consumedData = {
      skuId: i.consumed.skuId || i.consumed.sku_id,
      quantity: Number(i.consumed.quantity || 0)
    };
  }

  return {
    id: i.id,
    menuItemId: i.menuItemId || i.menu_item_id, 
    name: i.name,
    price: Number(i.price || 0),
    quantity: Number(i.quantity || 0),
    variant: i.variant,
    consumed: consumedData
  };
};

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
  const rawPieces = Number(s.pieces_per_packet || s.piecesPerPacket || 0);
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    dietary: s.dietary,
    piecesPerPacket: rawPieces > 0 ? rawPieces : 1,
    order: Number(s.order || 0),
    isDeepFreezerItem: s.is_deep_freezer_item ?? false
  };
};

const mapSkuToDB = (s: SKU) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  dietary: s.dietary,
  pieces_per_packet: s.piecesPerPacket,
  order: s.order,
  is_deep_freezer_item: s.isDeepFreezerItem
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
  createdAt: c.created_at || c.createdAt,
  redeemedOrderId: c.redeemed_order_id || c.redeemedOrderId
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

const mapStorageUnitFromDB = (s: any): StorageUnit => ({
  id: s.id,
  name: s.name,
  capacityLitres: Number(s.capacity_litres || s.capacityLitres || 0),
  type: s.type,
  isActive: s.is_active ?? true
});

const mapStorageUnitToDB = (s: StorageUnit) => ({
  id: s.id,
  name: s.name,
  capacity_litres: s.capacityLitres,
  type: s.type,
  is_active: s.isActive
});

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
  customerCoupons: CustomerCoupon[];
  attendanceRecords: AttendanceRecord[];
  attendanceOverrides: AttendanceOverride[];
  deletedTransactions: ArchivedTransaction[];
  taskTemplates: TaskTemplate[];
  storageUnits: StorageUnit[];
  appSettings: AppSettings;
  isLoading: boolean;
  addBatchTransactions: (txs: Omit<Transaction, 'id' | 'timestamp' | 'batchId'>[]) => Promise<void>;
  deleteTransactionBatch: (batchId: string, deletedBy: string) => Promise<void>;
  resetData: () => void;
  addSalesRecords: (records: Omit<SalesRecord, 'id' | 'timestamp'>[]) => Promise<void>;
  deleteSalesRecordsForDate: (date: string, branchId: string, platform: SalesPlatform) => Promise<void>;
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
  addOrder: (order: Order, redeemedCouponId?: string) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  addMembershipRule: (rule: Omit<MembershipRule, 'id'>) => Promise<void>;
  deleteMembershipRule: (id: string) => Promise<void>;
  checkCustomerReward: (customerId: string) => RewardResult | null;
  addAttendance: (record: Omit<AttendanceRecord, 'id'>) => Promise<void>;
  setAttendanceStatus: (userId: string, date: string, type: AttendanceOverrideType | null) => Promise<void>;
  addTodo: (todo: Todo) => Promise<void>;
  toggleTodo: (id: string, isCompleted: boolean) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  addTaskTemplate: (template: TaskTemplate) => Promise<void>;
  updateTaskTemplate: (template: TaskTemplate) => Promise<void>;
  deleteTaskTemplate: (id: string) => Promise<void>;
  addStorageUnit: (unit: Omit<StorageUnit, 'id'>) => Promise<void>;
  updateStorageUnit: (unit: StorageUnit) => Promise<void>;
  deleteStorageUnit: (id: string) => Promise<void>;
  updateAppSetting: (key: string, value: any) => Promise<boolean>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
  const [storageUnits, setStorageUnits] = useState<StorageUnit[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    require_customer_phone: false,
    require_customer_name: false,
    enable_beta_tasks: false,
    enable_whatsapp_webhook: false,
    whatsapp_webhook_url: '',
    debug_whatsapp_webhook: false,
    stock_ordering_litres_per_packet: 2.3,
    deep_freezer_categories: [SKUCategory.STEAM, SKUCategory.KURKURE, SKUCategory.ROLL, SKUCategory.WHEAT] // Defaults
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeStore = async () => {
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
            load('storageUnits', setStorageUnits, []);
            
            const storedSettings = localStorage.getItem('pakaja_appSettings');
            if (storedSettings) {
                setAppSettings(prev => ({ ...prev, ...JSON.parse(storedSettings) }));
            }

            if (isSupabaseConfigured()) {
                const [txData, ordData, skuData, brData, menuData, catData, custData, ruleData, cpnData, attData, tmplData, todoData, salesData, settingsData, storageData] = await Promise.all([
                    supabase.from('transactions').select('*'),
                    supabase.from('orders').select('*'),
                    supabase.from('skus').select('*').order('order', { ascending: true }),
                    supabase.from('branches').select('*'),
                    supabase.from('menu_items').select('*'),
                    supabase.from('menu_categories').select('*').order('order', { ascending: true }),
                    supabase.from('customers').select('*'),
                    supabase.from('membership_rules').select('*'),
                    supabase.from('customer_coupons').select('*').order('created_at', { ascending: true }),
                    supabase.from('attendance').select('*'),
                    supabase.from('task_templates').select('*'),
                    supabase.from('todos').select('*'),
                    supabase.from('sales_records').select('*'),
                    supabase.from('app_settings').select('*'),
                    supabase.from('storage_units').select('*')
                ]);

                if (txData.data) { const mapped = txData.data.map(mapTransactionFromDB); setTransactions(mapped); save('transactions', mapped); }
                if (ordData.data) { const mapped = ordData.data.map(mapOrderFromDB); setOrders(mapped); save('orders', mapped); }
                if (skuData.data) { const mapped = skuData.data.map(mapSkuFromDB); setSkus(mapped); save('skus', mapped); }
                if (brData.data) { setBranches(brData.data); save('branches', brData.data); }
                if (menuData.data) { const mapped = menuData.data.map(mapMenuItemFromDB); setMenuItems(mapped); save('menuItems', mapped); }
                if (catData.data) { setMenuCategories(catData.data); save('menuCategories', catData.data); }
                if (custData.data) { const mapped = custData.data.map(mapCustomerFromDB); setCustomers(mapped); save('customers', mapped); }
                if (ruleData.data) { const mapped = ruleData.data.map(mapRuleFromDB); setMembershipRules(mapped); save('membershipRules', mapped); }
                if (cpnData.data) { const mapped = cpnData.data.map(mapCouponFromDB); setCustomerCoupons(mapped); save('customerCoupons', mapped); }
                if (attData.data) { const mapped = attData.data.map(mapAttendanceFromDB); setAttendanceRecords(mapped); save('attendanceRecords', mapped); }
                if (tmplData.data) { const mapped = tmplData.data.map(mapTemplateFromDB); setTaskTemplates(mapped); save('taskTemplates', mapped); }
                if (todoData.data) { const mapped = todoData.data.map(mapTodoFromDB); setTodos(mapped); save('todos', mapped); }
                if (salesData.data) { const mapped = salesData.data.map(mapSalesRecordFromDB); setSalesRecords(mapped); save('salesRecords', mapped); }
                if (storageData.data) { const mapped = storageData.data.map(mapStorageUnitFromDB); setStorageUnits(mapped); save('storageUnits', mapped); }
                
                if (settingsData.data) {
                    const settingsMap = settingsData.data.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
                    setAppSettings(prev => ({ ...prev, ...settingsMap }));
                    save('appSettings', settingsMap);
                }
            }
        } catch (e) { console.error("Sync Failed", e); } finally { setIsLoading(false); }
    };
    initializeStore();
  }, []);

  const save = (key: string, data: any) => { localStorage.setItem(`pakaja_${key}`, JSON.stringify(data)); };

  const addBatchTransactions = async (txs: any[]) => {
    const batchId = `batch-${Date.now()}`;
    const newTxs = txs.map((t, idx) => ({ ...t, id: `tx-${Date.now()}-${idx}`, batchId, timestamp: Date.now() }));
    const updated = [...transactions, ...newTxs];
    setTransactions(updated);
    save('transactions', updated);
    if (isSupabaseConfigured()) {
        try { await supabase.from('transactions').insert(newTxs.map(mapTransactionToDB)); } catch (e) { console.error(e); }
    }
  };

  const deleteTransactionBatch = async (batchId: string, deletedBy: string) => {
    const toDelete = transactions.filter(t => t.batchId === batchId);
    const keep = transactions.filter(t => t.batchId !== batchId);
    const archived = toDelete.map(t => ({ ...t, deletedAt: new Date().toISOString(), deletedBy }));
    setTransactions(keep);
    save('transactions', keep);
    const newDeleted = [...deletedTransactions, ...archived];
    setDeletedTransactions(newDeleted);
    save('deletedTransactions', newDeleted);
    if (isSupabaseConfigured()) { try { await supabase.from('transactions').delete().eq('batch_id', batchId); } catch (e) { console.error(e); } }
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

  const addSalesRecords = async (records: any[]) => {
    const newRecords = records.map((r, idx) => ({ ...r, id: `sr-${Date.now()}-${idx}`, timestamp: Date.now() }));
    const updated = [...salesRecords, ...newRecords];
    setSalesRecords(updated);
    save('salesRecords', updated);
    if (isSupabaseConfigured()) { try { await supabase.from('sales_records').insert(newRecords.map(mapSalesRecordToDB)); } catch (e) { console.error(e); } }
  };

  const deleteSalesRecordsForDate = async (date: string, branchId: string, platform: SalesPlatform) => {
    const updated = salesRecords.filter(r => !(r.date === date && r.branchId === branchId && r.platform === platform));
    setSalesRecords(updated);
    save('salesRecords', updated);
    if (isSupabaseConfigured()) { try { await supabase.from('sales_records').delete().eq('date', date).eq('branch_id', branchId).eq('platform', platform); } catch (e) { console.error(e); } }
  };

  const addSku = async (sku: any) => {
    const newSku = { ...sku, id: `sku-${Date.now()}`, order: skus.length };
    const updated = [...skus, newSku];
    setSkus(updated);
    save('skus', updated);
    if (isSupabaseConfigured()) { try { await supabase.from('skus').insert(mapSkuToDB(newSku)); } catch (e) { console.error(e); } }
  };

  const updateSku = async (sku: SKU) => {
    const updated = skus.map(s => s.id === sku.id ? sku : s);
    setSkus(updated);
    save('skus', updated);
    if (isSupabaseConfigured()) { try { await supabase.from('skus').update(mapSkuToDB(sku)).eq('id', sku.id); } catch (e) { console.error(e); } }
  };

  const deleteSku = async (id: string) => {
    const updated = skus.filter(s => s.id !== id);
    setSkus(updated);
    save('skus', updated);
    if (isSupabaseConfigured()) { try { await supabase.from('skus').delete().eq('id', id); } catch (e) { console.error(e); } }
  };

  const reorderSku = async (id: string, direction: 'up' | 'down') => {
    const index = skus.findIndex(s => s.id === id);
    if (index === -1) return;
    const newSkus = [...skus];
    if (direction === 'up' && index > 0) [newSkus[index], newSkus[index - 1]] = [newSkus[index - 1], newSkus[index]];
    else if (direction === 'down' && index < newSkus.length - 1) [newSkus[index], newSkus[index + 1]] = [newSkus[index + 1], newSkus[index]];
    const ordered = newSkus.map((s, idx) => ({ ...s, order: idx }));
    setSkus(ordered);
    save('skus', ordered);
    if (isSupabaseConfigured()) { try { await Promise.all(ordered.map(s => supabase.from('skus').update({ order: s.order }).eq('id', s.id))); } catch (e) { console.error(e); } }
  };

  const addBranch = async (branch: any) => {
    const newBranch = { ...branch, id: `br-${Date.now()}` };
    const updated = [...branches, newBranch];
    setBranches(updated);
    save('branches', updated);
    if (isSupabaseConfigured()) { try { await supabase.from('branches').insert(newBranch); } catch (e) { console.error(e); } }
  };

  const updateBranch = async (branch: Branch) => {
    const updated = branches.map(b => b.id === branch.id ? branch : b);
    setBranches(updated);
    save('branches', updated);
    if (isSupabaseConfigured()) { try { await supabase.from('branches').update(branch).eq('id', branch.id); } catch (e) { console.error(e); } }
  };

  const deleteBranch = async (id: string) => {
    const updated = branches.filter(b => b.id !== id);
    setBranches(updated);
    save('branches', updated);
    if (isSupabaseConfigured()) { try { await supabase.from('branches').delete().eq('id', id); } catch (e) { console.error(e); } }
  };

  const addMenuItem = async (item: any) => {
    const newItem = { ...item, id: item.id || `menu-${Date.now()}` };
    const updated = [...menuItems, newItem];
    setMenuItems(updated);
    save('menuItems', updated);
    if (isSupabaseConfigured()) { try { await supabase.from('menu_items').insert(mapMenuItemToDB(newItem)); } catch (e) { console.error(e); } }
  };

  const updateMenuItem = async (item: MenuItem) => {
    const updated = menuItems.map(i => i.id === item.id ? item : i);
    setMenuItems(updated);
    save('menuItems', updated);
    if (isSupabaseConfigured()) { try { await supabase.from('menu_items').update(mapMenuItemToDB(item)).eq('id', item.id); } catch (e) { console.error(e); } }
  };

  const deleteMenuItem = async (id: string) => {
    const updated = menuItems.filter(i => i.id !== id);
    setMenuItems(updated);
    save('menuItems', updated);
    if (isSupabaseConfigured()) { try { await supabase.from('menu_items').delete().eq('id', id); } catch (e) { console.error(e); } }
  };

  const addMenuCategory = async (cat: any) => {
    const newCat = { ...cat, id: `cat-${Date.now()}` };
    const updated = [...menuCategories, newCat];
    setMenuCategories(updated);
    save('menuCategories', updated);
    if (isSupabaseConfigured()) { try { await supabase.from('menu_categories').insert(newCat); } catch (e) { console.error(e); } }
  };

  const updateMenuCategory = async (cat: MenuCategory, oldName: string) => {
    const updatedCats = menuCategories.map(c => c.id === cat.id ? cat : c);
    setMenuCategories(updatedCats);
    save('menuCategories', updatedCats);
    if (isSupabaseConfigured()) { try { await supabase.from('menu_categories').update(cat).eq('id', cat.id); } catch (e) { console.error(e); } }
    if (cat.name !== oldName) {
        const updatedItems = menuItems.map(item => item.category === oldName ? { ...item, category: cat.name } : item);
        setMenuItems(updatedItems);
        save('menuItems', updatedItems);
    }
  };

  const deleteMenuCategory = async (id: string, name: string) => {
    const updatedCats = menuCategories.filter(c => c.id !== id);
    setMenuCategories(updatedCats);
    save('menuCategories', updatedCats);
    if (isSupabaseConfigured()) { try { await supabase.from('menu_categories').delete().eq('id', id); } catch (e) { console.error(e); } }
    const updatedItems = menuItems.map(item => item.category === name ? { ...item, category: 'Uncategorized' } : item);
    setMenuItems(updatedItems);
    save('menuItems', updatedItems);
  };

  const reorderMenuCategory = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...menuCategories].sort((a,b) => a.order - b.order);
    const index = sorted.findIndex(c => c.id === id);
    if (index === -1) return;
    if (direction === 'up' && index > 0) [sorted[index], sorted[index - 1]] = [sorted[index - 1], sorted[index]];
    else if (direction === 'down' && index < sorted.length - 1) [sorted[index], sorted[index + 1]] = [sorted[index + 1], sorted[index]];
    const final = sorted.map((c, idx) => ({ ...c, order: idx }));
    setMenuCategories(final);
    save('menuCategories', final);
    if (isSupabaseConfigured()) { try { await Promise.all(final.map(c => supabase.from('menu_categories').update({ order: c.order }).eq('id', c.id))); } catch (e) { console.error(e); } }
  };

  const addOrder = async (order: Order, redeemedCouponId?: string) => {
    const updatedOrders = [...orders, order];
    setOrders(updatedOrders);
    save('orders', updatedOrders);
    if (isSupabaseConfigured()) {
        try {
            await supabase.from('orders').insert(mapOrderToDB(order));
            if (redeemedCouponId) { await supabase.from('customer_coupons').update({ status: 'USED', redeemed_order_id: order.id }).eq('id', redeemedCouponId); }
        } catch (e) { console.error(e); }
    }
    if (order.customerId) {
        let customer = customers.find(c => c.id === order.customerId || c.phoneNumber === order.customerId);
        let newCustomers = [...customers];
        if (customer) {
            customer = { ...customer, totalSpend: customer.totalSpend + order.totalAmount, orderCount: customer.orderCount + 1, lastOrderDate: order.date };
            newCustomers = newCustomers.map(c => c.id === customer!.id ? customer! : c);
        } else {
            newCustomers.push({ id: order.customerId, name: order.customerName || 'Unknown', phoneNumber: order.customerId, totalSpend: order.totalAmount, orderCount: 1, joinedAt: order.date, lastOrderDate: order.date });
        }
        setCustomers(newCustomers);
        save('customers', newCustomers);
    }
  };

  const deleteOrder = async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    if (isSupabaseConfigured()) await supabase.from('orders').delete().eq('id', id);
    if (order.customerId) {
        const customer = customers.find(c => c.id === order.customerId || c.phoneNumber === order.customerId);
        if (customer) {
            const updatedC = { ...customer, totalSpend: Math.max(0, customer.totalSpend - order.totalAmount), orderCount: Math.max(0, customer.orderCount - 1) };
            setCustomers(customers.map(c => c.id === updatedC.id ? updatedC : c));
        }
    }
    setOrders(orders.filter(o => o.id !== id));
  };

  const addMembershipRule = async (rule: any) => {
    const newRule = { ...rule, id: `rule-${Date.now()}` };
    setMembershipRules([...membershipRules, newRule]);
    if (isSupabaseConfigured()) { try { await supabase.from('membership_rules').insert(mapRuleToDB(newRule)); } catch (e) { console.error(e); } }
  };

  const deleteMembershipRule = async (id: string) => {
    setMembershipRules(membershipRules.filter(r => r.id !== id));
    if (isSupabaseConfigured()) { try { await supabase.from('membership_rules').delete().eq('id', id); } catch (e) { console.error(e); } }
  };

  const checkCustomerReward = (customerId: string): RewardResult | null => {
      // 1. Blacklist dummy phone number from membership rewards
      if (customerId === DUMMY_CUSTOMER_PHONE) return null;

      const activeCoupons = customerCoupons.filter(c => c.customerId === customerId && c.status === 'ACTIVE').sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (activeCoupons.length === 0) return null;
      const coupon = activeCoupons[0];
      const now = new Date();
      const expiry = new Date(coupon.expiresAt);
      const rule = membershipRules.find(r => r.id === coupon.ruleId);
      if (!rule) return null;
      if (expiry < now) return { coupon, rule, status: 'EXPIRED' };
      const diffDays = Math.ceil(Math.abs(expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)); 
      return { coupon, rule, status: 'ACTIVE', daysLeft: diffDays };
  };

  const addAttendance = async (record: any) => {
    const newRecord = { ...record, id: `att-${Date.now()}` };
    setAttendanceRecords([...attendanceRecords, newRecord]);
    if (isSupabaseConfigured()) { try { await supabase.from('attendance').insert(mapAttendanceToDB(newRecord)); } catch (e) { console.error(e); } }
  };

  const setAttendanceStatus = async (userId: string, date: string, type: AttendanceOverrideType | null) => {
    let updated = attendanceOverrides.filter(o => !(o.userId === userId && o.date === date));
    if (type) updated.push({ id: `ovr-${Date.now()}`, userId, date, type });
    setAttendanceOverrides(updated);
    save('attendanceOverrides', updated);
  };

  const addTodo = async (todo: Todo) => {
    setTodos([todo, ...todos]);
    if (isSupabaseConfigured()) { try { await supabase.from('todos').insert(mapTodoToDB(todo)); } catch (e) { console.error(e); } }
  };

  const toggleTodo = async (id: string, isCompleted: boolean) => {
    setTodos(todos.map(t => t.id === id ? { ...t, isCompleted, completedAt: isCompleted ? Date.now() : undefined } : t));
    if (isSupabaseConfigured()) { try { await supabase.from('todos').update({ is_completed: isCompleted, completed_at_ts: isCompleted ? Date.now() : null }).eq('id', id); } catch (e) { console.error(e); } }
  };

  const deleteTodo = async (id: string) => {
    setTodos(todos.filter(t => t.id !== id));
    if (isSupabaseConfigured()) { try { await supabase.from('todos').delete().eq('id', id); } catch (e) { console.error(e); } }
  };

  const addTaskTemplate = async (template: TaskTemplate) => {
    const newTmpl = { ...template, id: `tmpl-${Date.now()}` };
    setTaskTemplates([...taskTemplates, newTmpl]);
    if (isSupabaseConfigured()) { try { await supabase.from('task_templates').insert(mapTemplateToDB(newTmpl)); } catch (e) { console.error(e); } }
  };

  const updateTaskTemplate = async (template: TaskTemplate) => {
    setTaskTemplates(taskTemplates.map(t => t.id === template.id ? template : t));
    if (isSupabaseConfigured()) { try { await supabase.from('task_templates').update(mapTemplateToDB(template)).eq('id', template.id); } catch (e) { console.error(e); } }
  };

  const deleteTaskTemplate = async (id: string) => {
    setTaskTemplates(taskTemplates.filter(t => t.id !== id));
    if (isSupabaseConfigured()) { try { await supabase.from('task_templates').delete().eq('id', id); } catch (e) { console.error(e); } }
  };

  // --- Storage Unit Management ---
  const addStorageUnit = async (unit: any) => {
    const newUnit = { ...unit, id: `store-${Date.now()}`, isActive: true };
    const updated = [...storageUnits, newUnit];
    setStorageUnits(updated);
    save('storageUnits', updated);
    if (isSupabaseConfigured()) { try { await supabase.from('storage_units').insert(mapStorageUnitToDB(newUnit)); } catch (e) { console.error(e); } }
  };

  const updateStorageUnit = async (unit: StorageUnit) => {
    const updated = storageUnits.map(u => u.id === unit.id ? unit : u);
    setStorageUnits(updated);
    save('storageUnits', updated);
    if (isSupabaseConfigured()) { try { await supabase.from('storage_units').update(mapStorageUnitToDB(unit)).eq('id', unit.id); } catch (e) { console.error(e); } }
  };

  const deleteStorageUnit = async (id: string) => {
    const updated = storageUnits.filter(u => u.id !== id);
    setStorageUnits(updated);
    save('storageUnits', updated);
    if (isSupabaseConfigured()) { try { await supabase.from('storage_units').delete().eq('id', id); } catch (e) { console.error(e); } }
  };

  const updateAppSetting = async (key: string, value: any) => {
    setAppSettings(prev => ({ ...prev, [key]: value }));
    save('appSettings', { ...appSettings, [key]: value });
    if (isSupabaseConfigured()) { try { await supabase.from('app_settings').upsert({ key, value }); return true; } catch (e) { return false; } }
    return true;
  };

  return (
    <StoreContext.Provider value={{
      transactions, salesRecords, skus, branches, orders, todos, 
      menuItems, menuCategories, customers, membershipRules, customerCoupons,
      attendanceRecords, attendanceOverrides, deletedTransactions, 
      taskTemplates, storageUnits, appSettings, isLoading,
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
      addStorageUnit, updateStorageUnit, deleteStorageUnit,
      updateAppSetting
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error('useStore must be used within a StoreProvider');
  return context;
};
