
# 🗄️ Database Architecture & Schema Documentation

This document details the database structure for the **Pakaja Inventory System**. 

> **Status:** Verified against Supabase Schema (Active).

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