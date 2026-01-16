
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
