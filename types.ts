export type Permission = 
  | 'VIEW_DASHBOARD'
  | 'VIEW_ANALYTICS'
  | 'MANAGE_ATTENDANCE'
  | 'MANAGE_TASKS'
  | 'MANAGE_OPERATIONS'
  | 'MANAGE_INVENTORY'
  | 'MANAGE_WASTAGE'
  | 'MANAGE_SKUS'
  | 'MANAGE_MENU'
  | 'MANAGE_BRANCHES'
  | 'MANAGE_USERS'
  | 'MANAGE_SETTINGS'
  | 'VIEW_LOGS'
  | 'MANAGE_RECONCILIATION'
  | 'VIEW_ORDERS'
  | 'MANAGE_CUSTOMERS'
  | 'MANAGE_MEMBERSHIP';

export type Role = 'ADMIN' | 'MANAGER' | 'STAFF';

export interface User {
  id: string;
  name: string;
  code: string;
  role: Role;
  permissions: Permission[];
  defaultBranchId?: string;
  defaultPage?: string;
}

export interface Branch {
  id: string;
  name: string;
}

export enum SKUCategory {
  STEAM = 'Steam',
  KURKURE = 'Kurkure',
  WHEAT = 'Wheat',
  ROLL = 'Roll',
  CONSUMABLES = 'Consumables',
  FRY = 'Fry',
  MOMOS = 'Momos',
}

export enum SKUDietary {
  VEG = 'Veg',
  NON_VEG = 'Non-Veg',
  NA = 'N/A'
}

export interface SKU {
  id: string;
  name: string;
  category: SKUCategory;
  dietary: SKUDietary;
  piecesPerPacket: number;
  order: number;
  isDeepFreezerItem?: boolean;
  costPrice?: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  order: number;
  color?: string;
}

export interface MenuIngredient {
  skuId: string;
  quantity: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category?: string;
  price: number;
  halfPrice?: number;
  description?: string;
  ingredients: MenuIngredient[];
  halfIngredients?: MenuIngredient[];
}

export type MembershipRewardType = 'DISCOUNT_PERCENT' | 'FREE_ITEM';

export interface MembershipRule {
  id: string;
  triggerOrderCount: number;
  type: MembershipRewardType;
  value: number | string;
  description: string;
  timeFrameDays?: number;
  validityDays?: number;
  minOrderValue?: number;
  rewardVariant?: 'FULL' | 'HALF';
}

export interface Customer {
  id: string;
  name: string;
  phoneNumber: string;
  totalSpend: number;
  orderCount: number;
  joinedAt: string;
  lastOrderDate?: string;
}

export interface Coupon {
  id: string;
  customerId: string;
  ruleId: string;
  code: string;
  status: 'ACTIVE' | 'REDEEMED' | 'EXPIRED';
  createdAt: number;
  expiresAt?: number;
  redeemedAt?: number;
  redeemedOrderId?: string;
  description: string;
  value: number | string;
  type: MembershipRewardType;
}

export enum TransactionType {
  CHECK_OUT = 'CHECK_OUT',
  CHECK_IN = 'CHECK_IN',
  WASTE = 'WASTE',
  RESTOCK = 'RESTOCK',
  ADJUSTMENT = 'ADJUSTMENT'
}

export interface Transaction {
  id: string;
  batchId?: string;
  date: string;
  timestamp: number;
  branchId: string;
  skuId: string;
  type: TransactionType;
  quantityPieces: number;
  userId?: string;
  userName?: string;
  imageUrls?: string[];
  deletedAt?: string;
  deletedBy?: string;
}

export type SalesPlatform = 'POS' | 'ZOMATO' | 'SWIGGY';

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  variant?: 'FULL' | 'HALF';
  consumed?: { skuId: string; quantity: number }[];
}

export interface Order {
  id: string;
  branchId: string;
  customerId?: string;
  customerName?: string;
  platform: SalesPlatform;
  totalAmount: number;
  status: 'COMPLETED' | 'CANCELLED';
  paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'SPLIT';
  paymentSplit?: { method: 'CASH' | 'UPI' | 'CARD', amount: number }[];
  date: string;
  timestamp: number;
  items: OrderItem[];
  customAmount?: number;
  customAmountReason?: string;
  customSkuItems?: { skuId: string, quantity: number }[];
  customSkuReason?: string;
}

export interface DailyReportItem {
  skuName: string;
  category: SKUCategory;
  dietary: SKUDietary;
  taken: number;
  returned: number;
  waste: number;
  sold: number;
}

export interface SalesRecord {
  id: string;
  date: string;
  platform: SalesPlatform;
  totalSales: number;
  netSales?: number;
  ordersCount?: number;
  imageUrl?: string;
  parsedData?: Record<string, number>;
}

export interface Todo {
  id: string;
  text: string;
  isCompleted: boolean;
  assignedTo: string;
  assignedBy: string;
  createdAt: number;
  completedAt?: number;
  dueDate?: string;
  templateId?: string;
}

export type TaskFrequency = 'DAILY' | 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY';

export interface TaskTemplate {
  id: string;
  title: string;
  assignedTo: string;
  assignedBy: string;
  frequency: TaskFrequency;
  weekDays?: number[];
  monthDays?: number[];
  startDate?: string;
  lastGeneratedDate?: string;
  isActive: boolean;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  branchId: string;
  date: string;
  timestamp: number;
  imageUrl?: string;
}

export type AttendanceOverrideType = 'HOLIDAY' | 'ABSENT' | 'PENALTY_2_DAYS';

export interface AttendanceOverride {
  id: string;
  userId: string;
  date: string;
  type: AttendanceOverrideType;
  markedBy: string;
}

export interface StorageUnit {
  id: string;
  name: string;
  capacityLitres: number;
  type: 'DEEP_FREEZER' | 'FRIDGE' | 'SHELF';
  isActive: boolean;
}

export interface AppSettings {
  require_customer_phone: boolean;
  require_customer_name: boolean;
  enable_beta_tasks: boolean;
  enable_whatsapp_webhook: boolean; 
  whatsapp_webhook_url: string; 
  debug_whatsapp_webhook: boolean; 
  enable_debug_logging: boolean; 
  stock_ordering_litres_per_packet: number | string; 
  deep_freezer_categories: string[]; 
  [key: string]: any; 
}

export interface RewardResult {
    isEligible: boolean;
    rule: MembershipRule;
    coupon?: Coupon;
}
