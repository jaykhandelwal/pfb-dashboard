
# Pakaja Inventory & Analytics System

A comprehensive inventory management PWA (Progressive Web App) designed for Momo/Food carts. This application handles stock tracking, daily operations (check-in/check-out), wastage reporting, staff attendance, sales reconciliation, and customer loyalty.

## 🚀 Features

*   **Dashboard**: Real-time view of fridge inventory and last checkout status across branches.
*   **POS & Order Entry**: Full-featured Point of Sale interface to create orders, link customers, and track revenue directly within the app.
*   **Operations**: Streamlined interface for Staff to Check-Out (take stock to cart) and Return (bring stock back) items.
*   **Wastage Reporting**: Camera-integrated reporting system to log spoiled items. Evidence photos are stored in the `wastage/` folder on BunnyCDN.
*   **Inventory Management**: Admin interface to add restock (incoming from supplier) and perform stocktakes (adjustments).
*   **Sales Reconciliation**: Compare physical inventory usage against reported sales from POS, Zomato, and Swiggy.
*   **CRM & Loyalty**: Track customer purchase history automatically. **Coupons are auto-generated** based on order milestones.
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

## 🔌 Database Integration & Triggers

To enable the "Set and Forget" loyalty system, you must run the following SQL in your Supabase SQL Editor. This sets up the automatic coupon generation logic.

### 1. Create Core Tables

```sql
-- Existing tables (ensure these exist)
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT,
    phone_number TEXT,
    total_spend NUMERIC DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_order_date TEXT
);

CREATE TABLE IF NOT EXISTS membership_rules (
    id TEXT PRIMARY KEY,
    trigger_order_count INTEGER,
    type TEXT, -- 'DISCOUNT_PERCENT' or 'FREE_ITEM'
    value TEXT, 
    description TEXT,
    validity_days INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: Coupon Table for Android/Web consumption
CREATE TABLE IF NOT EXISTS customer_coupons (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    customer_id TEXT REFERENCES customers(id),
    rule_id TEXT REFERENCES membership_rules(id),
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'USED', 'EXPIRED'
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE customer_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable access to all users" ON customer_coupons FOR ALL USING (true) WITH CHECK (true);
```

### 2. Create the Logic Trigger (The Brain)

This trigger runs *automatically* whenever a new order is inserted into the `orders` table. It handles the math so your apps don't have to.

```sql
-- Function to handle loyalty logic on new order
CREATE OR REPLACE FUNCTION handle_new_order_loyalty() 
RETURNS TRIGGER AS $$
DECLARE
    curr_count INTEGER;
    next_count INTEGER;
    max_cycle INTEGER;
    cycle_pos INTEGER;
    rule_record RECORD;
    expiry_date TIMESTAMPTZ;
BEGIN
    -- 1. Update Customer Stats
    UPDATE customers 
    SET order_count = order_count + 1, 
        total_spend = total_spend + NEW.total_amount,
        last_order_date = NEW.date
    WHERE id = NEW.customer_id
    RETURNING order_count INTO curr_count;

    -- If customer didn't exist (edge case), create them
    IF curr_count IS NULL THEN
        INSERT INTO customers (id, name, phone_number, order_count, total_spend, last_order_date)
        VALUES (NEW.customer_id, NEW.customer_name, NEW.customer_id, 1, NEW.total_amount, NEW.date)
        RETURNING 1 INTO curr_count;
    END IF;

    -- 2. Calculate Next Target
    next_count := curr_count + 1;

    -- 3. Determine Cyclical Position
    SELECT MAX(trigger_order_count) INTO max_cycle FROM membership_rules;
    
    IF max_cycle IS NOT NULL AND max_cycle > 0 THEN
        cycle_pos := next_count % max_cycle;
        IF cycle_pos = 0 THEN cycle_pos := max_cycle; END IF;

        -- 4. Check for Matching Rule
        SELECT * INTO rule_record FROM membership_rules WHERE trigger_order_count = cycle_pos LIMIT 1;

        -- 5. If Rule Found, Create Coupon
        IF rule_record IS NOT NULL THEN
            -- Calculate expiry (Default 1 year if not set)
            expiry_date := NOW() + (COALESCE(rule_record.validity_days, 365) || ' days')::INTERVAL;

            INSERT INTO customer_coupons (customer_id, rule_id, status, expires_at)
            VALUES (NEW.customer_id, rule_record.id, 'ACTIVE', expiry_date);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach Trigger to Orders Table
DROP TRIGGER IF EXISTS on_order_created_loyalty ON orders;
CREATE TRIGGER on_order_created_loyalty
AFTER INSERT ON orders
FOR EACH ROW
WHEN (NEW.customer_id IS NOT NULL)
EXECUTE FUNCTION handle_new_order_loyalty();
```

---

## 📱 Android Integration: The "Lazy" Way

Thanks to the trigger above, the Android app logic is now extremely simple. You no longer need to calculate cycles or order counts.

### 1. Fetching Coupons
When a user is added to the cart, simply query the `customer_coupons` table.

```sql
SELECT * FROM customer_coupons 
WHERE customer_id = 'PHONE_NUMBER' 
  AND status = 'ACTIVE' 
  AND expires_at > NOW();
```

*   If rows are returned, the customer has rewards available.
*   Display them to the cashier.

### 2. Redeeming Coupons
When the cashier applies a coupon to the cart, store the `coupon_id`.
When the order is successfully placed, update that coupon status.

```sql
-- Run this when order is successful
UPDATE customer_coupons 
SET status = 'USED' 
WHERE id = 'THE_COUPON_ID';
```

*(Note: The `orders` insert will trigger the generation of the NEXT coupon automatically)*

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
