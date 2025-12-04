
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

// Updated: Sellable Products (Menu)
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  ingredients: MenuIngredient[]; // List of SKUs and quantities needed
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

// --- Sales & Reconciliation ---

// Strict platforms only
export type SalesPlatform = 'POS' | 'ZOMATO' | 'SWIGGY';

export interface SalesRecord {
  id: string;
  date: string;
  branchId: string;
  platform: SalesPlatform;
  skuId: string;
  quantitySold: number; // In pieces/plates
  timestamp: number;
  customerId?: string; // Optional link to a customer
  orderAmount?: number; // Snapshot of value for this specific line item (optional)
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
  value: string | number; // e.g. 20 (percent) or 'sku-1' (item ID)
  description: string;
  timeFrameDays?: number; // Optional: "Within 30 days"
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
  | 'MANAGE_CUSTOMERS' // New
  | 'MANAGE_MEMBERSHIP' // New
  | 'MANAGE_MENU'; // New

export interface User {
  id: string;
  name: string;
  code: string; // Changed from 'pin' to 'code' to support alphanumeric
  role: Role;
  permissions: Permission[];
}

// Add global window extension for Android Bridge
declare global {
  interface Window {
    PAKAJA_AUTH_CODE?: string;
  }
}
