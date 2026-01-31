-- Create transaction_logs table for operational auditing
create table if not exists public.transaction_logs (
    id text primary key,
    batch_id text,
    action text not null, -- 'DELETE', 'CREATE', etc.
    performed_by text not null,
    performed_by_name text,
    snapshot jsonb,
    date text not null,
    timestamp bigint not null
);

-- Enable RLS
alter table public.transaction_logs enable row level security;

-- Policies
create policy "Enable read access for authenticated users" on transaction_logs
    for select using (auth.role() = 'authenticated');

create policy "Enable insert for authenticated users" on transaction_logs
    for insert with check (auth.role() = 'authenticated');
