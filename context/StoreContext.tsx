
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { SKU, Branch, Transaction, SalesRecord, ArchivedTransaction, Customer, MembershipRule, MenuItem, AttendanceRecord, Order, OrderItem, MenuCategory, AttendanceOverride, AttendanceOverrideType, AppSettings, Todo, TaskTemplate } from '../types';
import { INITIAL_BRANCHES, INITIAL_SKUS, INITIAL_CUSTOMERS, INITIAL_MEMBERSHIP_RULES, INITIAL_MENU_ITEMS, INITIAL_MENU_CATEGORIES, getLocalISOString } from '../constants';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface StoreContextType {
  skus: SKU[];
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  branches: Branch[];
  transactions: Transaction[];
  salesRecords: SalesRecord[]; 
  orders: Order[]; 
  customers: Customer[];
  membershipRules: MembershipRule[];
  deletedTransactions: ArchivedTransaction[];
  attendanceRecords: AttendanceRecord[];
  attendanceOverrides: AttendanceOverride[];
  appSettings: AppSettings;
  isLoading: boolean; // Added loading state
  
  // Task System
  todos: Todo[];
  taskTemplates: TaskTemplate[];
  
  addBatchTransactions: (txs: Omit<Transaction, 'id' | 'timestamp' | 'batchId'>[]) => Promise<void>;
  deleteTransactionBatch: (batchId: string, deletedBy: string) => Promise<void>;
  
  // Sales & Orders
  addSalesRecords: (records: Omit<SalesRecord, 'id' | 'timestamp'>[]) => Promise<void>; 
  addOrder: (orderData: Omit<Order, 'id' | 'timestamp'>) => Promise<void>; 
  deleteOrder: (orderId: string) => Promise<void>;
  deleteSalesRecordsForDate: (date: string, branchId: string, platform?: string) => Promise<void>;
  
  addSku: (sku: Omit<SKU, 'id' | 'order'>) => Promise<void>;
  updateSku: (sku: SKU) => Promise<void>;
  deleteSku: (id: string) => Promise<void>;
  reorderSku: (id: string, direction: 'up' | 'down') => Promise<void>;

  addMenuItem: (item: Omit<MenuItem, 'id'> & { id?: string }) => Promise<void>;
  updateMenuItem: (item: MenuItem) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  
  // Menu Categories
  addMenuCategory: (category: Omit<MenuCategory, 'id'>) => Promise<void>;
  updateMenuCategory: (category: MenuCategory, oldName: string) => Promise<void>;
  deleteMenuCategory: (id: string, name: string) => Promise<void>;
  reorderMenuCategory: (id: string, direction: 'up' | 'down') => Promise<void>;

  addBranch: (branch: Omit<Branch, 'id'>) => Promise<void>;
  updateBranch: (branch: Branch) => Promise<void>;
  deleteBranch: (id: string) => Promise<void>;
  
  addCustomer: (customer: Omit<Customer, 'id' | 'joinedAt' | 'totalSpend' | 'orderCount' | 'lastOrderDate'>) => Promise<void>;
  updateCustomer: (customer: Customer) => Promise<void>;
  
  addMembershipRule: (rule: Omit<MembershipRule, 'id'>) => Promise<void>;
  deleteMembershipRule: (id: string) => Promise<void>;

  addAttendance: (record: Omit<AttendanceRecord, 'id'>) => Promise<void>;
  setAttendanceStatus: (userId: string, date: string, type: AttendanceOverrideType | null, note?: string) => Promise<void>;

  updateAppSetting: (key: string, value: any) => Promise<boolean>;

  // Todos & Templates
  addTodo: (todo: Omit<Todo, 'id'>) => Promise<void>;
  toggleTodo: (id: string, isCompleted: boolean) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  addTaskTemplate: (template: Omit<TaskTemplate, 'id'>) => Promise<void>;
  updateTaskTemplate: (template: TaskTemplate) => Promise<void>;
  deleteTaskTemplate: (id: string) => Promise<void>;

  resetData: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deletedTransactions, setDeletedTransactions] = useState<ArchivedTransaction[]>([]);
  const [manualSalesRecords, setManualSalesRecords] = useState<SalesRecord[]>([]); 
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [membershipRules, setMembershipRules] = useState<MembershipRule[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceOverrides, setAttendanceOverrides] = useState<AttendanceOverride[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({ 
      require_customer_phone: false, 
      require_customer_name: false,
      enable_beta_tasks: true 
  });
  const [todos, setTodos] = useState<Todo[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);

  // Derived State
  const salesRecords = useMemo(() => {
     const derived = orders.flatMap(order => {
        const safeItems = Array.isArray(order.items) ? order.items : [];
        const itemRecords = safeItems.flatMap(item => {
           // SAFETY CHECK: Ensure item.consumed is strictly an array before mapping
           if (Array.isArray(item.consumed) && item.consumed.length > 0) {
              return item.consumed.map(c => ({
                 id: `${order.id}-${item.id}-${c.skuId}`,
                 orderId: order.id,
                 date: order.date,
                 branchId: order.branchId,
                 platform: order.platform,
                 skuId: c.skuId,
                 quantitySold: c.quantity,
                 customerId: order.customerId,
                 timestamp: order.timestamp,
                 orderAmount: 0 
              }));
           } 
           else {
             const potentialSku = skus.find(s => s.id === item.menuItemId);
             if (potentialSku) {
                return [{
                    id: `${order.id}-${item.id}`,
                    orderId: order.id,
                    date: order.date,
                    branchId: order.branchId,
                    platform: order.platform,
                    skuId: item.menuItemId, 
                    quantitySold: item.quantity,
                    customerId: order.customerId,
                    timestamp: order.timestamp,
                    orderAmount: item.price * item.quantity
                }];
             }
             return [];
           }
        });

        const customRecords: SalesRecord[] = [];
        if (Array.isArray(order.customSkuItems) && order.customSkuItems.length > 0) {
            order.customSkuItems.forEach((item, index) => {
                 customRecords.push({
                    id: `${order.id}-custom-sku-${index}`,
                    orderId: order.id,
                    date: order.date,
                    branchId: order.branchId,
                    platform: order.platform,
                    skuId: item.skuId,
                    quantitySold: item.quantity,
                    customerId: order.customerId,
                    timestamp: order.timestamp,
                    orderAmount: 0 
                });
            });
        }
        else if ((order as any).customSkuId && (order as any).customSkuQuantity) {
             // Legacy support
             customRecords.push({
                id: `${order.id}-custom-sku-legacy`,
                orderId: order.id,
                date: order.date,
                branchId: order.branchId,
                platform: order.platform,
                skuId: (order as any).customSkuId,
                quantitySold: (order as any).customSkuQuantity,
                customerId: order.customerId,
                timestamp: order.timestamp,
                orderAmount: 0
            });
        }

        return [...itemRecords, ...customRecords];
     });
     
     return [...derived, ...manualSalesRecords];
  }, [orders, manualSalesRecords, skus]);

  useEffect(() => {
    fetchData();
  }, []);

  // --- Realtime Subscriptions ---
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    // We subscribe to changes on all relevant tables
    const channel = supabase.channel('store-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
         handleRealtimeEvent(payload, setTransactions, mapTransaction);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
         handleRealtimeEvent(payload, setOrders, mapOrder);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_records' }, (payload) => {
         handleRealtimeEvent(payload, setManualSalesRecords, mapSalesRecord);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skus' }, (payload) => {
         handleRealtimeEvent(payload, setSkus, mapSku, 'order'); 
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, (payload) => {
         handleRealtimeEvent(payload, setMenuItems, mapMenuItem);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories' }, (payload) => {
         handleRealtimeEvent(payload, setMenuCategories, mapMenuCategory);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, (payload) => {
         handleRealtimeEvent(payload, setBranches, mapBranch);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload) => {
         handleRealtimeEvent(payload, setCustomers, mapCustomer);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'membership_rules' }, (payload) => {
         handleRealtimeEvent(payload, setMembershipRules, mapMembershipRule);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
         handleRealtimeEvent(payload, setAttendanceRecords, mapAttendance);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_overrides' }, (payload) => {
         handleRealtimeEvent(payload, setAttendanceOverrides, mapAttendanceOverride);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deleted_transactions' }, (payload) => {
         handleRealtimeEvent(payload, setDeletedTransactions, mapDeletedTransaction);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
         // Safe handler for app_settings changes
         const { eventType, new: newSetting } = payload;
         if ((eventType === 'INSERT' || eventType === 'UPDATE') && newSetting && newSetting.key) {
             setAppSettings(prev => ({
                 ...prev,
                 [newSetting.key]: newSetting.value
             }));
         }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, (payload) => {
         handleRealtimeEvent(payload, setTodos, mapTodo);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_templates' }, (payload) => {
         handleRealtimeEvent(payload, setTaskTemplates, mapTaskTemplate);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Generic Realtime Handler
  const handleRealtimeEvent = (
    payload: RealtimePostgresChangesPayload<any>,
    setState: React.Dispatch<React.SetStateAction<any[]>>,
    mapper: (data: any) => any,
    sortField?: string
  ) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    setState((prev) => {
      if (eventType === 'INSERT') {
        const mapped = mapper(newRecord);
        // SAFETY CHECK: Prevent duplicates if optimistic update already added it
        if (prev.some(item => item.id === mapped.id)) return prev;
        
        const newState = [mapped, ...prev];
        // Sort if needed (e.g. for SKUs or Categories which respect 'order')
        if(sortField) {
            return newState.sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
        }
        return newState;
      } 
      else if (eventType === 'UPDATE') {
        const mapped = mapper(newRecord);
        return prev.map((item) => (item.id === mapped.id ? mapped : item));
      } 
      else if (eventType === 'DELETE') {
        return prev.filter((item) => item.id !== oldRecord.id);
      }
      return prev;
    });
  };

  // --- Mappers (Snake Case -> Camel Case) ---
  const mapTransaction = (t: any): Transaction => ({
    id: t.id,
    batchId: t.batch_id,
    timestamp: t.timestamp,
    date: t.date,
    branchId: t.branch_id,
    skuId: t.sku_id,
    type: t.type,
    quantityPieces: t.quantity_pieces,
    imageUrls: t.image_urls || [],
    userId: t.user_id,
    userName: t.user_name
  });

  const mapOrder = (o: any): Order => ({
    id: o.id,
    branchId: o.branch_id,
    customerId: o.customer_id,
    customerName: o.customer_name,
    platform: o.platform,
    totalAmount: o.total_amount,
    status: o.status,
    paymentMethod: o.payment_method,
    paymentSplit: o.payment_split || [],
    date: o.date,
    timestamp: o.timestamp,
    items: o.items || [],
    customAmount: o.custom_amount,
    customAmountReason: o.custom_amount_reason,
    customSkuItems: o.custom_sku_items,
    customSkuReason: o.custom_sku_reason
  });

  const mapSalesRecord = (r: any): SalesRecord => ({
    id: r.id,
    orderId: r.order_id,
    date: r.date,
    branchId: r.branch_id,
    platform: r.platform,
    skuId: r.sku_id,
    quantitySold: r.quantity_sold,
    timestamp: r.timestamp,
    customerId: r.customer_id,
    orderAmount: r.order_amount
  });

  const mapSku = (s: any): SKU => ({
    id: s.id,
    name: s.name,
    category: s.category,
    dietary: s.dietary,
    piecesPerPacket: s.pieces_per_packet,
    order: s.order
  });

  const mapMenuItem = (m: any): MenuItem => ({
    id: m.id,
    name: m.name,
    price: m.price,
    halfPrice: m.half_price,
    description: m.description,
    category: m.category,
    ingredients: m.ingredients || [],
    halfIngredients: m.half_ingredients || []
  });

  const mapMenuCategory = (c: any): MenuCategory => ({
    id: c.id,
    name: c.name,
    order: c.order,
    color: c.color
  });

  const mapBranch = (b: any): Branch => ({
    id: b.id,
    name: b.name
  });

  const mapCustomer = (c: any): Customer => ({
    id: c.id,
    name: c.name,
    phoneNumber: c.phone_number,
    totalSpend: c.total_spend,
    orderCount: c.order_count,
    joinedAt: c.joined_at,
    lastOrderDate: c.last_order_date
  });

  const mapMembershipRule = (r: any): MembershipRule => ({
    id: r.id,
    triggerOrderCount: r.trigger_order_count,
    type: r.type,
    value: r.value,
    description: r.description,
    timeFrameDays: r.time_frame_days
  });

  const mapAttendance = (a: any): AttendanceRecord => ({
    id: a.id,
    userId: a.user_id,
    userName: a.user_name,
    branchId: a.branch_id,
    date: a.date,
    timestamp: a.timestamp,
    imageUrl: a.image_url
  });

  const mapAttendanceOverride = (o: any): AttendanceOverride => ({
    id: o.id,
    userId: o.user_id,
    date: o.date,
    type: o.type,
    note: o.note
  });

  const mapDeletedTransaction = (t: any): ArchivedTransaction => ({
    ...mapTransaction(t),
    deletedAt: t.deleted_at,
    deletedBy: t.deleted_by
  });

  const mapTodo = (t: any): Todo => ({
    id: t.id,
    text: t.text,
    assignedTo: t.assigned_to,
    assignedBy: t.assigned_by,
    isCompleted: t.is_completed,
    createdAt: t.created_at_ts,
    completedAt: t.completed_at_ts,
    dueDate: t.due_date,
    templateId: t.template_id,
    priority: t.priority || 'NORMAL'
  });

  const mapTaskTemplate = (t: any): TaskTemplate => ({
    id: t.id,
    title: t.title,
    assignedTo: t.assigned_to,
    assignedBy: t.assigned_by,
    frequency: t.frequency,
    weekDays: t.week_days,
    monthDays: t.month_days,
    startDate: t.start_date,
    isActive: t.is_active,
    lastGeneratedDate: t.last_generated_date
  });

  // --- End Realtime Logic ---

  const fetchData = async () => {
    setIsLoading(true);
    if (!isSupabaseConfigured()) {
        // Fallback for offline/demo mode
        if (skus.length === 0) setSkus(INITIAL_SKUS);
        if (menuItems.length === 0) setMenuItems(INITIAL_MENU_ITEMS);
        if (menuCategories.length === 0) setMenuCategories(INITIAL_MENU_CATEGORIES);
        if (branches.length === 0) setBranches(INITIAL_BRANCHES);
        if (customers.length === 0) setCustomers(INITIAL_CUSTOMERS);
        if (membershipRules.length === 0) setMembershipRules(INITIAL_MEMBERSHIP_RULES);
        setIsLoading(false);
        return; 
    }

    try {
      // Fetch and Map Data
      const { data: skusData } = await supabase.from('skus').select('*').order('order', { ascending: true });
      if (skusData) setSkus(skusData.map(mapSku));
      else setSkus(INITIAL_SKUS);

      const { data: menuData } = await supabase.from('menu_items').select('*');
      if (menuData) setMenuItems(menuData.map(mapMenuItem)); 
      else setMenuItems(INITIAL_MENU_ITEMS);

      const { data: catData } = await supabase.from('menu_categories').select('*').order('order', { ascending: true });
      if (catData && catData.length > 0) setMenuCategories(catData.map(mapMenuCategory));
      else if (menuItems.length === 0) setMenuCategories(INITIAL_MENU_CATEGORIES);

      const { data: branchData } = await supabase.from('branches').select('*');
      if (branchData) setBranches(branchData.map(mapBranch));
      else setBranches(INITIAL_BRANCHES);

      const { data: txData } = await supabase.from('transactions').select('*').order('timestamp', { ascending: false });
      if (txData) setTransactions(txData.map(mapTransaction));

      const { data: delData } = await supabase.from('deleted_transactions').select('*').order('deleted_at', { ascending: false });
      if (delData) setDeletedTransactions(delData.map(mapDeletedTransaction));

      const { data: manualData } = await supabase.from('sales_records').select('*');
      if (manualData) setManualSalesRecords(manualData.map(mapSalesRecord));

      const { data: ordersData } = await supabase.from('orders').select('*').order('timestamp', { ascending: false });
      if (ordersData) setOrders(ordersData.map(mapOrder));

      const { data: custData } = await supabase.from('customers').select('*');
      if (custData) setCustomers(custData.map(mapCustomer)); 
      else setCustomers(INITIAL_CUSTOMERS);

      const { data: rulesData } = await supabase.from('membership_rules').select('*');
      if (rulesData) setMembershipRules(rulesData.map(mapMembershipRule));
      else setMembershipRules(INITIAL_MEMBERSHIP_RULES);

      const { data: attData } = await supabase.from('attendance').select('*').order('timestamp', { ascending: false });
      if (attData) setAttendanceRecords(attData.map(mapAttendance));

      const { data: overrideData } = await supabase.from('attendance_overrides').select('*');
      if (overrideData) setAttendanceOverrides(overrideData.map(mapAttendanceOverride));

      // UPDATED SETTINGS FETCH
      const { data: settingsData, error: settingsError } = await supabase.from('app_settings').select('*');
      
      if (settingsError) {
          console.warn("StoreContext: Error fetching app_settings. Table might not exist.", settingsError);
      }
      
      if (settingsData) {
          const settingsObj: any = { ...appSettings }; // Start with defaults
          settingsData.forEach((row: any) => {
              settingsObj[row.key] = row.value;
          });
          setAppSettings(settingsObj);
      }

      const { data: todosData } = await supabase.from('todos').select('*').order('created_at_ts', { ascending: false });
      if (todosData) setTodos(todosData.map(mapTodo));

      const { data: tmplData } = await supabase.from('task_templates').select('*');
      if (tmplData) setTaskTemplates(tmplData.map(mapTaskTemplate));

    } catch (error) {
      console.warn("StoreContext: Error fetching data (Offline Mode):", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  // --- Task Auto-Generator Logic ---
  // This essentially acts as a "lazy cron job" that runs on client load
  const processRecurringTasks = async () => {
      const todayStr = getLocalISOString();
      const todayDate = new Date();
      const dayOfWeek = todayDate.getDay(); // 0=Sun, 1=Mon
      const dateOfMonth = todayDate.getDate(); // 1-31

      for (const tmpl of taskTemplates) {
          if (!tmpl.isActive) continue;
          
          // Check if already generated for today
          if (tmpl.lastGeneratedDate === todayStr) continue;

          let shouldGenerate = false;

          if (tmpl.frequency === 'DAILY') {
              shouldGenerate = true;
          } else if (tmpl.frequency === 'WEEKLY') {
              if (tmpl.weekDays && tmpl.weekDays.includes(dayOfWeek)) {
                  shouldGenerate = true;
              }
          } else if (tmpl.frequency === 'MONTHLY') {
              if (tmpl.monthDays && tmpl.monthDays.includes(dateOfMonth)) {
                  shouldGenerate = true;
              }
          } else if (tmpl.frequency === 'BI_WEEKLY') {
              if (tmpl.startDate) {
                  const start = new Date(tmpl.startDate);
                  const now = new Date(todayStr); // Compare strings using local date const
                  
                  // Calculate diff in days
                  const timeDiff = now.getTime() - start.getTime();
                  const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
                  
                  // Must be non-negative and divisible by 14
                  if (diffDays >= 0 && diffDays % 14 === 0) {
                      shouldGenerate = true;
                  }
              }
          }

          if (shouldGenerate) {
              // 1. Create the Task
              const newTodo: Todo = {
                  id: generateId(),
                  text: tmpl.title,
                  assignedTo: tmpl.assignedTo,
                  assignedBy: 'System (Recurring)',
                  isCompleted: false,
                  createdAt: Date.now(),
                  dueDate: todayStr,
                  templateId: tmpl.id,
                  priority: 'NORMAL'
              };

              // 2. Add locally
              setTodos(prev => [newTodo, ...prev]);

              // 3. Sync to DB
              if (isSupabaseConfigured()) {
                  await supabase.from('todos').insert({
                      id: newTodo.id,
                      text: newTodo.text,
                      assigned_to: newTodo.assignedTo,
                      assigned_by: newTodo.assignedBy,
                      is_completed: newTodo.isCompleted,
                      created_at_ts: newTodo.createdAt,
                      due_date: newTodo.dueDate,
                      template_id: newTodo.templateId,
                      priority: newTodo.priority
                  });

                  // 4. Update Template Last Generated
                  await supabase.from('task_templates').update({
                      last_generated_date: todayStr
                  }).eq('id', tmpl.id);
                  
                  // Update local template state
                  setTaskTemplates(prev => prev.map(t => t.id === tmpl.id ? { ...t, lastGeneratedDate: todayStr } : t));
              }
          }
      }
  };

  // Trigger generator when templates or app loads
  useEffect(() => {
      if (taskTemplates.length > 0) {
          processRecurringTasks();
      }
  }, [taskTemplates]);

  // ... (Rest of operations remain the same, just ensuring db inserts use snake_case)

  const addBatchTransactions = async (txs: Omit<Transaction, 'id' | 'timestamp' | 'batchId'>[]) => {
    if (txs.length === 0) return;
    const batchId = generateId();
    const timestamp = Date.now();

    const dbRows = txs.map(t => ({
      id: generateId(),
      batch_id: batchId,
      timestamp,
      date: t.date,
      branch_id: t.branchId,
      sku_id: t.skuId,
      type: t.type,
      quantity_pieces: t.quantityPieces,
      image_urls: t.imageUrls || [],
      user_id: t.userId,
      user_name: t.userName
    }));

    if (isSupabaseConfigured()) {
       await supabase.from('transactions').insert(dbRows);
    }
    
    // Optimistic Update
    const localTxs: Transaction[] = dbRows.map(r => mapTransaction(r));
    setTransactions(prev => [...localTxs, ...prev]);
  };

  const deleteTransactionBatch = async (batchId: string, deletedBy: string) => {
    if (!batchId) return;
    const itemsToDelete = transactions.filter(t => t.batchId === batchId);
    if (itemsToDelete.length === 0) return;

    const deletedAt = new Date().toISOString();
    const archiveRows = itemsToDelete.map(t => ({
      id: t.id,
      batch_id: t.batchId,
      timestamp: t.timestamp,
      date: t.date,
      branch_id: t.branchId,
      sku_id: t.skuId,
      type: t.type,
      quantity_pieces: t.quantityPieces,
      image_urls: t.imageUrls || [],
      user_id: t.userId,
      user_name: t.userName,
      deleted_at: deletedAt,
      deleted_by: deletedBy
    }));

    const archivedItems: ArchivedTransaction[] = itemsToDelete.map(t => ({
       ...t,
       deletedAt,
       deletedBy
    }));
    
    setTransactions(prev => prev.filter(t => t.batchId !== batchId));
    setDeletedTransactions(prev => [...archivedItems, ...prev]);

    if (isSupabaseConfigured()) {
       const { error: insertError } = await supabase.from('deleted_transactions').insert(archiveRows);
       if (!insertError) {
          await supabase.from('transactions').delete().eq('batch_id', batchId);
       }
    }
  };

  const addSalesRecords = async (records: Omit<SalesRecord, 'id' | 'timestamp'>[]) => {
     if (records.length === 0) return;
     const timestamp = Date.now();
     
     const localRecords: SalesRecord[] = records.map(r => ({
         id: generateId(),
         orderId: r.orderId,
         timestamp,
         date: r.date,
         branchId: r.branchId,
         platform: r.platform as any,
         skuId: r.skuId,
         quantitySold: r.quantitySold,
         customerId: r.customerId,
         orderAmount: r.orderAmount
     }));
     
     setManualSalesRecords(prev => [...prev, ...localRecords]);

     if (isSupabaseConfigured()) {
        const dbRows = localRecords.map(r => ({
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
        }));
        await supabase.from('sales_records').insert(dbRows);
    }
  };

  const addOrder = async (orderData: Omit<Order, 'id' | 'timestamp'>) => {
      const timestamp = Date.now();
      const orderId = generateId();

      const itemsWithSnapshot: OrderItem[] = orderData.items.map(item => {
         const menuItem = menuItems.find(m => m.id === item.menuItemId);
         let consumedSnapshot: { skuId: string; quantity: number }[] = [];
         
         if (menuItem) {
             if (item.variant === 'HALF') {
                 if (menuItem.halfIngredients && menuItem.halfIngredients.length > 0) {
                     consumedSnapshot = menuItem.halfIngredients.map(ing => ({
                         skuId: ing.skuId,
                         quantity: ing.quantity * item.quantity 
                     }));
                 } else if (menuItem.ingredients && menuItem.ingredients.length > 0) {
                     consumedSnapshot = menuItem.ingredients.map(ing => ({
                         skuId: ing.skuId,
                         quantity: ing.quantity * item.quantity * 0.5
                     }));
                 }
             } else {
                 if (menuItem.ingredients && menuItem.ingredients.length > 0) {
                     consumedSnapshot = menuItem.ingredients.map(ing => ({
                         skuId: ing.skuId,
                         quantity: ing.quantity * item.quantity
                     }));
                 }
             }
         } else {
             const matchingSku = skus.find(s => s.id === item.menuItemId);
             if (matchingSku) {
                 consumedSnapshot = [{ skuId: matchingSku.id, quantity: item.quantity }];
             }
         }

         return {
             ...item,
             consumed: consumedSnapshot 
         };
      });

      const itemsTotal = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const customTotal = orderData.customAmount || 0;
      
      const newOrder: Order = {
          id: orderId,
          timestamp,
          ...orderData,
          items: itemsWithSnapshot,
          totalAmount: orderData.totalAmount || (itemsTotal + customTotal)
      };

      if (newOrder.customerId) {
          const existingCust = customers.find(c => c.id === newOrder.customerId);
          if (existingCust) {
              const updatedCust = {
                  ...existingCust,
                  totalSpend: existingCust.totalSpend + newOrder.totalAmount,
                  orderCount: existingCust.orderCount + 1,
                  lastOrderDate: newOrder.date,
                  name: newOrder.customerName || existingCust.name 
              };
              await updateCustomer(updatedCust);
          } else {
              const newCust: Customer = {
                  id: newOrder.customerId, 
                  name: newOrder.customerName || 'Unknown',
                  phoneNumber: newOrder.customerId,
                  totalSpend: newOrder.totalAmount,
                  orderCount: 1,
                  joinedAt: new Date().toISOString(),
                  lastOrderDate: newOrder.date
              };
              if (isSupabaseConfigured()) {
                  await supabase.from('customers').insert({
                     id: newCust.id,
                     name: newCust.name,
                     phone_number: newCust.phoneNumber,
                     total_spend: newCust.totalSpend,
                     order_count: newCust.orderCount,
                     joined_at: newCust.joinedAt,
                     last_order_date: newCust.lastOrderDate
                  });
              }
              setCustomers(prev => [...prev, newCust]);
          }
      }

      if (isSupabaseConfigured()) {
          await supabase.from('orders').insert({
              id: newOrder.id,
              branch_id: newOrder.branchId,
              customer_id: newOrder.customerId,
              customer_name: newOrder.customerName,
              platform: newOrder.platform,
              total_amount: newOrder.totalAmount,
              status: newOrder.status,
              payment_method: newOrder.paymentMethod,
              payment_split: newOrder.paymentSplit,
              date: newOrder.date,
              timestamp: newOrder.timestamp,
              items: newOrder.items,
              custom_amount: newOrder.customAmount,
              custom_amount_reason: newOrder.customAmountReason,
              custom_sku_items: newOrder.customSkuItems, 
              custom_sku_reason: newOrder.customSkuReason
          });
      }
      setOrders(prev => [newOrder, ...prev]);
  };

  const deleteOrder = async (orderId: string) => {
    const orderToDelete = orders.find(o => o.id === orderId);
    if (!orderToDelete) return;

    if (orderToDelete.customerId) {
       const customer = customers.find(c => c.id === orderToDelete.customerId);
       if (customer) {
           const remainingOrders = orders.filter(o => o.customerId === orderToDelete.customerId && o.id !== orderId);
           const newTotalSpend = remainingOrders.reduce((sum, o) => sum + o.totalAmount, 0);
           const newOrderCount = remainingOrders.length;
           remainingOrders.sort((a,b) => b.timestamp - a.timestamp);
           const newLastOrderDate = remainingOrders.length > 0 ? remainingOrders[0].date : '-';
           
           const updatedCust = {
               ...customer,
               totalSpend: newTotalSpend,
               orderCount: newOrderCount,
               lastOrderDate: newLastOrderDate
           };
           await updateCustomer(updatedCust);
       }
    }

    if (isSupabaseConfigured()) {
       await supabase.from('orders').delete().eq('id', orderId);
    }
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const deleteSalesRecordsForDate = async (date: string, branchId: string, platform?: string) => {
    setManualSalesRecords(prev => prev.filter(r => {
        if (r.date !== date || r.branchId !== branchId) return true;
        if (platform && r.platform !== platform) return true;
        return false;
    }));

    if (isSupabaseConfigured()) {
       let query = supabase.from('sales_records').delete().eq('date', date).eq('branch_id', branchId);
       if (platform) {
          query = query.eq('platform', platform);
       }
       await query;
    }
  };

  const addSku = async (skuData: Omit<SKU, 'id' | 'order'>) => {
    const newSku = {
      id: `sku-${Date.now()}`,
      ...skuData,
      order: skus.length,
    };
    if (isSupabaseConfigured()) {
        await supabase.from('skus').insert({
            id: newSku.id,
            name: newSku.name,
            category: newSku.category,
            dietary: newSku.dietary,
            pieces_per_packet: newSku.piecesPerPacket,
            order: newSku.order
        });
    }
    setSkus(prev => [...prev, newSku as SKU]);
  };

  const updateSku = async (updatedSku: SKU) => {
    if (isSupabaseConfigured()) {
        await supabase.from('skus').update({
            name: updatedSku.name,
            category: updatedSku.category,
            dietary: updatedSku.dietary,
            pieces_per_packet: updatedSku.piecesPerPacket,
            order: updatedSku.order
        }).eq('id', updatedSku.id);
    }
    setSkus(prev => prev.map(s => s.id === updatedSku.id ? updatedSku : s));
  };

  const deleteSku = async (id: string) => {
    if (isSupabaseConfigured()) await supabase.from('skus').delete().eq('id', id);
    setSkus(prev => prev.filter(s => s.id !== id));
  };

  const reorderSku = async (id: string, direction: 'up' | 'down') => {
    const index = skus.findIndex(s => s.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === skus.length - 1) return;

    const newSkus = [...skus];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSkus[index], newSkus[targetIndex]] = [newSkus[targetIndex], newSkus[index]];
    
    const reordered = newSkus.map((s, idx) => ({ ...s, order: idx }));
    setSkus(reordered);

    if (isSupabaseConfigured()) {
        for (const s of reordered) {
            await supabase.from('skus').update({ order: s.order }).eq('id', s.id);
        }
    }
  };

  const addMenuCategory = async (categoryData: Omit<MenuCategory, 'id'>) => {
      const newCategory = {
         id: `cat-${Date.now()}`,
         ...categoryData,
         color: categoryData.color || '#64748b'
      };
      if (isSupabaseConfigured()) {
         await supabase.from('menu_categories').insert(newCategory);
      }
      setMenuCategories(prev => [...prev, newCategory]);
  };

  const updateMenuCategory = async (updated: MenuCategory, oldName: string) => {
      if (isSupabaseConfigured()) {
          await supabase.from('menu_categories').update(updated).eq('id', updated.id);
      }
      setMenuCategories(prev => prev.map(c => c.id === updated.id ? updated : c));

      if (oldName !== updated.name) {
         setMenuItems(prev => prev.map(m => m.category === oldName ? { ...m, category: updated.name } : m));
         if (isSupabaseConfigured()) {
             await supabase.from('menu_items').update({ category: updated.name }).eq('category', oldName);
         }
      }
  };

  const deleteMenuCategory = async (id: string, name: string) => {
      if (isSupabaseConfigured()) await supabase.from('menu_categories').delete().eq('id', id);
      setMenuCategories(prev => prev.filter(c => c.id !== id));

      setMenuItems(prev => prev.map(m => m.category === name ? { ...m, category: 'Uncategorized' } : m));
      if (isSupabaseConfigured()) {
          await supabase.from('menu_items').update({ category: 'Uncategorized' }).eq('category', name);
      }
  };

  const reorderMenuCategory = async (id: string, direction: 'up' | 'down') => {
      const index = menuCategories.findIndex(c => c.id === id);
      if (index === -1) return;
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === menuCategories.length - 1) return;

      const newCats = [...menuCategories];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newCats[index], newCats[targetIndex]] = [newCats[targetIndex], newCats[index]];

      const reordered = newCats.map((c, idx) => ({ ...c, order: idx }));
      setMenuCategories(reordered);

      if (isSupabaseConfigured()) {
          for (const c of reordered) {
             await supabase.from('menu_categories').update({ order: c.order }).eq('id', c.id);
          }
      }
  };

  const addMenuItem = async (itemData: Omit<MenuItem, 'id'> & { id?: string }) => {
    const newItem = {
      id: itemData.id || `menu-${Date.now()}`,
      ...itemData,
      category: itemData.category || 'Uncategorized'
    };
    if (isSupabaseConfigured()) {
       await supabase.from('menu_items').insert({
          id: newItem.id,
          name: newItem.name,
          price: newItem.price,
          half_price: newItem.halfPrice,
          description: newItem.description,
          category: newItem.category, 
          ingredients: newItem.ingredients,
          half_ingredients: newItem.halfIngredients
       });
    }
    setMenuItems(prev => [...prev, newItem]);
  };

  const updateMenuItem = async (updated: MenuItem) => {
    if (isSupabaseConfigured()) {
       await supabase.from('menu_items').update({
          name: updated.name,
          price: updated.price,
          half_price: updated.halfPrice,
          description: updated.description,
          category: updated.category, 
          ingredients: updated.ingredients,
          half_ingredients: updated.halfIngredients
       }).eq('id', updated.id);
    }
    setMenuItems(prev => prev.map(m => m.id === updated.id ? updated : m));
  };

  const deleteMenuItem = async (id: string) => {
    if (isSupabaseConfigured()) await supabase.from('menu_items').delete().eq('id', id);
    setMenuItems(prev => prev.filter(m => m.id !== id));
  };

  const addBranch = async (branchData: Omit<Branch, 'id'>) => {
    const newBranch = {
      id: `branch-${Date.now()}`,
      ...branchData
    };
    if (isSupabaseConfigured()) await supabase.from('branches').insert(newBranch);
    setBranches(prev => [...prev, newBranch]);
  };

  const updateBranch = async (updatedBranch: Branch) => {
    if (isSupabaseConfigured()) {
        await supabase.from('branches').update({ name: updatedBranch.name }).eq('id', updatedBranch.id);
    }
    setBranches(prev => prev.map(b => b.id === updatedBranch.id ? updatedBranch : b));
  };

  const deleteBranch = async (id: string) => {
    if (isSupabaseConfigured()) await supabase.from('branches').delete().eq('id', id);
    setBranches(prev => prev.filter(b => b.id !== id));
  };

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'joinedAt' | 'totalSpend' | 'orderCount' | 'lastOrderDate'>) => {
     const phoneId = customerData.phoneNumber.trim();
     const newCustomer: Customer = {
        id: phoneId,
        ...customerData,
        joinedAt: new Date().toISOString(),
        totalSpend: 0,
        orderCount: 0,
        lastOrderDate: '-'
     };
     if (isSupabaseConfigured()) {
        await supabase.from('customers').insert({
            id: newCustomer.id,
            name: newCustomer.name,
            phone_number: newCustomer.phoneNumber,
            total_spend: 0,
            order_count: 0,
            joined_at: newCustomer.joinedAt,
            last_order_date: null
        });
     }
     setCustomers(prev => [...prev, newCustomer]);
  };

  const updateCustomer = async (updated: Customer) => {
     if (isSupabaseConfigured()) {
        await supabase.from('customers').update({
            name: updated.name,
            phone_number: updated.phoneNumber,
            total_spend: updated.totalSpend,
            order_count: updated.orderCount,
            last_order_date: updated.lastOrderDate === '-' ? null : updated.lastOrderDate
        }).eq('id', updated.id);
     }
     setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const addMembershipRule = async (rule: Omit<MembershipRule, 'id'>) => {
     const newRule: MembershipRule = {
        id: `rule-${Date.now()}`,
        ...rule
     };
     if (isSupabaseConfigured()) {
        await supabase.from('membership_rules').insert({
           id: newRule.id,
           trigger_order_count: newRule.triggerOrderCount,
           type: newRule.type,
           value: newRule.value,
           description: newRule.description,
           time_frame_days: newRule.timeFrameDays
        });
     }
     setMembershipRules(prev => [...prev, newRule]);
  };

  const deleteMembershipRule = async (id: string) => {
     if (isSupabaseConfigured()) await supabase.from('membership_rules').delete().eq('id', id);
     setMembershipRules(prev => prev.filter(r => r.id !== id));
  };

  const addAttendance = async (record: Omit<AttendanceRecord, 'id'>) => {
      const newRecord: AttendanceRecord = {
          id: generateId(),
          ...record
      };
      if (isSupabaseConfigured()) {
          await supabase.from('attendance').insert({
             id: newRecord.id,
             user_id: newRecord.userId,
             user_name: newRecord.userName,
             branch_id: newRecord.branchId,
             date: newRecord.date,
             timestamp: newRecord.timestamp,
             image_url: newRecord.imageUrl
          });
      }
      setAttendanceRecords(prev => [newRecord, ...prev]);
  };

  const setAttendanceStatus = async (userId: string, date: string, type: AttendanceOverrideType | null, note?: string) => {
      // 1. Update Local State
      if (type === null) {
          setAttendanceOverrides(prev => prev.filter(o => !(o.userId === userId && o.date === date)));
          if (isSupabaseConfigured()) {
             await supabase.from('attendance_overrides').delete().match({ user_id: userId, date: date });
          }
      } else {
          const newOverride: AttendanceOverride = {
             id: generateId(),
             userId,
             date,
             type,
             note
          };
          
          setAttendanceOverrides(prev => {
              const filtered = prev.filter(o => !(o.userId === userId && o.date === date));
              return [...filtered, newOverride];
          });

          if (isSupabaseConfigured()) {
             // Upsert mechanism manually
             await supabase.from('attendance_overrides').delete().match({ user_id: userId, date: date });
             await supabase.from('attendance_overrides').insert({
                id: newOverride.id,
                user_id: newOverride.userId,
                date: newOverride.date,
                type: newOverride.type,
                note: newOverride.note
             });
          }
      }
  };

  // UPDATED: updateAppSetting with Error Handling and Success Log
  const updateAppSetting = async (key: string, value: any): Promise<boolean> => {
      const previousValue = appSettings[key];
      
      // Optimistic Update
      setAppSettings(prev => ({
          ...prev,
          [key]: value
      }));

      if (isSupabaseConfigured()) {
          const { error } = await supabase.from('app_settings').upsert({ key, value });
          
          if (error) {
              console.error(`StoreContext: Failed to save setting '${key}'.`, error);
              // Revert
              setAppSettings(prev => ({
                  ...prev,
                  [key]: previousValue
              }));
              alert(`Failed to save setting. Database error: ${error.message}`);
              return false;
          } else {
              console.log(`Setting '${key}' saved successfully.`);
              return true;
          }
      }
      return true; // Offline mode is always success
  };

  const addTodo = async (todoData: Omit<Todo, 'id'>) => {
    const newTodo: Todo = {
      id: generateId(),
      ...todoData
    };
    if (isSupabaseConfigured()) {
      await supabase.from('todos').insert({
        id: newTodo.id,
        text: newTodo.text,
        assigned_to: newTodo.assignedTo,
        assigned_by: newTodo.assignedBy,
        is_completed: newTodo.isCompleted,
        created_at_ts: newTodo.createdAt,
        completed_at_ts: newTodo.completedAt,
        due_date: newTodo.dueDate,
        template_id: newTodo.templateId,
        priority: newTodo.priority
      });
    }
    setTodos(prev => [newTodo, ...prev]);
  };

  const toggleTodo = async (id: string, isCompleted: boolean) => {
    if (isSupabaseConfigured()) {
      await supabase.from('todos').update({
        is_completed: isCompleted,
        completed_at_ts: isCompleted ? Date.now() : null
      }).eq('id', id);
    }
    setTodos(prev => prev.map(t => t.id === id ? { ...t, isCompleted, completedAt: isCompleted ? Date.now() : undefined } : t));
  };

  const deleteTodo = async (id: string) => {
    if (isSupabaseConfigured()) {
      await supabase.from('todos').delete().eq('id', id);
    }
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const addTaskTemplate = async (templateData: Omit<TaskTemplate, 'id'>) => {
      const newTemplate: TaskTemplate = {
          id: generateId(),
          ...templateData
      };
      if (isSupabaseConfigured()) {
          await supabase.from('task_templates').insert({
              id: newTemplate.id,
              title: newTemplate.title,
              assigned_to: newTemplate.assignedTo,
              assigned_by: newTemplate.assignedBy,
              frequency: newTemplate.frequency,
              week_days: newTemplate.weekDays,
              month_days: newTemplate.monthDays,
              start_date: newTemplate.startDate,
              is_active: newTemplate.isActive,
              last_generated_date: newTemplate.lastGeneratedDate
          });
      }
      setTaskTemplates(prev => [...prev, newTemplate]);
      processRecurringTasks(); // Trigger generation in case it matches today
  };

  const updateTaskTemplate = async (updated: TaskTemplate) => {
      if (isSupabaseConfigured()) {
          await supabase.from('task_templates').update({
              title: updated.title,
              assigned_to: updated.assignedTo,
              frequency: updated.frequency,
              week_days: updated.weekDays,
              month_days: updated.monthDays,
              start_date: updated.startDate,
              is_active: updated.isActive
          }).eq('id', updated.id);
      }
      setTaskTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
      processRecurringTasks();
  };

  const deleteTaskTemplate = async (id: string) => {
      if (isSupabaseConfigured()) {
          await supabase.from('task_templates').delete().eq('id', id);
      }
      setTaskTemplates(prev => prev.filter(t => t.id !== id));
  };

  const resetData = async () => {
    if (isSupabaseConfigured()) {
        await supabase.from('transactions').delete().neq('id', '0');
        await supabase.from('sales_records').delete().neq('id', '0'); 
        await supabase.from('orders').delete().neq('id', '0'); 
        await supabase.from('skus').delete().neq('id', '0');
        await supabase.from('menu_items').delete().neq('id', '0');
        await supabase.from('menu_categories').delete().neq('id', '0');
        await supabase.from('branches').delete().neq('id', '0');
        await supabase.from('deleted_transactions').delete().neq('id', '0');
        await supabase.from('customers').delete().neq('id', '0');
        await supabase.from('membership_rules').delete().neq('id', '0');
        await supabase.from('attendance').delete().neq('id', '0');
        await supabase.from('attendance_overrides').delete().neq('id', '0');
        await supabase.from('todos').delete().neq('id', '0');
        await supabase.from('task_templates').delete().neq('id', '0');
        // Do not reset app_settings to default automatically to preserve remote config
    }
    setTransactions([]);
    setManualSalesRecords([]);
    setOrders([]);
    setSkus([]);
    setMenuItems([]);
    setMenuCategories([]);
    setBranches([]);
    setDeletedTransactions([]);
    setCustomers([]);
    setMembershipRules([]);
    setAttendanceRecords([]);
    setAttendanceOverrides([]);
    setTodos([]);
    setTaskTemplates([]);
  };

  return (
    <StoreContext.Provider value={{ 
      skus, menuItems, menuCategories, branches, transactions, salesRecords, orders, deletedTransactions, customers, membershipRules, attendanceRecords, attendanceOverrides, appSettings, todos, taskTemplates, isLoading,
      addBatchTransactions, deleteTransactionBatch, addSalesRecords, addOrder, deleteOrder, deleteSalesRecordsForDate, 
      addSku, updateSku, deleteSku, reorderSku, addMenuItem, updateMenuItem, deleteMenuItem, 
      addMenuCategory, updateMenuCategory, deleteMenuCategory, reorderMenuCategory,
      addBranch, updateBranch, deleteBranch,
      addCustomer, updateCustomer, addMembershipRule, deleteMembershipRule, addAttendance, setAttendanceStatus, updateAppSetting,
      addTodo, toggleTodo, deleteTodo, addTaskTemplate, updateTaskTemplate, deleteTaskTemplate,
      resetData 
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
