-- Make ledger_logs append-only at the database layer.
-- Same database is fine as long as the audit table cannot be mutated in place.

create or replace function prevent_ledger_log_mutation()
returns trigger
language plpgsql
as $$
begin
    raise exception 'ledger_logs is append-only; % is not allowed', tg_op;
end;
$$;

drop trigger if exists ledger_logs_no_mutation on ledger_logs;

create trigger ledger_logs_no_mutation
before update or delete on ledger_logs
for each row
execute function prevent_ledger_log_mutation();
