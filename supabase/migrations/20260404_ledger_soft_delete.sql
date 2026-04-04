-- Preserve ledger rows after "deletion" so audit logs remain immutable and fully traceable.
alter table if exists ledger_entries
add column if not exists deleted_at timestamp with time zone,
add column if not exists deleted_by text,
add column if not exists deleted_by_name text;
