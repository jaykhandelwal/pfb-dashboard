
-- 19. DELETED TRANSACTIONS TABLE
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
DO $$ BEGIN
    -- Enable RLS for security
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'deleted_transactions' AND policyname = 'Enable access to all users'
    ) THEN
        EXECUTE 'ALTER TABLE deleted_transactions ENABLE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY "Enable access to all users" ON deleted_transactions FOR ALL USING (true) WITH CHECK (true)';
    END IF;
END $$;

-- 20. VERIFICATION SCRIPT (Run this to check your Column Names)
-- Copy and run this in Supabase SQL Editor to see exactly what columns exist
/*
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_schema = 'public' 
ORDER BY 
    table_name, 
    ordinal_position;
*/

-- 21. ENABLE DECIMALS FOR COST PRICE
-- Run this to allow decimal values (e.g., 10.50) in the Cost Price column.
-- By default, it might be an INTEGER which would round your values.
ALTER TABLE skus ALTER COLUMN cost_price TYPE numeric;
