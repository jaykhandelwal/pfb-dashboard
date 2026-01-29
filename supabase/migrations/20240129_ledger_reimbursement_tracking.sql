-- Add reimbursement tracking columns
ALTER TABLE ledger_entries
ADD COLUMN IF NOT EXISTS reimbursement_status text DEFAULT 'N/A',
ADD COLUMN IF NOT EXISTS linked_expense_ids text[];

-- Add comments
COMMENT ON COLUMN ledger_entries.reimbursement_status IS 'Status: PENDING (awaiting reimbursement), REIMBURSED (paid back), N/A (not applicable)';
COMMENT ON COLUMN ledger_entries.linked_expense_ids IS 'Array of expense entry IDs that this reimbursement covers';
