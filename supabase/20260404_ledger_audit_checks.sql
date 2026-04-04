-- Verification checks for:
-- 1. 20260404_ledger_soft_delete.sql
-- 2. 20260404_ledger_logs_append_only.sql
--
-- This file is read-only verification SQL. It does not modify data.

-- Summary: should return all TRUE values after both migrations are applied.
select
    exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'ledger_entries'
          and column_name = 'deleted_at'
    ) as has_deleted_at,
    exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'ledger_entries'
          and column_name = 'deleted_by'
    ) as has_deleted_by,
    exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'ledger_entries'
          and column_name = 'deleted_by_name'
    ) as has_deleted_by_name,
    exists (
        select 1
        from information_schema.routines
        where routine_schema = 'public'
          and routine_name = 'prevent_ledger_log_mutation'
    ) as has_append_only_function,
    exists (
        select 1
        from information_schema.triggers
        where event_object_schema = 'public'
          and event_object_table = 'ledger_logs'
          and trigger_name = 'ledger_logs_no_mutation'
    ) as has_append_only_trigger;

-- Detail: soft-delete columns on ledger_entries.
select
    column_name,
    data_type,
    is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'ledger_entries'
  and column_name in ('deleted_at', 'deleted_by', 'deleted_by_name')
order by column_name;

-- Detail: append-only trigger on ledger_logs.
select
    trigger_name,
    event_manipulation,
    action_timing,
    event_object_table,
    action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'ledger_logs'
  and trigger_name = 'ledger_logs_no_mutation'
order by event_manipulation;

-- Detail: append-only function exists.
select
    routine_name,
    routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'prevent_ledger_log_mutation';
