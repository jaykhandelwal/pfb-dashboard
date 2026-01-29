
-- Add missing columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS default_branch_id text,
ADD COLUMN IF NOT EXISTS default_page text DEFAULT '/dashboard',
ADD COLUMN IF NOT EXISTS is_ledger_auditor boolean DEFAULT false;

-- Add comments for clarity
COMMENT ON COLUMN users.default_branch_id IS 'ID of the branch pre-selected for the user';
COMMENT ON COLUMN users.default_page IS 'The landing page for the user after login';
COMMENT ON COLUMN users.is_ledger_auditor IS 'Whether the user can approve/reject ledger entries';
