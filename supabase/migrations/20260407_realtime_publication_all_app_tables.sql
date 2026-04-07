do $$
declare
    publication_name constant text := 'supabase_realtime';
    table_record record;
begin
    for table_record in
        select *
        from (
            values
                ('public', 'app_settings'),
                ('public', 'attendance'),
                ('public', 'branches'),
                ('public', 'customer_coupons'),
                ('public', 'customers'),
                ('public', 'deleted_transactions'),
                ('public', 'ledger_entries'),
                ('public', 'menu_categories'),
                ('public', 'menu_items'),
                ('public', 'membership_rules'),
                ('public', 'orders'),
                ('public', 'sales_records'),
                ('public', 'skus'),
                ('public', 'storage_units'),
                ('public', 'task_templates'),
                ('public', 'todos'),
                ('public', 'transactions'),
                ('public', 'users')
        ) as required_tables(schema_name, table_name)
    loop
        if not exists (
            select 1
            from pg_publication_tables
            where pubname = publication_name
              and schemaname = table_record.schema_name
              and tablename = table_record.table_name
        ) then
            execute format(
                'alter publication %I add table %I.%I',
                publication_name,
                table_record.schema_name,
                table_record.table_name
            );
        end if;
    end loop;
end
$$;
