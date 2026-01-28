
-- Add bill_url column to ledger_entries table
alter table ledger_entries 
add column if not exists bill_url text;

-- Add index just in case we need to query entries with bills later? Not strictly necessary but efficient.
-- create index if not exists idx_ledger_entries_bill_url on ledger_entries(bill_url);
