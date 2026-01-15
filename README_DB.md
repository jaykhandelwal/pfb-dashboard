
# 🗄️ Database Architecture & Schema Documentation

This document details the database structure for the **Pakaja Inventory System**. 

> **Status:** Verified against Supabase Schema (Active).

---

## 🛠️ Master Schema Sync Script (Run this to fix missing columns)

If you suspect any feature is broken due to a missing column, run this entire block in the Supabase SQL Editor. It checks every table and adds any missing columns required by the latest version of the app.

```sql
-- ============================================================
-- MASTER SCHEMA SYNC SCRIPT
-- RUN THIS TO ENSURE ALL TABLES AND COLUMNS EXIST
-- ============================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, code TEXT, role TEXT, permissions JSONB);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'default_branch_id') THEN
        ALTER TABLE users ADD COLUMN default_branch_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'default_page') THEN
        ALTER TABLE users ADD COLUMN default_page TEXT;
    END IF;
END $$;

-- 2. BRANCHES TABLE
CREATE TABLE IF NOT EXISTS branches (id TEXT PRIMARY KEY, name TEXT);

-- 3. SKUS TABLE
CREATE TABLE IF NOT EXISTS skus (id TEXT PRIMARY KEY, name TEXT, category TEXT, dietary TEXT, pieces_per_packet INTEGER, "order" INTEGER);

-- 4. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, batch_id TEXT, date TEXT, timestamp BIGINT, sku_id TEXT, branch_id TEXT, type TEXT, quantity_pieces INTEGER, user_id TEXT, user_name TEXT);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'image_urls') THEN
        ALTER TABLE transactions ADD COLUMN image_urls JSONB;
    END IF;
    -- Legacy support for single image
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'image_url') THEN
        ALTER TABLE transactions ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- 5. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, branch_id TEXT, customer_id TEXT, customer_name TEXT, platform TEXT, total_amount NUMERIC, status TEXT, date TEXT, timestamp BIGINT, items JSONB);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_method') THEN
        ALTER TABLE orders ADD COLUMN payment_method TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_split') THEN
        ALTER TABLE orders ADD COLUMN payment_split JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'custom_amount') THEN
        ALTER TABLE orders ADD COLUMN custom_amount NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'custom_amount_reason') THEN
        ALTER TABLE orders ADD COLUMN custom_amount_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'custom_sku_items') THEN
        ALTER TABLE orders ADD COLUMN custom_sku_items JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'custom_sku_reason') THEN
        ALTER TABLE orders ADD COLUMN custom_sku_reason TEXT;
    END IF;
END $$;

-- 6. MENU ITEMS TABLE
CREATE TABLE IF NOT EXISTS menu_items (id TEXT PRIMARY KEY, name TEXT, price NUMERIC, description TEXT, category TEXT, ingredients JSONB);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'half_price') THEN
        ALTER TABLE menu_items ADD COLUMN half_price NUMERIC;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'half_ingredients') THEN
        ALTER TABLE menu_items ADD COLUMN half_ingredients JSONB;
    END IF;
END $$;

-- 7. MENU CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS menu_categories (id TEXT PRIMARY KEY, name TEXT, "order" INTEGER);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_categories' AND column_name = 'color') THEN
        ALTER TABLE menu_categories ADD COLUMN color TEXT;
    END IF;
END $$;

-- 8. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT, phone_number TEXT, total_spend NUMERIC, order_count INTEGER, joined_at TEXT, last_order_date TEXT);

-- 9. MEMBERSHIP RULES TABLE
CREATE TABLE IF NOT EXISTS membership_rules (id TEXT PRIMARY KEY, trigger_order_count INTEGER, type TEXT, value TEXT, description TEXT, time_frame_days INTEGER);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_rules' AND column_name = 'validity_days') THEN
        ALTER TABLE membership_rules ADD COLUMN validity_days INTEGER DEFAULT 365;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_rules' AND column_name = 'min_order_value') THEN
        ALTER TABLE membership_rules ADD COLUMN min_order_value NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_rules' AND column_name = 'reward_variant') THEN
        ALTER TABLE membership_rules ADD COLUMN reward_variant TEXT DEFAULT 'FULL';
    END IF;
END $$;

-- 10. CUSTOMER COUPONS TABLE
CREATE TABLE IF NOT EXISTS customer_coupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id TEXT,
    rule_id TEXT,
    status TEXT DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_coupons' AND column_name = 'redeemed_order_id') THEN
        ALTER TABLE customer_coupons ADD COLUMN redeemed_order_id TEXT;
    END IF;
END $$;

-- 11. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS attendance (id TEXT PRIMARY KEY, user_id TEXT, user_name TEXT, branch_id TEXT, date TEXT, timestamp BIGINT, image_url TEXT);

-- 12. TASK TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS task_templates (id TEXT PRIMARY KEY, title TEXT, assigned_to TEXT, assigned_by TEXT, frequency TEXT, is_active BOOLEAN, last_generated_date TEXT);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_templates' AND column_name = 'week_days') THEN
        ALTER TABLE task_templates ADD COLUMN week_days JSONB; -- Storing array as JSONB for safety
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_templates' AND column_name = 'month_days') THEN
        ALTER TABLE task_templates ADD COLUMN month_days JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_templates' AND column_name = 'start_date') THEN
        ALTER TABLE task_templates ADD COLUMN start_date TEXT;
    END IF;
END $$;

-- 13. TODOS TABLE
CREATE TABLE IF NOT EXISTS todos (id TEXT PRIMARY KEY, text TEXT, assigned_to TEXT, assigned_by TEXT, is_completed BOOLEAN, created_at_ts BIGINT);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'todos' AND column_name = 'completed_at_ts') THEN
        ALTER TABLE todos ADD COLUMN completed_at_ts BIGINT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'todos' AND column_name = 'due_date') THEN
        ALTER TABLE todos ADD COLUMN due_date TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'todos' AND column_name = 'template_id') THEN
        ALTER TABLE todos ADD COLUMN template_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'todos' AND column_name = 'priority') THEN
        ALTER TABLE todos ADD COLUMN priority TEXT;
    END IF;
END $$;

-- 14. APP SETTINGS TABLE
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value JSONB);

-- 15. SALES RECORDS TABLE (Legacy/Derived)
CREATE TABLE IF NOT EXISTS sales_records (id TEXT PRIMARY KEY, order_id TEXT, date TEXT, branch_id TEXT, platform TEXT, sku_id TEXT, quantity_sold INTEGER, timestamp BIGINT, customer_id TEXT, order_amount NUMERIC);

-- 16. STORAGE UNITS TABLE
CREATE TABLE IF NOT EXISTS storage_units (id TEXT PRIMARY KEY, name TEXT, capacity_litres NUMERIC, type TEXT, is_active BOOLEAN, created_at TIMESTAMPTZ);

-- 17. Enable RLS on all tables (Standard Security)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        
        -- Create a default "allow all" policy if none exists (for development speed)
        -- In strict production, you would define narrower policies.
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'Enable access to all users'
        ) THEN
            EXECUTE format('CREATE POLICY "Enable access to all users" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
        END IF;
    END LOOP;
END $$;

-- 18. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
CREATE INDEX IF NOT EXISTS idx_transactions_sku_id ON transactions (sku_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);

```

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
    
    ORDERS ||--o| CUSTOMER_COUPONS : "redeems (via coupon table)"
    
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
    CUSTOMER_COUPONS { uuid id PK, string status, timestamptz expires_at, text redeemed_order_id }
    STORAGE_UNITS { string id PK, string name, numeric capacity_litres }
```