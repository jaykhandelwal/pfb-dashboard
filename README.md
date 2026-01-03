

# Pakaja Inventory & Analytics System

A comprehensive inventory management PWA (Progressive Web App) designed for Momo/Food carts. This application handles stock tracking, daily operations (check-in/check-out), wastage reporting, staff attendance, sales reconciliation, and customer loyalty.

## 🚀 Features

*   **Dashboard**: Real-time view of fridge inventory and last checkout status across branches.
*   **POS & Order Entry**: Full-featured Point of Sale interface to create orders, link customers, and track revenue directly within the app.
*   **Operations**: Streamlined interface for Staff to Check-Out (take stock to cart) and Return (bring stock back) items.
*   **Wastage Reporting**: Camera-integrated reporting system to log spoiled items. Evidence photos are stored in the `wastage/` folder on BunnyCDN.
*   **Inventory Management**: Admin interface to add restock (incoming from supplier) and perform stocktakes (adjustments).
*   **Sales Reconciliation**: Compare physical inventory usage against reported sales from POS, Zomato, and Swiggy.
*   **CRM & Loyalty**: Track customer purchase history automatically and manage membership rewards (Discounts/Freebies). Customers are uniquely identified by their **Phone Number**.
*   **Menu Management**: Define recipes linked to raw SKUs to automate consumption calculations based on sales. Supports **Half Plates** with explicit recipe definitions.
*   **Staff Attendance**: Selfie-based check-in system for staff with location tagging context. Selfies are stored in the `attendance/` folder on BunnyCDN.
*   **Analytics**: Visual charts for consumption, category splits, variance reports, and wastage trends.
*   **AI Insights**: Integrated with **Google Gemini 2.5 Flash** to provide daily operational summaries and anomaly detection.
*   **User Management**: Role-based access control (Admin, Manager, Staff) with secure alphanumeric access codes.

## 🛠 Tech Stack

*   **Frontend**: React 19, TypeScript
*   **Styling**: Tailwind CSS
*   **Icons**: Lucide React
*   **Charts**: Recharts
*   **AI**: @google/genai SDK
*   **State Management**: React Context API + LocalStorage persistence
*   **Storage**: BunnyCDN (Separated folders: `/wastage` and `/attendance`)
*   **Database**: Supabase (PostgreSQL)

---

## ⚙️ Logic Configuration (Hardcoded)

Certain operational logic is hardcoded for performance and simplicity. If you need to change **Plate Sizes** (used to calculate approximate sales in the Returns view), edit the following file:

**File:** `src/pages/Operations.tsx`

**Function:** `getPlateSize`

```typescript
// To change plate sizes, update the return values below:
const getPlateSize = (sku: SKU) => {
    // Priority 1: Category Defaults (Hardcoded)
    if (sku.category === SKUCategory.STEAM) return 8;   // Change 8 to new size
    if (sku.category === SKUCategory.KURKURE) return 6; // Change 6 to new size
    if (sku.category === SKUCategory.ROLL) return 2;    // Change 2 to new size
    
    // Priority 2: Menu Lookup (Fallback)
    // ...
};
```

---

## 🔌 Database Integration (Single Table Architecture)

We use a simplified **Single Table** approach for Orders. Inventory consumption is stored as a "Snapshot" inside the Order JSON itself. This avoids the need for complex database triggers or multiple API calls.

### 1. Database Schema Setup

Run this in your Supabase SQL Editor to create the necessary table.

```sql
-- 1. Create the ORDERS table (Single Source of Truth)
-- We use TEXT for id to support the frontend's offline ID generator
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    customer_id TEXT,             -- Linked to customers table
    customer_name TEXT,
    platform TEXT NOT NULL,       -- 'POS', 'ZOMATO', 'SWIGGY'
    total_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'COMPLETED',
    payment_method TEXT DEFAULT 'CASH', -- Can be 'CASH', 'UPI', 'CARD'
    date TEXT NOT NULL,           -- YYYY-MM-DD
    timestamp BIGINT NOT NULL,
    items JSONB DEFAULT '[]'::jsonb, -- Stores the Menu Item AND Ingredients Snapshot
    
    -- Custom Additions
    custom_amount NUMERIC DEFAULT 0,
    custom_amount_reason TEXT,
    custom_sku_items JSONB DEFAULT '[]'::jsonb, -- Stores array of { skuId, quantity }
    custom_sku_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update MENU_ITEMS table
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS half_price NUMERIC;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS half_ingredients JSONB DEFAULT '[]'::jsonb;

-- 3. Indexes & RLS
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable access to all users" ON orders FOR ALL USING (true) WITH CHECK (true);
```

---

## 📱 Payload Examples for Android Developer

Use these JSON payloads when sending data to the `orders` table via Supabase REST API or SDK. 

**Note:** The keys below use `snake_case` (e.g., `branch_id`, `custom_amount`) matching the database columns.

### 🚨 CRITICAL: Inventory Consumption Logic
The Android app **MUST** calculate the `consumed` array for every item before sending it to Supabase. 
1. Fetch the `menu_items` table.
2. Read the `ingredients` JSON for the selected item.
3. Multiply ingredient quantities by the order quantity.
4. Attach this list as the `consumed` property in the payload.

**If `consumed` is missing or null, the web dashboard will not be able to track inventory deductions.**

### Scenario 1: Standard Order
*2 Plates of Veg Steam Momos (No custom extras) paid via UPI*

```json
{
  "id": "android-unique-id-101",
  "branch_id": "branch-1",
  "platform": "POS",
  "date": "2024-03-22",
  "timestamp": 1711100000000,
  "payment_method": "UPI",  // Options: "CASH", "UPI", "CARD"
  "total_amount": 200, 
  "items": [
    {
      "id": "line-item-1",
      "menuItemId": "menu-veg-steam",
      "name": "Veg Steam Full Plate",
      "price": 100,
      "quantity": 2,
      "variant": "FULL",
      
      // ---------------------------------------------------------
      // IMPORTANT: This array is mandatory for inventory tracking
      // ---------------------------------------------------------
      "consumed": [
        { "skuId": "sku-1", "quantity": 20 } 
      ]
    }
  ]
}
```

### Scenario 2: Order with Custom Amount
*Standard Order + ₹50 Delivery Charge*

```json
{
  "id": "android-unique-id-102",
  "branch_id": "branch-1",
  "platform": "POS",
  "payment_method": "CASH",
  "total_amount": 250, // (Item Total 200 + Custom 50)
  "custom_amount": 50,
  "custom_amount_reason": "Delivery Charge",
  "items": [
    {
      "menuItemId": "menu-veg-steam",
      "price": 100,
      "quantity": 2,
      "consumed": [{ "skuId": "sku-1", "quantity": 20 }]
    }
  ]
}
```

### Scenario 3: Order with Custom Raw Items
*Standard Order + Staff Meal (Uses Inventory, No extra cost)*

```json
{
  "id": "android-unique-id-103",
  "branch_id": "branch-1",
  "platform": "POS",
  "payment_method": "CASH",
  "total_amount": 200, // Price is only for the Menu Item
  "custom_sku_items": [
      { "skuId": "sku-2", "quantity": 10 },
      { "skuId": "sku-12", "quantity": 1 }
  ],
  "custom_sku_reason": "Staff Meal (Ramesh)",
  "items": [
    {
      "menuItemId": "menu-veg-steam",
      "price": 100,
      "quantity": 2,
      "consumed": [{ "skuId": "sku-1", "quantity": 20 }]
    }
  ]
}
```

### Scenario 4: Complex Order
*Includes Custom Amount AND Multiple Raw Items*

```json
{
  "id": "android-unique-id-104",
  "branch_id": "branch-1",
  "platform": "ZOMATO",
  "payment_method": "ONLINE", // Or "CASH" if COD
  "total_amount": 150, // (100 Item + 50 Packaging)
  
  // Custom Money
  "custom_amount": 50,
  "custom_amount_reason": "Extra Packaging Fee",

  // Custom Inventory Usage
  "custom_sku_items": [
     { "skuId": "sku-10", "quantity": 2 }, // Extra Mayo
     { "skuId": "sku-9", "quantity": 2 }   // Extra Chutney
  ],
  "custom_sku_reason": "Customer requested extra sauce",

  "items": [
    {
      "menuItemId": "menu-veg-steam",
      "price": 100,
      "quantity": 1,
      "consumed": [{ "skuId": "sku-1", "quantity": 10 }]
    }
  ]
}
```

---

## 📦 Setup & Installation

1.  **Clone the repository**
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Environment**:
    Create a `.env` file in the root directory:
    ```env
    API_KEY=your_google_gemini_api_key
    
    # Supabase (Optional for Database)
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_key

    # BunnyCDN (For Wastage/Attendance Images)
    VITE_BUNNY_STORAGE_KEY=your_storage_password
    VITE_BUNNY_STORAGE_ZONE=pakaja
    VITE_BUNNY_PULL_ZONE=https://your-zone.b-cdn.net
    ```
4.  **Run Development Server**:
    ```bash
    npm run dev
    ```

## 🔐 Default Access

*   **User**: Admin
*   **Access Code**: `admin`

## 📂 Project Structure

*   `/components`: Reusable UI components.
*   `/context`: Global state (AuthContext, StoreContext).
*   `/pages`: Main application views (Operations, Orders, Wastage, Dashboard, etc.).
*   `/types`: TypeScript interfaces.
*   `/services`: API integrations.

## 🤖 AI Features

The **Gemini Analyst** (found in Dashboard) and **Vision Tools** (Reconciliation) help with:
1.  **Consumption Data**: Compares sales vs. returns.
2.  **Vision Analysis**: Parses screenshots of Zomato/Swiggy reports into data.
3.  **Trends**: Highlights top-selling categories.

Ensure `process.env.API_KEY` is set to enable these features.