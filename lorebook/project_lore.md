# Project Lore: Pakaja Inventory & Analytics System

> **Version:** 1.0.0
> **Last Updated:** 2026-01-18
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

---

## 4. Key Algorithms & Automations

### 4.1. "Smart" Stock Ordering
The system recommends Restock quantities based on a sophisticated multi-factor heuristic (found in `StockOrdering.tsx`):
1.  **Lead Time:** Calculates days until "Expected Arrival".
2.  **Velocity:** Calculates 7-day burn rate (recency) and 90-day volume (stability).
3.  **Weighted Demand:** Blends 90-day (60% weight) and 7-day (40% weight) usage.
4.  **Popularity Boost:** "Top Seller" items (top 20% by order freq) get a +15% safety buffer.
5.  **Trend Multiplier:** Upward trends get mild boost (up to 1.15x), downward trends get reduction (0.90x).
6.  **OOS & Shortfall:** Uses ADDITIVE boost (not multiplicative) - OOS adds 20% of base demand, shortfall adds up to 15%.
7.  **Safety Stock:** Each SKU targets a 3-day minimum safety buffer at current burn rate.
8.  **Bootstrap Mode:** On first-time use, OOS items with no history get meaningful base allocation (1.5 weight vs 0.5 for stocked items).
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

### 5.2. Attendance
*   **Check-In:** Staff takes a selfie.
*   **Storage:** Image uploaded to BunnyCDN (`/attendance` folder).
*   **Timestamp:** Logged for payroll accuracy.

---

## 6. External Service Integration

### 6.1. BunnyCDN
*   **Purpose:** High-performance storage for evidence photos (Wastage/Attendance).
*   **Structure:**
    *   Zone: `pakaja`
    *   Folders: `/wastage`, `/attendance`

### 6.2. Google Gemini
*   **Model:** `gemini-1.5-flash` (implied by typical usage, code says `gemini-pro` or similar - check generic usage).
*   **Usage:** Generates text summaries of tabular data for the Dashboard.

### 6.3. Supabase
*   **Tables:** `skus`, `menu_items`, `transactions`, `orders`, `customers`, `coupons`, `users`, `storage_units`.
*   **Security:** RLS (Row Level Security) enabled.

---

## 7. Configuration Variables (`.env`)
*   `VITE_SUPABASE_URL`: DB Endpoint.
*   `VITE_SUPABASE_ANON_KEY`: Public API Key.
*   `API_KEY`: Google Gemini API Key.
*   `VITE_BUNNY_STORAGE_KEY`: CDN Auth.
*   `VITE_BUNNY_STORAGE_ZONE`: CDN Zone Name.
*   `VITE_BUNNY_PULL_ZONE`: Public URL Base.
