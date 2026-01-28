
-- Create Ledger Logs table
create table if not exists ledger_logs (
  id text primary key,
  ledger_entry_id text not null,
  action text not null, -- 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT'
  performed_by text not null,
  performed_by_name text,
  snapshot jsonb, -- Stores the full state of the entry at that time
  date text,
  timestamp bigint
);

-- Add index/constraints if needed
create index if not exists idx_ledger_logs_entry_id on ledger_logs(ledger_entry_id);
create index if not exists idx_ledger_logs_timestamp on ledger_logs(timestamp desc);

-- RLS Policies (Optional but recommended)
alter table ledger_logs enable row level security;

create policy "Enable read access for all users" on ledger_logs for select using (true);
create policy "Enable insert access for authenticated users" on ledger_logs for insert with check (auth.role() = 'authenticated');
