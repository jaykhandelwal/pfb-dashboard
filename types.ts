
export enum TransactionType {
  CHECK_OUT = 'CHECK_OUT', // Freezer -> Branch
  CHECK_IN = 'CHECK_IN',    // Branch -> Freezer (Returns)
  WASTE = 'WASTE',          // Branch -> Trash (Loss)
  RESTOCK = 'RESTOCK',      // Supplier -> Freezer (Incoming Stock)
  ADJUSTMENT = 'ADJUSTMENT' // Manual Correction (Stocktake)
}

export enum SKUCategory {
  STEAM = 'Steam',
  KURKURE = 'Kurkure',
  ROLL = 'Roll',
  WHEAT = 'Wheat',
  CONSUMABLES = 'Consumables'
}

export enum SKUDietary {
  VEG = 'Veg',
  NON_VEG = 'Non-Veg',
  NA = 'N/A'
}

export interface SKU {
  id: string;
  name: string;
  category: SKUCategory; // e.g. Steam, Kurkure
  dietary: SKUDietary;   // e.g. Veg, Non-Veg
  piecesPerPacket: number; // Inventory unit size
  order: number; // For custom sorting
}

// New: Recipe/Ingredient definition
export interface MenuIngredient {
  skuId: string;
  quantity: number; // Number of pieces used
}

// New: Centralized Menu Categories
export interface MenuCategory {
  id: string;
  name: string;
  order: number;
  color?: string; // Hex code for UI tagging
}

// Updated: Sellable Products (Menu)
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  halfPrice?: number; // Optional: Price for half plate
  description?: string;
  category?: string; // New: Menu Category (e.g. Steam, Fried, Drinks)
  ingredients: MenuIngredient[]; // Full Plate Recipe
  halfIngredients?: MenuIngredient[]; // Optional: Half Plate Recipe (Overrides 0.5x logic)
}

export interface Branch {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  batchId: string; // Group ID for multiple items saved together
  date: string; // ISO Date string YYYY-MM-DD
  timestamp: number;
  skuId: string;
  branchId: string; // For RESTOCK, this can be 'FRIDGE' or null
  type: TransactionType;
  quantityPieces: number; // Raw count of momos
  imageUrls?: string[]; // Optional: Array of Base64 strings of wastage photos
  userId?: string; // ID of the user who performed the action
  userName?: string; // Name of the user at the time of action
}

export interface ArchivedTransaction extends Transaction {
  deletedAt: string; // ISO Date of deletion
  deletedBy: string; // Name of user who deleted it
}

// --- Attendance ---

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  branchId: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  imageUrl?: string;
}

export type AttendanceOverrideType = 'HOLIDAY' | 'ABSENT' | 'PENALTY_2_DAYS';

export interface AttendanceOverride {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  type: AttendanceOverrideType;
  note?: string;
}

// --- Sales & Reconciliation ---

// Strict platforms only
export type SalesPlatform = 'POS' | 'ZOMATO' | 'SWIGGY';

// This table is for SKU Consumption (Inventory View) - Derived from Orders now
export interface SalesRecord {
  id: string;
  orderId?: string; // Optional link back to financial order
  date: string;
  branchId: string;
  platform: SalesPlatform;
  skuId: string;
  quantitySold: number; // In pieces/plates
  timestamp: number;
  customerId?: string; // Optional link to a customer
  orderAmount?: number; // Snapshot of value for this specific line item (optional)
}

// New: Full Order Structure (Revenue View)
export interface OrderItem {
  id: string; // Random ID
  menuItemId: string; // Link to MenuItem
  name: string; // Snapshot of name
  price: number; // Snapshot of price
  quantity: number;
  variant?: 'FULL' | 'HALF'; // New: Variant tracking
  
  // SNAPSHOT: The ingredients consumed by this specific item at the time of order
  consumed?: { 
    skuId: string; 
    quantity: number 
  }[];
}

export interface PaymentSplit {
  method: 'CASH' | 'UPI' | 'CARD';
  amount: number;
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
  paymentSplit?: PaymentSplit[]; // Breakdown if SPLIT
  date: string;
  timestamp: number;
  items: OrderItem[]; // Stored as JSONB in DB usually

  // Custom additions (Order Level)
  customAmount?: number;
  customAmountReason?: string;
  
  // Updated: Allow multiple custom SKUs per order
  customSkuItems?: { skuId: string; quantity: number }[];
  customSkuReason?: string;
}

export interface DailyReportItem {
  skuName: string;
  category: SKUCategory;
  dietary: SKUDietary;
  taken: number;
  returned: number;
  waste: number;
  sold: number; // Net consumption (Taken - Returned - Waste)
}

export interface DashboardStats {
  totalPiecesSold: number;
  topSellingSku: string;
  returnRate: number;
  branchPerformance: Record<string, number>; // BranchID -> Pieces Sold
}

// --- Customer & Membership ---

export interface Customer {
  id: string;
  name: string;
  phoneNumber: string;
  totalSpend: number;
  orderCount: number;
  joinedAt: string; // ISO Date
  lastOrderDate: string; // ISO Date
}

export type MembershipRewardType = 'DISCOUNT_PERCENT' | 'FREE_ITEM';

export interface MembershipRule {
  id: string;
  triggerOrderCount: number; // e.g. 5th order, 10th order
  type: MembershipRewardType;
  value: string | number; // e.g. 20 (percent) or 'menu-item-id' (Menu Item ID)
  description: string;
  timeFrameDays?: number; // Optional: "Within 30 days" (Legacy)
  validityDays?: number; // New: Offer expires X days after previous order
  
  // New Fields
  minOrderValue?: number; // Minimum cart amount required
  rewardVariant?: 'FULL' | 'HALF'; // Only for FREE_ITEM type
}

export interface CustomerCoupon {
  id: string;
  customerId: string;
  ruleId: string; // Link to MembershipRule
  status: 'ACTIVE' | 'USED' | 'EXPIRED';
  expiresAt: string; // ISO Date
  createdAt: string; // ISO Date
}

export interface RewardResult {
  coupon: CustomerCoupon;
  rule: MembershipRule;
  status: 'ACTIVE' | 'EXPIRED';
  daysLeft?: number;
}

// --- Auth & User Management ---

export type Role = 'ADMIN' | 'MANAGER' | 'STAFF';

export type Permission = 
  | 'VIEW_DASHBOARD'
  | 'VIEW_ANALYTICS' 
  | 'MANAGE_OPERATIONS'
  | 'MANAGE_INVENTORY'
  | 'MANAGE_WASTAGE'
  | 'MANAGE_SKUS'
  | 'MANAGE_BRANCHES'
  | 'MANAGE_USERS'
  | 'VIEW_LOGS'
  | 'MANAGE_RECONCILIATION'
  | 'VIEW_ORDERS'
  | 'MANAGE_CUSTOMERS'
  | 'MANAGE_MEMBERSHIP'
  | 'MANAGE_MENU'
  | 'MANAGE_SETTINGS' // New permission for App Settings
  | 'MANAGE_TASKS' // New permission for full task management
  | 'MANAGE_ATTENDANCE';

export interface User {
  id: string;
  name: string;
  code: string; // Changed from 'pin' to 'code' to support alphanumeric
  role: Role;
  permissions: Permission[];
  defaultBranchId?: string; // Optional default location for this user
  defaultPage?: string; // Optional default page after login
}

// Global App Settings
export interface AppSettings {
  require_customer_phone: boolean;
  require_customer_name: boolean;
  enable_beta_tasks: boolean;
  enable_whatsapp_webhook: boolean; 
  whatsapp_webhook_url: string; 
  debug_whatsapp_webhook: boolean; // New Debug Feature
  [key: string]: any; // Extensible
}

// --- Todo / Task Management ---

export type TaskFrequency = 'ONCE' | 'DAILY' | 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY';

export interface TaskTemplate {
  id: string;
  title: string;
  assignedTo: string; // User ID
  assignedBy: string; // User Name
  frequency: TaskFrequency;
  
  // Logic Config
  weekDays?: number[]; // 0=Sun, 1=Mon, etc. (For WEEKLY)
  monthDays?: number[]; // [1, 15] for Bi-Monthly, or [1] for Monthly
  startDate?: string; // YYYY-MM-DD (Anchor date for Bi-Weekly calculation)
  
  isActive: boolean;
  lastGeneratedDate?: string; // YYYY-MM-DD
}

export interface Todo {
  id: string;
  text: string;
  assignedTo: string; // userId
  assignedBy: string; // userName
  isCompleted: boolean;
  createdAt: number;
  completedAt?: number;
  
  // New Fields for Enhanced Tasks
  dueDate?: string; // YYYY-MM-DD
  templateId?: string; // Link to parent template
  priority?: 'NORMAL' | 'HIGH';
}

// Add global window extension for Android Bridge
declare global {
  interface Window {
    PAKAJA_AUTH_CODE?: string;
  }
}