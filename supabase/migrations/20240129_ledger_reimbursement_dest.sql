-- Add destination account columns for Reimbursement transfers
ALTER TABLE ledger_entries
ADD COLUMN IF NOT EXISTS destination_account text,
ADD COLUMN IF NOT EXISTS destination_account_id text;

-- Add comment explaining usage
COMMENT ON COLUMN ledger_entries.destination_account IS 'Name of the destination account for transfers/reimbursements';
COMMENT ON COLUMN ledger_entries.destination_account_id IS 'ID of the destination account for transfers/reimbursements';
