# Database Lore: The Backbone of Pakaja

> **Status:** Active Reference
> **Last Updated:** 2026-01-30
> **System:** PostgreSQL (via Supabase)

## 1. Design Philosophy
The Pakaja database is designed with a **Hybrid Schema** approach. Instead of over-normalizing every relationship (which can lead to complex joins and slow queries for a PWA), we use:

1.  **Strong Relations** for Core Entities: `skus`, `transactions`, `customers` are highly structured relational tables because they are query-heavy.
2.  **JSON Bunkers** for Complexity: Complex, variable structures like `orders.items` (which contain toppings, variants, and snapshot prices) or `menu_items.ingredients` (recipes) are stored as JSONB. This allows the application to evolve its product structure without constant database migrations.

### The "Single Truth" Principle
All stock movements—whether a sale, a wastage report, or a restocking event—are flattened into a single `transactions` table. This allows us to calculate the "Current Stock" at any point in time by simply summing `quantity` (positive for IN, negative for OUT) for a given SKU.

---

## 2. Complete Initialization Script
**Copy and paste this entire block into the Supabase SQL Editor to set up your database instantly.**

```sql
-- 1. CLEANUP (Use cautiously)
-- DROP TABLE IF EXISTS transactions, orders, skus, menu_items, menu_categories, customers, 
-- membership_rules, customer_coupons, attendance, storage_units, app_settings, 
-- deleted_transactions, branches, todos, task_templates, sales_records;

-- 2. CORE INVENTORY & MENU --------------------------------------------------

CREATE TABLE IF NOT EXISTS skus (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    dietary TEXT,
    pieces_per_packet INTEGER DEFAULT 1,
    "order" INTEGER DEFAULT 0,
    is_deep_freezer_item BOOLEAN DEFAULT false,
    cost_price NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "order" INTEGER DEFAULT 0,
    color TEXT
);

CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    price NUMERIC DEFAULT 0,
    half_price NUMERIC,
    description TEXT,
    ingredients JSONB DEFAULT '[]'::jsonb,      -- Array of { skuId, quantity }
    half_ingredients JSONB DEFAULT '[]'::jsonb  -- Array of { skuId, quantity }
);

CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

-- 3. STORAGE & CONFIG -------------------------------------------------------

CREATE TABLE IF NOT EXISTS storage_units (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capacity_litres INTEGER DEFAULT 0,
    type TEXT DEFAULT 'DEEP_FREEZER',
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB
);

-- 4. TRANSACTIONS & SALES ---------------------------------------------------

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    batch_id TEXT,
    date TEXT,                           -- YYYY-MM-DD
    timestamp BIGINT,
    branch_id TEXT,
    sku_id TEXT,
    type TEXT,                           -- CHECK_OUT, CHECK_IN, WASTE, RESTOCK
    quantity_pieces INTEGER,
    user_id TEXT,
    user_name TEXT,
    image_urls JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    branch_id TEXT,
    platform TEXT,                       -- POS, ZOMATO, SWIGGY
    total_amount NUMERIC,
    status TEXT,                         -- COMPLETED, CANCELLED
    date TEXT,
    timestamp BIGINT,
    payment_method TEXT,
    items JSONB DEFAULT '[]'::jsonb,     -- Array of sold items
    custom_amount NUMERIC,
    custom_amount_reason TEXT,
    custom_sku_items JSONB,
    custom_sku_reason TEXT,
    payment_split JSONB
);

CREATE TABLE IF NOT EXISTS sales_records (
    id TEXT PRIMARY KEY,
    date TEXT,
    platform TEXT,
    total_sales NUMERIC,
    net_sales NUMERIC,
    orders_count INTEGER,
    image_url TEXT,
    parsed_data JSONB
);

-- 5. CRM & LOYALTY ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT,
    phone_number TEXT UNIQUE,
    total_spend NUMERIC DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    joined_at TEXT,
    last_order_date TEXT
);

CREATE TABLE IF NOT EXISTS membership_rules (
    id TEXT PRIMARY KEY,
    trigger_order_count INTEGER,
    type TEXT,                           -- DISCOUNT_PERCENT, FREE_ITEM
    value TEXT,
    description TEXT,
    time_frame_days INTEGER,
    validity_days INTEGER,
    min_order_value NUMERIC,
    reward_variant TEXT
);

CREATE TABLE IF NOT EXISTS customer_coupons (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    rule_id TEXT,
    code TEXT,
    status TEXT,                         -- ACTIVE, REDEEMED, EXPIRED
    redeemed_order_id TEXT,
    created_at BIGINT,
    expires_at BIGINT,
    redeemed_at BIGINT
);

-- 6. STAFF & OPERATIONS -----------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    code TEXT,
    role TEXT,                         -- ADMIN, MANAGER, STAFF
    permissions JSONB DEFAULT '[]'::jsonb,
    default_branch_id TEXT,
    default_page TEXT,
    is_ledger_auditor BOOLEAN DEFAULT false,
    is_staged_attendance_enabled BOOLEAN DEFAULT false,
    staged_attendance_config JSONB,
    staged_attendance_progress JSONB
);

CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    branch_id TEXT,
    date TEXT,
    timestamp BIGINT,
    image_url TEXT
);

CREATE TABLE IF NOT EXISTS task_templates (
    id TEXT PRIMARY KEY,
    title TEXT,
    assigned_to TEXT,
    assigned_by TEXT,
    frequency TEXT,                      -- DAILY, WEEKLY
    week_days JSONB,                     -- Array of numbers [1, 2]
    month_days JSONB,
    start_date TEXT,
    last_generated_date TEXT,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    text TEXT,
    is_completed BOOLEAN DEFAULT false,
    assigned_to TEXT,
    assigned_by TEXT,
    created_at BIGINT,
    completed_at BIGINT,
    due_date TEXT,
    template_id TEXT
);

-- 7. ARCHIVES ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS deleted_transactions (
    id TEXT PRIMARY KEY,
    batch_id TEXT,
    date TEXT,
    timestamp BIGINT,
    sku_id TEXT,
    branch_id TEXT,
    type TEXT,
    quantity_pieces INTEGER,
    user_id TEXT,
    user_name TEXT,
    image_urls JSONB,
    deleted_at TIMESTAMPTZ,
    deleted_by TEXT
);

-- 8. SECURITY (RLS) ---------------------------------------------------------
ALTER TABLE skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_transactions ENABLE ROW LEVEL SECURITY;

-- 9. SEED DATA (Essential Settings) -----------------------------------------
INSERT INTO app_settings (key, value)
VALUES 
  ('enable_attendance_webhook', 'false'::jsonb),
  ('attendance_webhook_url', '""'::jsonb),
  ('enable_attendance_webhook_debug', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

DO $$ 
DECLARE t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Enable access to all users" ON %I', t);
        EXECUTE format('CREATE POLICY "Enable access to all users" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;
```

---

## 3. Schema Reference

### 1. `skus` (Raw Inventory Items)
*Defines the raw materials tracked in the system (e.g., "Frozen Veg Momos").*

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (Primary Key) | Unique ID (e.g., `sku-123`) |
| `name` | `TEXT` | Display Name |
| `category` | `TEXT` | Enum: `Steam`, `Fried`, `Kurkure`, etc. |
| `dietary` | `TEXT` | `Veg`, `Non-Veg`, `N/A` |
| `pieces_per_packet` | `INTEGER` | Quantity of pieces in one bag |
| `order` | `INTEGER` | Sort order for UI |
| `is_deep_freezer_item` | `BOOLEAN` | If `true`, this item is tracked in Deep Freezer stock logic |
| `cost_price` | `NUMERIC` | Cost per packet |

### 2. `menu_items` (Sellable Products)
*Defines what is sold on the POS. Includes the "Recipe" in JSON format.*

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (Primary Key) | Unique ID (e.g., `menu-1`) |
| `name` | `TEXT` | Product Name (e.g., "Veg Steam Full") |
| `category` | `TEXT` | Menu Category |
| `price` | `NUMERIC` | Selling Price (Full Plate) |
| `half_price` | `NUMERIC` | Selling Price (Half Plate) |
| `description` | `TEXT` | Optional text |
| `ingredients` | `JSONB` | **Array** of Full Plate Ingredients |
| `half_ingredients` | `JSONB` | **Array** of Half Plate Ingredients |

**`ingredients` JSON Structure:**
```json
[
  { "skuId": "sku-1", "quantity": 10 }
]
```

### 3. `menu_categories`
*Categories for the POS Menu.*

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (Primary Key) | Unique ID |
| `name` | `TEXT` | Category Name |
| `order` | `INTEGER` | Sort Order |
| `color` | `TEXT` | Hex Code (e.g., `#ef4444`) |

### 4. `transactions` (Inventory Ledger)
*Immutable log of every stock movement.*

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (Primary Key) | Unique Transaction ID |
| `batch_id` | `TEXT` | Group ID for bulk actions |
| `date` | `TEXT` | ISO Date `YYYY-MM-DD` |
| `timestamp` | `BIGINT` | Epoch Milliseconds |
| `branch_id` | `TEXT` | Source/Dest Branch |
| `sku_id` | `TEXT` | Reference to `skus.id` |
| `type` | `TEXT` | `CHECK_OUT`, `CHECK_IN`, `WASTE`, `RESTOCK` |
| `quantity_pieces` | `INTEGER` | Positive integer (logic handles sign) |
| `user_id` | `TEXT` | User who performed action |
| `user_name` | `TEXT` | User Name snapshot |
| `image_urls` | `JSONB` | Array of image URL strings (Evidence) |

### 5. `orders` (Sales)
*POS Sales records.*

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (Primary Key) | Unique Order ID |
| `customer_id` | `TEXT` | Reference to `customers.id` (Nullable) |
| `customer_name` | `TEXT` | Name Snapshot |
| `customer_phone` | `TEXT` | Phone Snapshot |
| `branch_id` | `TEXT` | Store ID |
| `platform` | `TEXT` | `POS`, `ZOMATO`, `SWIGGY` |
| `total_amount` | `NUMERIC` | Final Bill Amount |
| `status` | `TEXT` | `COMPLETED`, `CANCELLED` |
| `date` | `TEXT` | ISO Date `YYYY-MM-DD` |
| `timestamp` | `BIGINT` | Epoch Milliseconds |
| `payment_method` | `TEXT` | `CASH`, `UPI`, `CARD`, `SPLIT` |
| `items` | `JSONB` | **Array** of Sold Items |
| `custom_amount` | `NUMERIC` | Ad-hoc charge amount |
| `custom_amount_reason`| `TEXT` | Reason for ad-hoc charge |
| `custom_sku_items` | `JSONB` | Ad-hoc SKU consumption |
| `custom_sku_reason` | `TEXT` | Reason |
| `payment_split` | `JSONB` | If method is `SPLIT`, details here |

**`items` JSON Structure:**
```json
[
  {
    "menuItemId": "menu-1",
    "name": "Veg Steam",
    "price": 100,
    "quantity": 1,
    "variant": "FULL", // 'FULL' or 'HALF'
    "consumed": [ { "skuId": "sku-1", "quantity": 10 } ]
  }
]
```

### 6. `customers` (CRM)

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (Primary Key) | Unique ID |
| `name` | `TEXT` | Customer Name |
| `phone_number` | `TEXT` | Primary Key / Unique Identifier |
| `total_spend` | `NUMERIC` | Lifetime Value |
| `order_count` | `INTEGER` | Total Orders Placed |
| `joined_at` | `TEXT` | ISO Date |
| `last_order_date` | `TEXT` | ISO Date |

### 7. `membership_rules` (Loyalty Config)

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (Primary Key) | Rule ID |
| `trigger_order_count` | `INTEGER` | E.g. `5` for "Every 5th Order" |
| `type` | `TEXT` | `DISCOUNT_PERCENT`, `FREE_ITEM` |
| `value` | `TEXT` or `NUMERIC` | `20` (Percent) or `menu-id` (Item) |
| `description` | `TEXT` | UI Text |
| `reward_variant` | `TEXT` | `FULL` or `HALF` (For Free Items) |

### 8. `customer_coupons` (Loyalty State)

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (Primary Key) | Coupon ID |
| `customer_id` | `TEXT` | Owner |
| `rule_id` | `TEXT` | Source Rule |
| `code` | `TEXT` | Visible Code |
| `status` | `TEXT` | `ACTIVE`, `REDEEMED`, `EXPIRED` |
| `redeemed_order_id` | `TEXT` | Order where it was used |
| `created_at` | `BIGINT` | Epoch ms |
| `expires_at` | `BIGINT` | Epoch ms |
| `redeemed_at` | `BIGINT` | Epoch ms |

### 9. `users` (Staff Profiles)

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (Primary Key) | User ID |
| `name` | `TEXT` | Display Name |
| `code` | `TEXT` | Login Code |
| `role` | `TEXT` | `ADMIN`, `MANAGER`, `STAFF` |
| `permissions` | `JSONB` | Array of permission strings |
| `is_staged_attendance_enabled` | `BOOLEAN` | Toggle for staged flow |
| `staged_attendance_progress` | `JSONB` | Saved draft of partial attendance |

### 10. `attendance`

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (Primary Key) | Record ID |
| `user_id` | `TEXT` | Staff ID |
| `user_name` | `TEXT` | Name Snapshot |
| `branch_id` | `TEXT` | Location |
| `date` | `TEXT` | `YYYY-MM-DD` |
| `timestamp` | `BIGINT` | Epoch ms |
| `image_url` | `TEXT` | Selfie URL |

### 10. `storage_units`

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (Primary Key) | ID |
| `name` | `TEXT` | "Deep Freezer 1" |
| `capacity_litres` | `INTEGER` | Volume |
| `type` | `TEXT` | `DEEP_FREEZER`, `FRIDGE` |
| `is_active` | `BOOLEAN` | |

### 11. `app_settings`
*Key-Value store for global configuration.*

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `key` | `TEXT` (Primary Key) | Setting Key |
| `value` | `JSONB` | Value (Typed in App) |

### 12. `branches`

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (Primary Key) | Branch ID |
| `name` | `TEXT` | Branch Name |

### 13. `todos` (Task Management)

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (Primary Key) | Task ID |
| `text` | `TEXT` | Task Description |
| `is_completed` | `BOOLEAN` | Status |
| `assigned_to` | `TEXT` | User ID |
| `template_id` | `TEXT` | Source Template ID |
| `due_date` | `TEXT` | ISO Date |

### 14. `task_templates` (Recurring Tasks)

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (Primary Key) | Template ID |
| `title` | `TEXT` | Task Title |
| `frequency` | `TEXT` | `DAILY`, `WEEKLY`, etc. |
| `week_days` | `JSONB` | Array of day numbers |
| `is_active` | `BOOLEAN` | Enable/Disable |

### 15. `sales_records` (External Sales Logs)

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` (Primary Key) | Record ID |
| `date` | `TEXT` | ISO Date |
| `platform` | `TEXT` | `ZOMATO`, `SWIGGY`, `POS` |
| `total_sales` | `NUMERIC` | Gross Sales |
| `orders_count` | `INTEGER` | Number of orders |

---

## 4. Archive Data (Soft Deletes)

### 16. `deleted_transactions`
*Archive table for auditing deletions. Keeps the same structure as `transactions`.*

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `deleted_at` | `TIMESTAMPTZ` | When it was deleted |
| `deleted_by` | `TEXT` | Who deleted it |

---

## 🔍 Validation Script
Run this in Supabase SQL Editor to verify your current schema matches this document.

```sql
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
ORDER BY table_name, ordinal_position;
```

## 🔐 Row Level Security (RLS)
By default, the application runs with a unified Policy.
*   **Policy Name:** "Enable access to all users"
*   **Definition:** `USING (true) WITH CHECK (true)`
