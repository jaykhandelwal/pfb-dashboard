
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  AppSettings, Branch, SKU, MenuItem, MenuCategory, Customer, 
  MembershipRule, Coupon, Transaction, Order, Todo, 
  TaskTemplate, SalesRecord, AttendanceRecord, AttendanceOverride, 
  StorageUnit, SKUCategory, SKUDietary, RewardResult, AttendanceOverrideType,
  TransactionType
} from '../types';
import { 
  INITIAL_SKUS, INITIAL_BRANCHES, INITIAL_MENU_ITEMS, 
  INITIAL_MENU_CATEGORIES, INITIAL_CUSTOMERS, INITIAL_MEMBERSHIP_RULES 
} from '../constants';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

// Helper for date string
const getLocalISOString = (date: Date = new Date()): string => {
  const offset = date.getTimezoneOffset() * 60000;
  const localTime = new Date(date.getTime() - offset);
  return localTime.toISOString().slice(0, 10);
};

const getSafeTimestamp = (obj: any): number => {
    if (obj.timestamp && !isNaN(Number(obj.timestamp))) return Number(obj.timestamp);
    if (obj.created_at) return new Date(obj.created_at).getTime();
    if (obj.createdAt) return new Date(obj.createdAt).getTime();
    return Date.now();
};

// Database Mappers
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

const mapTransactionToDB = (tx: Partial<Transaction>) => ({
  id: tx.id,
  batch_id: tx.batchId,
  date: tx.date,
  timestamp: tx.timestamp,
  branch_id: tx.branchId,
  sku_id: tx.skuId,
  type: tx.type,
  quantity_pieces: tx.quantityPieces,
  user_id: tx.userId,
  user_name: tx.userName,
  image_urls: tx.imageUrls
});

const mapOrderFromDB = (data: any): Order => ({ ...data, branchId: data.branch_id, customerId: data.customer_id, customerName: data.customer_name, totalAmount: data.total_amount, paymentMethod: data.payment_method, customAmount: data.custom_amount, customAmountReason: data.custom_amount_reason, customSkuItems: data.custom_sku_items, customSkuReason: data.custom_sku_reason });
const mapSkuFromDB = (data: any): SKU => ({ ...data, piecesPerPacket: data.pieces_per_packet, isDeepFreezerItem: data.is_deep_freezer_item, costPrice: data.cost_price });
const mapMenuItemFromDB = (data: any): MenuItem => ({ ...data, halfPrice: data.half_price, halfIngredients: data.half_ingredients });
const mapCustomerFromDB = (data: any): Customer => ({ ...data, phoneNumber: data.phone_number, totalSpend: data.total_spend, orderCount: data.order_count, joinedAt: data.joined_at, lastOrderDate: data.last_order_date });
const mapRuleFromDB = (data: any): MembershipRule => ({ ...data, triggerOrderCount: data.trigger_order_count, timeFrameDays: data.time_frame_days, validityDays: data.validity_days, minOrderValue: data.min_order_value, rewardVariant: data.reward_variant });
const mapCouponFromDB = (data: any): Coupon => ({ ...data, customerId: data.customer_id, ruleId: data.rule_id, expiresAt: data.expires_at, redeemedAt: data.redeemed_at, redeemedOrderId: data.redeemed_order_id });
const mapAttendanceFromDB = (data: any): AttendanceRecord => ({ ...data, userId: data.user_id, userName: data.user_name, branchId: data.branch_id, imageUrl: data.image_url });
const mapTemplateFromDB = (data: any): TaskTemplate => ({ ...data, assignedTo: data.assigned_to, assignedBy: data.assigned_by, weekDays: data.week_days, monthDays: data.month_days, startDate: data.start_date, lastGeneratedDate: data.last_generated_date, isActive: data.is_active });
const mapTodoFromDB = (data: any): Todo => ({ ...data, isCompleted: data.is_completed, assignedTo: data.assigned_to, assignedBy: data.assigned_by, createdAt: data.created_at, completedAt: data.completed_at, dueDate: data.due_date, templateId: data.template_id });
const mapSalesRecordFromDB = (data: any): SalesRecord => ({ ...data, totalSales: data.total_sales, netSales: data.net_sales, ordersCount: data.orders_count, imageUrl: data.image_url, parsedData: data.parsed_data });
const mapStorageUnitFromDB = (data: any): StorageUnit => ({ ...data, capacityLitres: data.capacity_litres, isActive: data.is_active });

// Deleted Transaction Mapper (adds metadata)
const mapDeletedTransactionFromDB = (t: any): Transaction => ({
    ...mapTransactionFromDB(t),
    deletedAt: t.deleted_at,
    deletedBy: t.deleted_by
});

interface StoreContextType {
  transactions: Transaction[];
  skus: SKU[];
  branches: Branch[];
  orders: Order[];
  todos: Todo[];
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  customers: Customer[];
  membershipRules: MembershipRule[];
  customerCoupons: Coupon[];
  attendanceRecords: AttendanceRecord[];
  attendanceOverrides: AttendanceOverride[];
  deletedTransactions: Transaction[];
  taskTemplates: TaskTemplate[];
  storageUnits: StorageUnit[];
  appSettings: AppSettings;
  salesRecords: SalesRecord[];
  lastUpdated: number; // Added timestamp
  
  addBatchTransactions: (txs: any[]) => Promise<boolean>;
  deleteTransactionBatch: (batchId: string, deletedBy: string) => Promise<void>;
  resetData: () => void;
  
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
  
  addMenuCategory: (cat: Omit<MenuCategory, 'id'>) => Promise<void>;
  updateMenuCategory: (cat: MenuCategory, originalName: string) => Promise<void>;
  deleteMenuCategory: (id: string, name: string) => Promise<void>;
  reorderMenuCategory: (id: string, direction: 'up' | 'down') => Promise<void>;
  
  addOrder: (order: Order, redeemedCouponId?: string) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  
  addMembershipRule: (rule: Omit<MembershipRule, 'id'>) => Promise<void>;
  deleteMembershipRule: (id: string) => Promise<void>;
  checkCustomerReward: (customerId: string) => RewardResult | null;
  
  addSalesRecords: (records: SalesRecord[]) => Promise<void>;
  deleteSalesRecordsForDate: (date: string, platform?: string) => Promise<void>;
  
  addTodo: (todo: Todo) => Promise<void>;
  toggleTodo: (id: string, isCompleted: boolean) => Promise<void>;
  addTaskTemplate: (tmpl: TaskTemplate) => Promise<void>;
  updateTaskTemplate: (tmpl: TaskTemplate) => Promise<void>;
  deleteTaskTemplate: (id: string) => Promise<void>;
  
  addAttendance: (record: Omit<AttendanceRecord, 'id'>) => Promise<void>;
  setAttendanceStatus: (userId: string, date: string, type: AttendanceOverrideType | null) => Promise<void>;
  
  addStorageUnit: (unit: Omit<StorageUnit, 'id'>) => Promise<void>;
  updateStorageUnit: (unit: StorageUnit) => Promise<void>;
  deleteStorageUnit: (id: string) => Promise<void>;
  
  updateAppSetting: (key: string, value: any) => Promise<void>;
  isLoading: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [skus, setSkus] = useState<SKU[]>(INITIAL_SKUS);
  const [branches, setBranches] = useState<Branch[]>(INITIAL_BRANCHES);
  const [orders, setOrders] = useState<Order[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU_ITEMS);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>(INITIAL_MENU_CATEGORIES);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [membershipRules, setMembershipRules] = useState<MembershipRule[]>(INITIAL_MEMBERSHIP_RULES);
  const [customerCoupons, setCustomerCoupons] = useState<Coupon[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceOverrides, setAttendanceOverrides] = useState<AttendanceOverride[]>([]);
  const [deletedTransactions, setDeletedTransactions] = useState<Transaction[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [storageUnits, setStorageUnits] = useState<StorageUnit[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    require_customer_phone: false,
    require_customer_name: false,
    enable_beta_tasks: false,
    enable_whatsapp_webhook: false,
    whatsapp_webhook_url: '',
    debug_whatsapp_webhook: false,
    enable_debug_logging: false, 
    stock_ordering_litres_per_packet: 2.3,
    deep_freezer_categories: [SKUCategory.STEAM, SKUCategory.KURKURE, SKUCategory.ROLL, SKUCategory.WHEAT] 
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  // Persistence Helper
  const save = (key: string, data: any) => { localStorage.setItem(`pakaja_${key}`, JSON.stringify(data)); };

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
                // Helper to fetch ALL rows, bypassing the default 1000 limit
                const fetchAll = async (table: string) => {
                    let allData: any[] = [];
                    let page = 0;
                    const pageSize = 1000;
                    // Safety limit to prevent infinite loops if DB is huge (e.g. >20k)
                    const maxPages = 20; 

                    while (page < maxPages) {
                        const { data, error } = await supabase
                            .from(table)
                            .select('*')
                            .range(page * pageSize, (page + 1) * pageSize - 1);
                        
                        if (error) {
                            console.error(`Error fetching ${table}:`, error);
                            break;
                        }
                        if (!data || data.length === 0) break;
                        
                        allData = [...allData, ...data];
                        
                        // If we got fewer rows than requested, we reached the end
                        if (data.length < pageSize) break; 
                        page++;
                    }
                    return { data: allData };
                };

                const [txData, ordData, skuData, brData, menuData, catData, custData, ruleData, cpnData, attData, tmplData, todoData, salesData, settingsData, storageData, delData] = await Promise.all([
                    fetchAll('transactions'), // Use fetchAll
                    fetchAll('orders'),       // Use fetchAll
                    supabase.from('skus').select('*').order('order', { ascending: true }),
                    supabase.from('branches').select('*'),
                    supabase.from('menu_items').select('*'),
                    supabase.from('menu_categories').select('*').order('order', { ascending: true }),
                    fetchAll('customers'),    // Use fetchAll
                    supabase.from('membership_rules').select('*'),
                    supabase.from('customer_coupons').select('*').order('created_at', { ascending: true }),
                    fetchAll('attendance'),   // Use fetchAll
                    supabase.from('task_templates').select('*'),
                    supabase.from('todos').select('*'),
                    fetchAll('sales_records'), // Use fetchAll
                    supabase.from('app_settings').select('*'),
                    supabase.from('storage_units').select('*'),
                    fetchAll('deleted_transactions') // Fetch explicitly from deleted table
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
                
                // Set Deleted Transactions
                if (delData.data) { 
                    const mappedDel = delData.data.map(mapDeletedTransactionFromDB); 
                    setDeletedTransactions(mappedDel); 
                    save('deletedTransactions', mappedDel); 
                }

                if (settingsData.data) {
                    const settingsMap = settingsData.data.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
                    setAppSettings(prev => ({ ...prev, ...settingsMap }));
                    save('appSettings', settingsMap);
                }
                
                setLastUpdated(Date.now());
            }
        } catch (e) { console.error("Sync Failed", e); } finally { setIsLoading(false); }
    };
    initializeStore();
  }, []);

  // --- REALTIME SUBSCRIPTIONS ---
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase.channel('db-changes')
      // 1. Transactions (Inventory Movements)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload: any) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          setTransactions(prev => {
              let updated = prev;
              if (eventType === 'INSERT') {
                  // Deduplicate based on ID to avoid double-adding if local state updated optimistically
                  if (prev.some(t => t.id === newRecord.id)) return prev;
                  updated = [...prev, mapTransactionFromDB(newRecord)];
              } else if (eventType === 'DELETE') {
                  updated = prev.filter(t => t.id !== oldRecord.id);
              }
              save('transactions', updated);
              setLastUpdated(Date.now());
              return updated;
          });
      })
      // 2. Orders
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          setOrders(prev => {
              let updated = prev;
              if (eventType === 'INSERT') {
                  if (prev.some(o => o.id === newRecord.id)) return prev;
                  updated = [mapOrderFromDB(newRecord), ...prev];
              } else if (eventType === 'UPDATE') {
                  updated = prev.map(o => o.id === newRecord.id ? mapOrderFromDB(newRecord) : o);
              } else if (eventType === 'DELETE') {
                  updated = prev.filter(o => o.id !== oldRecord.id);
              }
              save('orders', updated);
              setLastUpdated(Date.now());
              return updated;
          });
      })
      // 3. SKUs
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skus' }, (payload: any) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          setSkus(prev => {
              let updated = prev;
              if (eventType === 'INSERT') {
                  if (prev.some(s => s.id === newRecord.id)) return prev;
                  updated = [...prev, mapSkuFromDB(newRecord)];
              } else if (eventType === 'UPDATE') {
                  updated = prev.map(s => s.id === newRecord.id ? mapSkuFromDB(newRecord) : s);
              } else if (eventType === 'DELETE') {
                  updated = prev.filter(s => s.id !== oldRecord.id);
              }
              updated.sort((a,b) => a.order - b.order);
              save('skus', updated);
              setLastUpdated(Date.now());
              return updated;
          });
      })
      // 4. Attendance
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload: any) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          setAttendanceRecords(prev => {
              let updated = prev;
              if (eventType === 'INSERT') {
                  if (prev.some(a => a.id === newRecord.id)) return prev;
                  updated = [mapAttendanceFromDB(newRecord), ...prev];
              } else if (eventType === 'DELETE') {
                  updated = prev.filter(a => a.id !== oldRecord.id);
              }
              save('attendanceRecords', updated);
              setLastUpdated(Date.now());
              return updated;
          });
      })
      // 5. Todos / Tasks
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, (payload: any) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          setTodos(prev => {
              let updated = prev;
              if (eventType === 'INSERT') {
                  if (prev.some(t => t.id === newRecord.id)) return prev;
                  updated = [mapTodoFromDB(newRecord), ...prev];
              } else if (eventType === 'UPDATE') {
                  updated = prev.map(t => t.id === newRecord.id ? mapTodoFromDB(newRecord) : t);
              } else if (eventType === 'DELETE') {
                  updated = prev.filter(t => t.id !== oldRecord.id);
              }
              save('todos', updated);
              setLastUpdated(Date.now());
              return updated;
          });
      })
      // 6. App Settings
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload: any) => {
          const { eventType, new: newRecord } = payload;
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
              setAppSettings(prev => {
                  const updated = { ...prev, [newRecord.key]: newRecord.value };
                  save('appSettings', updated);
                  setLastUpdated(Date.now());
                  return updated;
              });
          }
      })
      // 7. Menu Items
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, (payload: any) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          setMenuItems(prev => {
              let updated = prev;
              if (eventType === 'INSERT') {
                  if (prev.some(m => m.id === newRecord.id)) return prev;
                  updated = [...prev, mapMenuItemFromDB(newRecord)];
              } else if (eventType === 'UPDATE') {
                  updated = prev.map(m => m.id === newRecord.id ? mapMenuItemFromDB(newRecord) : m);
              } else if (eventType === 'DELETE') {
                  updated = prev.filter(m => m.id !== oldRecord.id);
              }
              save('menuItems', updated);
              setLastUpdated(Date.now());
              return updated;
          });
      })
      // 8. Branches
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, (payload: any) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          setBranches(prev => {
              let updated = prev;
              if (eventType === 'INSERT') {
                  if (prev.some(b => b.id === newRecord.id)) return prev;
                  updated = [...prev, newRecord];
              } else if (eventType === 'UPDATE') {
                  updated = prev.map(b => b.id === newRecord.id ? newRecord : b);
              } else if (eventType === 'DELETE') {
                  updated = prev.filter(b => b.id !== oldRecord.id);
              }
              save('branches', updated);
              setLastUpdated(Date.now());
              return updated;
          });
      })
      .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, []);

  const addBatchTransactions = async (txs: any[]): Promise<boolean> => {
    const batchId = `batch-${Date.now()}`;
    const newTxs = txs.map((t, idx) => ({ ...t, id: `tx-${Date.now()}-${idx}`, batchId, timestamp: Date.now() }));
    const updated = [...transactions, ...newTxs];
    setTransactions(updated);
    save('transactions', updated);
    
    let cloudSuccess = false;
    if (isSupabaseConfigured()) {
        try { 
            const { data, error } = await supabase.from('transactions').insert(newTxs.map(mapTransactionToDB)).select();
            if (appSettings.enable_debug_logging) {
               if (error) alert(`DEBUG ERROR:\n${JSON.stringify(error, null, 2)}`);
               else alert(`DEBUG SUCCESS:\nSynced ${data?.length} records.\n\nFirst Record:\n${JSON.stringify(data?.[0], null, 2)}`);
            }
            if (error) throw error;
            cloudSuccess = true;
        } catch (e) { 
            console.error("Supabase Sync Failed:", e);
            if (appSettings.enable_debug_logging && !cloudSuccess) alert(`DEBUG EXCEPTION:\n${JSON.stringify(e, null, 2)}`);
            cloudSuccess = false;
        }
    }
    return cloudSuccess;
  };

  const deleteTransactionBatch = async (batchId: string, deletedBy: string) => {
      const toDelete = transactions.filter(t => t.batchId === batchId);
      const remaining = transactions.filter(t => t.batchId !== batchId);
      
      setTransactions(remaining);
      save('transactions', remaining);
      
      const deletedWithMeta = toDelete.map(t => ({ ...t, deletedAt: new Date().toISOString(), deletedBy }));
      setDeletedTransactions(prev => [...prev, ...deletedWithMeta]);
      save('deletedTransactions', [...deletedTransactions, ...deletedWithMeta]);

      if(isSupabaseConfigured()) {
          // Attempt to archive to deleted_transactions
          try {
              const deletedEntries = toDelete.map(t => ({
                  ...mapTransactionToDB(t),
                  deleted_at: new Date().toISOString(),
                  deleted_by: deletedBy
              }));
              const { error } = await supabase.from('deleted_transactions').insert(deletedEntries);
              if (error) {
                  console.warn("Archive to deleted_transactions warning (might already exist):", error);
              }
          } catch (e) {
              console.warn("Archive logic exception:", e);
          }

          // Always delete from active transactions
          try {
              await supabase.from('transactions').delete().eq('batch_id', batchId);
          } catch (e) {
              console.error("Deletion from transactions failed:", e);
          }
      }
  };

  const resetData = () => {
      localStorage.clear();
      window.location.reload();
  };

  // --- CRUD Placeholders (Implemented minimally for functionality) ---
  const addSku = async (sku: any) => { 
      const newSku = { ...sku, id: `sku-${Date.now()}` }; 
      setSkus([...skus, newSku]); save('skus', [...skus, newSku]);
      if(isSupabaseConfigured()) await supabase.from('skus').insert(newSku); 
  };
  const updateSku = async (sku: any) => { 
      const updated = skus.map(s => s.id === sku.id ? sku : s);
      setSkus(updated); save('skus', updated);
      if(isSupabaseConfigured()) await supabase.from('skus').update(sku).eq('id', sku.id);
  };
  const deleteSku = async (id: string) => {
      const updated = skus.filter(s => s.id !== id);
      setSkus(updated); save('skus', updated);
      if(isSupabaseConfigured()) await supabase.from('skus').delete().eq('id', id);
  };
  const reorderSku = async (id: string, direction: 'up' | 'down') => {
      // Reorder logic stub
  };

  const addBranch = async (branch: any) => { 
      const newB = { ...branch, id: `br-${Date.now()}` };
      setBranches([...branches, newB]); save('branches', [...branches, newB]);
      if(isSupabaseConfigured()) await supabase.from('branches').insert(newB);
  };
  const updateBranch = async (branch: any) => {
      const updated = branches.map(b => b.id === branch.id ? branch : b);
      setBranches(updated); save('branches', updated);
      if(isSupabaseConfigured()) await supabase.from('branches').update(branch).eq('id', branch.id);
  };
  const deleteBranch = async (id: string) => {
      const updated = branches.filter(b => b.id !== id);
      setBranches(updated); save('branches', updated);
      if(isSupabaseConfigured()) await supabase.from('branches').delete().eq('id', id);
  };

  const addMenuItem = async (item: any) => {
      const newItem = { ...item, id: item.id || `menu-${Date.now()}` };
      setMenuItems([...menuItems, newItem]); save('menuItems', [...menuItems, newItem]);
      if(isSupabaseConfigured()) await supabase.from('menu_items').insert(newItem);
  };
  const updateMenuItem = async (item: any) => {
      const updated = menuItems.map(i => i.id === item.id ? item : i);
      setMenuItems(updated); save('menuItems', updated);
      if(isSupabaseConfigured()) await supabase.from('menu_items').update(item).eq('id', item.id);
  };
  const deleteMenuItem = async (id: string) => {
      const updated = menuItems.filter(i => i.id !== id);
      setMenuItems(updated); save('menuItems', updated);
      if(isSupabaseConfigured()) await supabase.from('menu_items').delete().eq('id', id);
  };

  const addMenuCategory = async (cat: any) => {
      const newCat = { ...cat, id: `cat-${Date.now()}` };
      setMenuCategories([...menuCategories, newCat]); save('menuCategories', [...menuCategories, newCat]);
      if(isSupabaseConfigured()) await supabase.from('menu_categories').insert(newCat);
  };
  const updateMenuCategory = async (cat: any, originalName: string) => {
      const updated = menuCategories.map(c => c.id === cat.id ? cat : c);
      setMenuCategories(updated); save('menuCategories', updated);
      if(isSupabaseConfigured()) await supabase.from('menu_categories').update(cat).eq('id', cat.id);
  };
  const deleteMenuCategory = async (id: string, name: string) => {
      const updated = menuCategories.filter(c => c.id !== id);
      setMenuCategories(updated); save('menuCategories', updated);
      if(isSupabaseConfigured()) await supabase.from('menu_categories').delete().eq('id', id);
  };
  const reorderMenuCategory = async (id: string, direction: 'up' | 'down') => {};

  const addOrder = async (order: any, redeemedCouponId?: string) => {
      setOrders([order, ...orders]); save('orders', [order, ...orders]);
      if(isSupabaseConfigured()) await supabase.from('orders').insert(order);
      // If coupon used, mark redeemed
      if (redeemedCouponId) {
          const updatedCoupons = customerCoupons.map(c => c.id === redeemedCouponId ? { ...c, status: 'REDEEMED' as const, redeemedAt: Date.now(), redeemedOrderId: order.id } : c);
          setCustomerCoupons(updatedCoupons); save('customerCoupons', updatedCoupons);
      }
  };
  const deleteOrder = async (id: string) => {
      setOrders(orders.filter(o => o.id !== id)); save('orders', orders.filter(o => o.id !== id));
      if(isSupabaseConfigured()) await supabase.from('orders').delete().eq('id', id);
  };

  const addMembershipRule = async (rule: any) => {
      const newRule = { ...rule, id: `rule-${Date.now()}` };
      setMembershipRules([...membershipRules, newRule]); save('membershipRules', [...membershipRules, newRule]);
      if(isSupabaseConfigured()) await supabase.from('membership_rules').insert(newRule);
  };
  const deleteMembershipRule = async (id: string) => {
      const updated = membershipRules.filter(r => r.id !== id);
      setMembershipRules(updated); save('membershipRules', updated);
      if(isSupabaseConfigured()) await supabase.from('membership_rules').delete().eq('id', id);
  };

  const checkCustomerReward = (customerId: string): RewardResult | null => {
      const customer = customers.find(c => c.id === customerId);
      if (!customer) return null;
      // Simple check logic
      const rule = membershipRules.find(r => (customer.orderCount + 1) % r.triggerOrderCount === 0);
      if (rule) return { isEligible: true, rule };
      return null;
  };

  const addSalesRecords = async (records: SalesRecord[]) => {
      setSalesRecords([...salesRecords, ...records]);
      if(isSupabaseConfigured()) await supabase.from('sales_records').insert(records);
  };
  const deleteSalesRecordsForDate = async (date: string) => {};

  const addTodo = async (todo: Todo) => {
      setTodos([todo, ...todos]); save('todos', [todo, ...todos]);
      if(isSupabaseConfigured()) await supabase.from('todos').insert(todo);
  };
  const toggleTodo = async (id: string, isCompleted: boolean) => {
      const updated = todos.map(t => t.id === id ? { ...t, isCompleted, completedAt: isCompleted ? Date.now() : undefined } : t);
      setTodos(updated); save('todos', updated);
      if(isSupabaseConfigured()) await supabase.from('todos').update({ is_completed: isCompleted, completed_at: isCompleted ? new Date().toISOString() : null }).eq('id', id);
  };

  const addTaskTemplate = async (tmpl: TaskTemplate) => {
      const newT = { ...tmpl, id: `tmpl-${Date.now()}` };
      setTaskTemplates([...taskTemplates, newT]); save('taskTemplates', [...taskTemplates, newT]);
      if(isSupabaseConfigured()) await supabase.from('task_templates').insert(newT);
  };
  const updateTaskTemplate = async (tmpl: TaskTemplate) => {
      const updated = taskTemplates.map(t => t.id === tmpl.id ? tmpl : t);
      setTaskTemplates(updated); save('taskTemplates', updated);
      if(isSupabaseConfigured()) await supabase.from('task_templates').update(tmpl).eq('id', tmpl.id);
  };
  const deleteTaskTemplate = async (id: string) => {
      const updated = taskTemplates.filter(t => t.id !== id);
      setTaskTemplates(updated); save('taskTemplates', updated);
      if(isSupabaseConfigured()) await supabase.from('task_templates').delete().eq('id', id);
  };

  const addAttendance = async (record: any) => {
      const newR = { ...record, id: `att-${Date.now()}` };
      setAttendanceRecords([newR, ...attendanceRecords]); save('attendanceRecords', [newR, ...attendanceRecords]);
      if(isSupabaseConfigured()) await supabase.from('attendance').insert(newR);
  };
  const setAttendanceStatus = async (userId: string, date: string, type: any) => {
      // Upsert logic override
      if(type) {
          const override = { id: `over-${Date.now()}`, userId, date, type, markedBy: 'Admin' };
          setAttendanceOverrides([...attendanceOverrides, override]);
      } else {
          setAttendanceOverrides(attendanceOverrides.filter(o => !(o.userId === userId && o.date === date)));
      }
  };

  const addStorageUnit = async (unit: any) => {
      const newU = { ...unit, id: `st-${Date.now()}`, isActive: true };
      setStorageUnits([...storageUnits, newU]); save('storageUnits', [...storageUnits, newU]);
      if(isSupabaseConfigured()) await supabase.from('storage_units').insert(newU);
  };
  const updateStorageUnit = async (unit: any) => {
      const updated = storageUnits.map(u => u.id === unit.id ? unit : u);
      setStorageUnits(updated); save('storageUnits', updated);
      if(isSupabaseConfigured()) await supabase.from('storage_units').update(unit).eq('id', unit.id);
  };
  const deleteStorageUnit = async (id: string) => {
      const updated = storageUnits.filter(u => u.id !== id);
      setStorageUnits(updated); save('storageUnits', updated);
      if(isSupabaseConfigured()) await supabase.from('storage_units').delete().eq('id', id);
  };

  const updateAppSetting = async (key: string, value: any) => {
      const newSettings = { ...appSettings, [key]: value };
      setAppSettings(newSettings); save('appSettings', newSettings);
      if(isSupabaseConfigured()) await supabase.from('app_settings').upsert({ key, value });
  };

  return (
    <StoreContext.Provider value={{
        transactions, skus, branches, orders, todos, menuItems, menuCategories, 
        customers, membershipRules, customerCoupons, attendanceRecords, 
        attendanceOverrides, deletedTransactions, taskTemplates, storageUnits, 
        appSettings, salesRecords, lastUpdated, isLoading,
        addBatchTransactions, deleteTransactionBatch, resetData,
        addSku, updateSku, deleteSku, reorderSku,
        addBranch, updateBranch, deleteBranch,
        addMenuItem, updateMenuItem, deleteMenuItem,
        addMenuCategory, updateMenuCategory, deleteMenuCategory, reorderMenuCategory,
        addOrder, deleteOrder,
        addMembershipRule, deleteMembershipRule, checkCustomerReward,
        addSalesRecords, deleteSalesRecordsForDate,
        addTodo, toggleTodo, addTaskTemplate, updateTaskTemplate, deleteTaskTemplate,
        addAttendance, setAttendanceStatus,
        addStorageUnit, updateStorageUnit, deleteStorageUnit,
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
