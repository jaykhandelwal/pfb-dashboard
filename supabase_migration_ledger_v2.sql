-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- 1. Ensure ledger_entries has necessary columns for Approval Workflow
alter table if exists ledger_entries 
add column if not exists status text default 'PENDING',
add column if not exists approved_by text,
add column if not exists rejected_reason text,
add column if not exists bill_urls text[], -- Array of strings for multiples
add column if not exists linked_expense_ids text[];

-- 2. Create ledger_logs table if it doesn't exist (for Audit History)
create table if not exists ledger_logs (
    id text primary key, -- We use text to support both UUIDs and legacy IDs
    ledger_entry_id text not null,
    action text not null, -- 'CREATE', 'UPDATE', 'APPROVE', 'REJECT'
    performed_by text,
    performed_by_name text,
    snapshot jsonb, -- Stores the full state of the entry at that time
    date text,
    timestamp bigint,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Update RLS policies (Optional but recommended)
-- Allow Authenticated users to view/create
alter table ledger_entries enable row level security;
alter table ledger_logs enable row level security;

create policy "Enable read access for authenticated users" on ledger_entries for select using (auth.role() = 'authenticated');
create policy "Enable insert for authenticated users" on ledger_entries for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on ledger_entries for update using (auth.role() = 'authenticated');
create policy "Enable delete for authenticated users" on ledger_entries for delete using (auth.role() = 'authenticated');

create policy "Enable read access for authenticated users" on ledger_logs for select using (auth.role() = 'authenticated');
create policy "Enable insert for authenticated users" on ledger_logs for insert with check (auth.role() = 'authenticated');
