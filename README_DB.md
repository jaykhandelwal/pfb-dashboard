
# 🗄️ Database Architecture & Schema Documentation

This document details the database structure for the **Pakaja Inventory System**. 

> **Status:** Verified against Supabase Schema (Active).

---

## 🛠️ Complete SQL Migration Script (Loyalty & Coupons)

**Copy and Run the entire block below in Supabase SQL Editor.**
This script is "idempotent" — it is safe to run even if you have already created some tables or ran previous versions. It ensures your database is perfectly synced with the app.

```sql
-- ==========================================
-- 1. SCHEMA PREPARATION (Safe Columns & Tables)
-- ==========================================

-- A. Ensure 'validity_days' exists in 'membership_rules'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_rules' AND column_name = 'validity_days') THEN
        ALTER TABLE membership_rules ADD COLUMN validity_days INTEGER DEFAULT 365;
    END IF;
    -- New Columns for Enhanced Coupons
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_rules' AND column_name = 'min_order_value') THEN
        ALTER TABLE membership_rules ADD COLUMN min_order_value NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_rules' AND column_name = 'reward_variant') THEN
        ALTER TABLE membership_rules ADD COLUMN reward_variant TEXT DEFAULT 'FULL';
    END IF;
END $$;

-- B. Create Coupons Table (if not exists)
CREATE TABLE IF NOT EXISTS customer_coupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id TEXT, -- References customers.id (Phone Number)
    rule_id TEXT,     -- References membership_rules.id
    status TEXT DEFAULT 'ACTIVE', -- Options: 'ACTIVE', 'USED', 'EXPIRED'
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- C. Enable Security (RLS) for Coupons
ALTER TABLE customer_coupons ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customer_coupons' AND policyname = 'Enable access to all users'
  ) THEN
    CREATE POLICY "Enable access to all users" ON customer_coupons FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ==========================================
-- 2. AUTOMATION LOGIC (The Brain)
-- ==========================================

-- Clean up old versions to ensure fresh logic
DROP TRIGGER IF EXISTS on_order_created_loyalty ON orders;
DROP FUNCTION IF EXISTS handle_new_order_loyalty;

-- Create the Logic Function
CREATE OR REPLACE FUNCTION handle_new_order_loyalty() 
RETURNS TRIGGER AS $$
DECLARE
    v_current_count INTEGER;
    v_next_count INTEGER;
    v_max_cycle INTEGER;
    v_cycle_pos INTEGER;
    v_rule_id TEXT;
    v_validity_days INTEGER;
    v_customer_exists BOOLEAN;
BEGIN
    -- A. Update Customer Stats
    SELECT EXISTS(SELECT 1 FROM customers WHERE id = NEW.customer_id) INTO v_customer_exists;

    IF v_customer_exists THEN
        UPDATE customers 
        SET order_count = order_count + 1, 
            total_spend = total_spend + NEW.total_amount,
            last_order_date = NEW.date
        WHERE id = NEW.customer_id
        RETURNING order_count INTO v_current_count;
    ELSE
        -- Auto-create customer if missing (Edge case protection)
        INSERT INTO customers (id, name, phone_number, order_count, total_spend, last_order_date, joined_at)
        VALUES (NEW.customer_id, NEW.customer_name, NEW.customer_id, 1, NEW.total_amount, NEW.date, NOW())
        RETURNING order_count INTO v_current_count;
    END IF;

    -- B. Calculate Next Milestone (The coupon is for the NEXT visit)
    v_next_count := v_current_count + 1;

    -- C. Determine Cycle Position
    SELECT MAX(trigger_order_count) INTO v_max_cycle FROM membership_rules;
    
    IF v_max_cycle IS NOT NULL AND v_max_cycle > 0 THEN
        v_cycle_pos := v_next_count % v_max_cycle;
        -- Handle modulo 0 (e.g. 10 % 10 = 0, should be 10)
        IF v_cycle_pos = 0 THEN v_cycle_pos := v_max_cycle; END IF;

        -- D. Find Matching Rule
        SELECT id, validity_days INTO v_rule_id, v_validity_days 
        FROM membership_rules 
        WHERE trigger_order_count = v_cycle_pos 
        LIMIT 1;

        -- E. Generate Coupon
        IF v_rule_id IS NOT NULL THEN
            INSERT INTO customer_coupons (customer_id, rule_id, status, expires_at)
            VALUES (
                NEW.customer_id, 
                v_rule_id, 
                'ACTIVE', 
                NOW() + (COALESCE(v_validity_days, 365) || ' days')::INTERVAL
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the Trigger
CREATE TRIGGER on_order_created_loyalty
AFTER INSERT ON orders
FOR EACH ROW
WHEN (NEW.customer_id IS NOT NULL)
EXECUTE FUNCTION handle_new_order_loyalty();

-- ==========================================
-- 3. EXTERNAL API ENDPOINTS (RPC)
-- ==========================================

-- Function for Android App to fetch coupons simply
-- Drops old version first to update return signature
DROP FUNCTION IF EXISTS get_available_coupons;

CREATE OR REPLACE FUNCTION get_available_coupons(phone_number TEXT)
RETURNS TABLE (
  coupon_id TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  reward_type TEXT,
  reward_value TEXT,
  description TEXT,
  min_order_value NUMERIC,
  reward_variant TEXT,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.id,
    cc.status,
    cc.expires_at,
    mr.type,
    mr.value,
    mr.description,
    mr.min_order_value,
    mr.reward_variant,
    cc.created_at
  FROM customer_coupons cc
  JOIN membership_rules mr ON cc.rule_id = mr.id
  WHERE cc.customer_id = phone_number
    AND cc.status = 'ACTIVE'
    AND (cc.expires_at IS NULL OR cc.expires_at > NOW())
  ORDER BY cc.created_at ASC; -- Oldest first
END;
$$;
```

---

## 📊 Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    BRANCHES ||--o{ TRANSACTIONS : "log inventory movement"
    BRANCHES ||--o{ ORDERS : "generate revenue"
    BRANCHES ||--o{ SALES_RECORDS : "manual sales entry"
    BRANCHES ||--o{ ATTENDANCE : "staff location"
    
    SKUS ||--o{ TRANSACTIONS : "item moved"
    SKUS ||--o{ SALES_RECORDS : "item sold"
    
    MENU_ITEMS }|--|{ SKUS : "recipe ingredients (JSON)"
    MENU_CATEGORIES ||--o{ MENU_ITEMS : "categorizes"
    
    CUSTOMERS ||--o{ ORDERS : "places"
    CUSTOMERS ||--o{ CUSTOMER_COUPONS : "owns"
    MEMBERSHIP_RULES ||--o{ CUSTOMER_COUPONS : "defines"
    
    USERS ||--o{ TRANSACTIONS : "performed by"
    USERS ||--o{ ATTENDANCE : "checks in"
    USERS ||--o{ TODOS : "assigned to"
    TASK_TEMPLATES ||--o{ TODOS : "generates"
    
    %% Table Definitions
    BRANCHES { string id PK, string name }
    SKUS { string id PK, string name, int pieces_per_packet }
    TRANSACTIONS { string id PK, string type, int quantity_pieces }
    ORDERS { string id PK, jsonb items, numeric total_amount }
    TODOS { string id PK, string text, boolean is_completed, string due_date }
    TASK_TEMPLATES { string id PK, string frequency, boolean is_active }
    APP_SETTINGS { string key PK, jsonb value }
    CUSTOMER_COUPONS { uuid id PK, string status, timestamptz expires_at }
```

---

## 📦 1. Inventory & Operations

### `skus`
Raw materials managed in the fridge.
- `id` (text, PK): Unique ID (e.g., `sku-1`).
- `name` (text): Display name.
- `category` (text): 'Steam', 'Kurkure', etc.
- `dietary` (text): 'Veg', 'Non-Veg'.
- `pieces_per_packet` (int): Conversion factor.
- `order` (int): Sort order.
- `created_at` (timestamptz).

### `branches`
Physical store locations.
- `id` (text, PK).
- `name` (text).
- `created_at` (timestamptz).

### `transactions`
The core ledger for physical inventory movement (Check-in/out, Waste).
- `id` (text, PK).
- `batch_id` (text): Group ID for bulk actions.
- `date` (text): YYYY-MM-DD.
- `timestamp` (bigint).
- `branch_id` (text): FK to `branches`.
- `sku_id` (text): FK to `skus`.
- `type` (text): 'CHECK_OUT', 'CHECK_IN', 'WASTE', 'RESTOCK', 'ADJUSTMENT'.
- `quantity_pieces` (int).
- `image_urls` (ARRAY text): For wastage evidence.
- `user_id` (text): Snapshot of user ID.
- `user_name` (text): Snapshot of user Name.
- `created_at` (timestamptz).

### `deleted_transactions`
Audit log for deleted records.
- Same structure as `transactions`.
- `deleted_at` (timestamptz).
- `deleted_by` (text).

---

## 💰 2. Sales & Menu

### `orders`
The Single Source of Truth for revenue.
- `id` (text, PK).
- `branch_id` (text).
- `customer_id` (text): FK to `customers`.
- `customer_name` (text).
- `platform` (text): 'POS', 'ZOMATO', 'SWIGGY'.
- `total_amount` (numeric).
- `status` (text).
- `payment_method` (text): 'CASH', 'UPI', 'CARD', 'SPLIT'.
- `payment_split` (jsonb): Array of `{ method: string, amount: number }` for split payments.
- `date` (text).
- `timestamp` (bigint).
- `items` (jsonb): **Crucial.** Contains the snapshot of ingredients consumed.
- `custom_amount` (numeric): Extra charges.
- `custom_amount_reason` (text).
- `custom_sku_items` (jsonb): Array of raw SKUs used manually.
- `custom_sku_reason` (text).
- `created_at` (timestamptz).

### `sales_records`
*Used primarily for Manual Entries in the Reconciliation Page.*
- `id` (text, PK).
- `date` (text).
- `branch_id` (text).
- `platform` (text).
- `sku_id` (text).
- `quantity_sold` (int).
- `timestamp` (bigint).
- `customer_id` (text).
- `order_amount` (numeric).
- `order_id` (text): Optional link to parent order.
- `created_at` (timestamptz).

### `menu_items`
- `id` (text, PK).
- `name` (text).
- `price` (numeric).
- `half_price` (numeric).
- `description` (text).
- `category` (text).
- `ingredients` (jsonb): Full plate recipe `[{skuId, quantity}]`.
- `half_ingredients` (jsonb): Half plate recipe.
- `created_at` (timestamptz).

### `menu_categories`
- `id` (text, PK).
- `name` (text).
- `order` (int).
- `color` (text).
- `created_at` (timestamptz).

---

## 👥 3. Users & CRM

### `users`
- `id` (text, PK).
- `name` (text).
- `code` (text): Login access code.
- `role` (text): 'ADMIN', 'MANAGER', 'STAFF'.
- `permissions` (text[]): List of access rights.
- `default_branch_id` (text): For attendance convenience.

### `attendance`
- `id` (text, PK).
- `user_id` (text).
- `user_name` (text).
- `branch_id` (text).
- `date` (text).
- `timestamp` (bigint).
- `image_url` (text): Selfie proof.
- `created_at` (timestamptz).

### `customers`
- `id` (text, PK): Phone Number.
- `name` (text).
- `phone_number` (text).
- `total_spend` (numeric).
- `order_count` (int).
- `joined_at` (timestamptz).
- `last_order_date` (text).

### `membership_rules`
- `id` (text, PK).
- `trigger_order_count` (int).
- `type` (text): 'DISCOUNT_PERCENT' | 'FREE_ITEM'.
- `value` (text).
- `description` (text).
- `time_frame_days` (int).
- `validity_days` (int).
- `min_order_value` (numeric). **(New)**
- `reward_variant` (text). **(New)**
- `created_at` (timestamptz).

### `customer_coupons` (New)
Stores active rewards generated by the trigger.
- `id` (uuid, PK).
- `customer_id` (text): FK to customers.
- `rule_id` (text): FK to membership_rules.
- `status` (text): 'ACTIVE', 'USED', 'EXPIRED'.
- `expires_at` (timestamptz).
- `created_at` (timestamptz).

---

## ✅ 4. Tasks (Enhanced)

### `task_templates` (New)
Defines auto-repeating tasks.
- `id` (text, PK).
- `title` (text).
- `assigned_to` (text).
- `assigned_by` (text).
- `frequency` (text): 'DAILY', 'WEEKLY', 'ONCE'.
- `week_days` (jsonb): Array of integers [0-6] for weekly recurrence.
- `is_active` (boolean).
- `last_generated_date` (text): Tracks execution to prevent dupes.
- `created_at` (timestamptz).

### `todos` (Updated)
- `id` (text, PK).
- `text` (text).
- `assigned_to` (text): FK to `users.id`.
- `assigned_by` (text).
- `is_completed` (boolean).
- `due_date` (text): YYYY-MM-DD. **(New)**
- `template_id` (text): Link to parent template. **(New)**
- `priority` (text): 'NORMAL' | 'HIGH'. **(New)**
- `created_at_ts` (bigint).
- `completed_at_ts` (bigint).
- `created_at` (timestamptz).

---

## ⚙️ 5. System Configuration

### `app_settings`
Global flags for app behavior.
- `key` (text, PK): e.g., 'require_customer_phone'.
- `value` (jsonb): e.g., true, false, or config object.
- `created_at` (timestamptz).
