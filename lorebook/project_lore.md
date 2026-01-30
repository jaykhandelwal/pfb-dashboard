# Project Lore: Pakaja Inventory & Analytics System

> **Version:** 1.0.0
> **Last Updated:** 2026-01-30
> **Scope:** Full Project Documentation for AI & Developers

## 1. Project Identity & Purpose
**Pakaja Inventory & Analytics System** is a specialized Progressive Web App (PWA) designed for managing high-volume, small-footprint food retail operations (specifically Momo/Food Carts). Unlike generic POS systems, it focuses heavily on **Stock Tracking (down to the ingredient level)**, **Wastage Control**, and **Operations Management** (managing stock movement between deep freezers and mobile carts).

### Core Philosophy
*   **Inventory-First:** Sales are secondary to stock truth. The system tracks items moving from *Supplier* -> *Deep Freezer* -> *Mobile Cart* -> *Sale/Waste*.
*   **Granular Consumption:** Selling a "Plate of Momos" automatically deduces raw stock (e.g., 10 pieces of "Frozen Veg Momos") based on recipes.
*   **Operational Rigor:** Enforces daily "Check-Out" (taking stock to cart) and "Check-In" (returning unsold stock) procedures to calculate precise daily variance.

---

## 2. Technical Architecture

### Tech Stack
*   **Frontend Framework:** React 19 (Vite)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **State Management:** React Context (`StoreContext` for data, `AuthContext` for user session).
*   **Persistence:** 
    *   **Primary:** Supabase (PostgreSQL)
    *   **Offline/Local:** LocalStorage (for resilience and speed).
*   **Icons:** Lucide React
*   **Charts:** ApexCharts (via `react-apexcharts`)
*   **AI Engine:** Google Gemini (`@google/genai`) for daily summaries and anomaly detection.
*   **File Storage:** BunnyCDN (for Wastage and Attendance photos).
*   **Routing:** React Router v7 (`react-router-dom`) with HashRouter.

### Key Directories
*   `src/components`: UI components (Layout, Cards, Modals).
*   `src/context`: Global state providers.
*   `src/pages`: Feature-specific logic (Dashboard, Orders, Inventory).
*   `src/services`: External API wrappers (`geminiService`, `bunnyStorage`, `supabaseClient`).
*   `src/types.ts`: TypeScript interfaces defining the Domain Model.
*   `src/constants.ts`: Static configuration and initial data seeds.

---

## 3. Data Domain & Business Logic

### 3.1. Entity Relationships
1.  **SKU (Stock Keeping Unit):** The raw physical item (e.g., "Frozen Veg Momos Packet - 50pc").
    *   *Properties:* `piecesPerPacket`, `dietary` (Veg/Non-Veg), `category` (Steam, Kurkure, etc.).
2.  **Menu Item:** The product sold to the customer (e.g., "Veg Steam Full Plate").
    *   *Recipe Link:* A Menu Item contains `ingredients` (List of `{ skuId, quantity }`).
    *   *Example:* Selling 1 "Veg Steam Full Plate" triggers the consumption of 10 pieces of "Veg Steam SKU".
    *   *Variants:* Supports "Half Plates" with distinct ingredient mappings (`halfIngredients`).
3.  **Storage Unit:** Physical containers (Deep Freezers) with defined capacity (Litres). Used for Stock Ordering calculations.
4.  **Transaction:** The immutable record of stock movement.
    *   Types: `RESTOCK` (Supplier In), `CHECK_OUT` (Freezer to Cart), `CHECK_IN` (Cart to Freezer), `WASTE` (Spoiled), `ADJUSTMENT` (Correction).
    *   *Crucial:* Daily "Sold" count is derived from `CheckOut - CheckIn - Waste`.
5.  **Order:** A point-of-sale event.
    *   Tracks `paymentMethod` (Cash/UPI/Card/Split), `platform` (POS/Zomato/Swiggy).
    *   Updates Customer `totalSpend` and `orderCount`.

### 3.2. User Roles & Permissions
*   **Admin:** Full access (`ALL_PERMISSIONS`).
*   **Manager:** Can manage operations, inventory, expenses, but limited sensitive settings.
*   **Staff:** Restricted to Daily Operations (Check-In/Out), Attendance, and basic Orders.
*   *Access Control:* Alphanumeric Access Codes.

### 3.3. Ledger & Financials (Beta)
The Ledger feature provides a unified system for tracking non-POS financial transactions with a robust, ID-based architecture for data integrity.

*   **Core Entity:** `LedgerEntry`
    *   **Structure:** Stores both ID and Name for critical fields (`categoryId`/`category`, `paymentMethodId`/`paymentMethod`, `sourceAccountId`/`sourceAccount`).
    *   **Entry Types:**
        *   `INCOME`: Money coming in (e.g., Catering Advance).
        *   `EXPENSE`: Money going out (e.g., Rent, Vegetables).
        *   `REIMBURSEMENT`: Internal transfers or paying back users. Requires `sourceAccount` (From) and `destinationAccount` (To).
    *   **Evidence:** Supports photo uploads for bills/receipts (stored in BunnyCDN).

*   **User Expense & Balance Tracking:**
    *   **Logic:** The system tracks how much is owed to users who pay for expenses out-of-pocket.
    *   **Formula:** `Net Owed = (Total Expenses Paid by User) - (Total Reimbursements Received by User)`.
    *   **No Granular Linking:** Reimbursements are not linked to specific expenses; they simply reduce the user's aggregate "Owed" balance.

*   **Configuration Entities (Ledger Settings):**
    *   **Categories:** ID-based definitions (e.g., Rent, Utilities). Supports inline renaming and active/inactive toggling.
    *   **Payment Methods:** ID-based methods (Cash, UPI, Card). Fully editable.
    *   **Payment Accounts (`LedgerAccount`):** Represents the source/destination of funds.
        *   *Types:* `USER` (Auto-synced from System Users) and `CUSTOM` (e.g., "Company Account", "Safe").
        *   *Sync Logic:* System users are automatically merged.

*   **Audit & Logs:**
    *   Immutable `LedgerLog` recorded for EVERY action (Create, Update, Delete, Approve, Reject).
    *   **Snapshots:** Stores the *entire* `LedgerEntry` object at the time of action.

*   **Access Control:**
    *   Restricted to `ADMIN` role with specific `MANAGE_LEDGER` permission.
    *   "Ledger Auditor" role for approving staff transactions.

---

## 4. Key Algorithms & Automations

### 4.1. "Smart" Stock Ordering
The system recommends Restock quantities based on a sophisticated multi-factor heuristic (found in `StockOrdering.tsx`):
1.  **Lead Time:** Calculates days until "Expected Arrival".
2.  **Velocity:** Calculates 7-day burn rate (from Sales) and 90-day volume (from **Transactions/Consumption**).
3.  **Weighted Demand:** Blends 90-day (60%) and 7-day (40%) usage. **Critical:** If 7-day rate is severely suppressed (< 50% of 90-day), uses 90-day only.
4.  **Unified Data:** Generator now shares the exact same 90-day history source (**Transactions**) as the Page Recommendations to ensure consistency.
5.  **Popularity Boost:** "Top Seller" status now uses **90-day history** (was 30d) to ensure OOS items don't lose their status. Top 20% get +15% safety buffer.
6.  **Trend Multiplier:** FLATTENED multipliers (max 1.05x up, 0.95x down) to prevent short-term trends from destabilizing the order mix.
7.  **OOS & Shortfall:** Strong ADDITIVE boost (+50% for OOS, +25% for Shortfall) prioritizes proven demand recovery.
8.  **Safety Stock:** Each SKU targets a 3-day minimum safety buffer.
9.  **Bootstrap Mode:** Minimal allocation (weight 0.20) for new OOS items. This prevents "phantom demand" from diluting the share of proven, high-volume items.
9.  **Capacity Constraint:** Calculates "True Free Space" in configured Deep Freezers (Litres).
10. **Allocation:** Distributes free space to SKUs proportional to their Weighted Demand.
11. **Smart Fill:** Unused capacity is distributed proportionally across all items (not just top seller).

### 4.2. Loyalty Engine
*   **Triggers:** Order Count milestones (e.g., "Every 5th Order").
*   **Rewards:** 
    *   `DISCOUNT_PERCENT`: Percentage off bill.
    *   `FREE_ITEM`: Specific Menu Item (free).
*   **Lifecycle:** Order Placed -> Rule Checked -> Coupon Generated -> Coupon Redeemed on future order.

### 4.3. Automated Reporting
*   **Daily Report:** Calculates `Taken (CheckOut) - Returned (CheckIn) - Waste = Consumption`. compares `Consumption` vs `Sold (POS)` to find Variance.
*   **AI Summary:** Gemini analyzes the daily stats to generate a narrative summary (e.g., "High wastage in Paneer Momos today").

---

## 5. Operational Workflows

### 5.1. The Daily Cycle
1.  **Morning Check-Out:** Staff takes bags from Deep Freezer to the Cart.
    *   *Action:* create `CHECK_OUT` transactions.
2.  **Sales Operations:** Staff punches orders on POS.
    *   *Action:* create `Order` records.
    *   *Logic:* Deduct ingredients virtually for "Current Cart Stock" view.
3.  **Wastage Reporting:** Staff reports dropped/spoiled items.
    *   *Action:* create `WASTE` transaction + Upload Photo to BunnyCDN.
4.  **End-of-Day Check-In:** Staff returns unsold bags to Deep Freezer.
    *   *Action:* create `CHECK_IN` transactions.
5.  **Reconciliation:** Manager views the "End of Day" report.
    *   *Match:* `(Opening + CheckOut - CheckIn - Waste)` should equal `Sales`.

### 5.2. Transaction Logs
*   **Unified View:** Combines all transaction types (CheckIn, CheckOut, Waste, etc.) into a single, cohesive list.
*   **Sorting Modes:** 
    *   `FOR_DATE`: Groups by Operational Date (Default).
    *   `LOGGED_ON`: Sorts strictly by timestamp of entry.
*   **Visual Indicators:** Red highlighting used exclusively for "Missing Return" (Check-out without corresponding Check-in).

### 5.3. Attendance
*   **Check-In:** Staff takes a selfie.
*   **Storage:** Image uploaded to BunnyCDN (`/attendance` folder).
*   **Timestamp:** Logged for payroll accuracy.

---

## 6. System Resiliency & Updates

### 6.1. Auto-Update System
*   **Versioning:** `vite.config.ts` injects a build timestamp into `sw.js` during production build.
*   **Detection:** Service Worker detects new version, installs in background, and prompts user via `UpdateNotification`.
*   **Form Preservation:** 
    *   Before update, `formPreservation.ts` saves all inputs/textareas to `localStorage`.
    *   After reload, data is automatically restored to the fields to prevent data loss.
    *   *TTL:* Saved data expires after 5 minutes.

---

## 7. External Service Integration

### 7.1. BunnyCDN
*   **Purpose:** High-performance storage for evidence photos (Wastage/Attendance).
*   **Structure:**
    *   Zone: `pakaja`
    *   Folders: `/wastage`, `/attendance`, `/ledger`

### 7.2. Google Gemini
*   **Model:** `gemini-1.5-flash` (implied by typical usage, code says `gemini-pro` or similar - check generic usage).
*   **Usage:** Generates text summaries of tabular data for the Dashboard.

### 7.3. Supabase
*   **Tables:** `skus`, `menu_items`, `transactions`, `orders`, `customers`, `coupons`, `users`, `storage_units`.
*   **Security:** RLS (Row Level Security) enabled.

---

## 8. Configuration Variables (`.env`)
*   `VITE_SUPABASE_URL`: DB Endpoint.
*   `VITE_SUPABASE_ANON_KEY`: Public API Key.
*   `API_KEY`: Google Gemini API Key.
*   `VITE_BUNNY_STORAGE_KEY`: CDN Auth.
*   `VITE_BUNNY_STORAGE_ZONE`: CDN Zone Name.
*   `VITE_BUNNY_PULL_ZONE`: Public URL Base.
