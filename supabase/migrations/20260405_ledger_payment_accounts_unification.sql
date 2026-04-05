-- Simplify ledger payments so payment accounts are the only ledger payment concept.
-- This migration:
-- 1. folds legacy payment_methods into ledger_accounts
-- 2. creates private user-linked accounts for every system user
-- 3. backfills source_account/source_account_id on ledger_entries
-- 4. deletes the old payment_methods app setting
-- 5. drops payment_method/payment_method_id from ledger_entries

begin;

insert into app_settings (key, value)
values ('ledger_accounts', '[]'::jsonb)
on conflict (key) do nothing;

do $$
declare
  accounts jsonb := coalesce(
    (
      select case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end
      from app_settings
      where key = 'ledger_accounts'
    ),
    '[]'::jsonb
  );
  methods jsonb := coalesce(
    (
      select case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end
      from app_settings
      where key = 'payment_methods'
    ),
    '[]'::jsonb
  );
  item jsonb;
  method_item jsonb;
  usr record;
  legacy_source text;
  legacy_method text;
  normalized_name text;
begin
  -- Normalize any existing account records to the new single-account structure.
  accounts := coalesce((
    select jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', coalesce(nullif(elem->>'id', ''), 'custom_' || substr(md5(coalesce(elem->>'name', 'account')), 1, 12)),
          'name', coalesce(nullif(elem->>'name', ''), 'Account'),
          'type', case when coalesce(elem->>'type', 'CUSTOM') = 'USER' then 'USER' else 'CUSTOM' end,
          'linkedUserId', nullif(elem->>'linkedUserId', ''),
          'isActive', case when elem ? 'isActive' then coalesce((elem->>'isActive')::boolean, true) else true end,
          'color', coalesce(nullif(elem->>'color', ''), case when coalesce(elem->>'type', 'CUSTOM') = 'USER' then '#3b82f6' else '#10b981' end),
          'icon', coalesce(nullif(elem->>'icon', ''), case when coalesce(elem->>'type', 'CUSTOM') = 'USER' then 'User' else 'CreditCard' end),
          'allowedUserIds', case
            when coalesce(elem->>'type', 'CUSTOM') = 'USER' and nullif(elem->>'linkedUserId', '') is not null
              then jsonb_build_array(elem->>'linkedUserId')
            when elem ? 'allowedUserIds' and jsonb_typeof(elem->'allowedUserIds') = 'array'
              then elem->'allowedUserIds'
            else 'null'::jsonb
          end,
          'paymentMethod', nullif(coalesce(elem->>'paymentMethod', elem->>'payment_method', ''), '')
        )
      )
    )
    from jsonb_array_elements(accounts) as elem
  ), '[]'::jsonb);

  -- Ensure the default company account exists.
  if not exists (
    select 1
    from jsonb_array_elements(accounts) as acc
    where acc->>'id' = 'company_account'
  ) then
    accounts := jsonb_build_array(
      jsonb_build_object(
        'id', 'company_account',
        'name', 'Company Account',
        'type', 'CUSTOM',
        'isActive', true,
        'color', '#0f766e',
        'icon', 'Wallet',
        'allowedUserIds', null
      )
    ) || accounts;
  end if;

  -- Convert old payment_methods settings into custom payment accounts.
  for method_item in
    select value from jsonb_array_elements(methods)
  loop
    normalized_name := coalesce(
      nullif(method_item->>'name', ''),
      nullif(method_item->>'paymentMethod', ''),
      nullif(method_item->>'payment_method', '')
    );

    if normalized_name is null then
      continue;
    end if;

    if not exists (
      select 1
      from jsonb_array_elements(accounts) as acc
      where lower(acc->>'name') = lower(normalized_name)
    ) then
      accounts := accounts || jsonb_build_array(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', coalesce(nullif(method_item->>'id', ''), 'legacy_' || substr(md5(normalized_name), 1, 12)),
            'name', normalized_name,
            'type', 'CUSTOM',
            'isActive', case when method_item ? 'isActive' then coalesce((method_item->>'isActive')::boolean, true) else true end,
            'color', coalesce(nullif(method_item->>'color', ''), '#10b981'),
            'icon', coalesce(nullif(method_item->>'icon', ''), 'CreditCard'),
            'allowedUserIds', case
              when method_item ? 'allowedUserIds' and jsonb_typeof(method_item->'allowedUserIds') = 'array'
                then method_item->'allowedUserIds'
              else 'null'::jsonb
            end,
            'paymentMethod', normalized_name
          )
        )
      );
    end if;
  end loop;

  -- Create accounts for any distinct legacy source_account values that are missing.
  for legacy_source in
    select distinct trim(source_account)
    from ledger_entries
    where nullif(trim(source_account), '') is not null
  loop
    if not exists (
      select 1
      from jsonb_array_elements(accounts) as acc
      where lower(acc->>'name') = lower(legacy_source)
    ) then
      accounts := accounts || jsonb_build_array(
        jsonb_build_object(
          'id', 'legacy_source_' || substr(md5(legacy_source), 1, 12),
          'name', legacy_source,
          'type', 'CUSTOM',
          'isActive', true,
          'color', '#10b981',
          'icon', 'CreditCard',
          'allowedUserIds', null
        )
      );
    end if;
  end loop;

  -- Create accounts for any distinct legacy payment_method values that are missing.
  for legacy_method in
    select distinct trim(payment_method)
    from ledger_entries
    where nullif(trim(payment_method), '') is not null
  loop
    normalized_name := case upper(legacy_method)
      when 'CASH' then 'Cash'
      when 'UPI' then 'UPI'
      when 'CARD' then 'Card'
      when 'BANK_TRANSFER' then 'Bank Transfer'
      else initcap(replace(lower(legacy_method), '_', ' '))
    end;

    if not exists (
      select 1
      from jsonb_array_elements(accounts) as acc
      where lower(acc->>'name') = lower(normalized_name)
    ) then
      accounts := accounts || jsonb_build_array(
        jsonb_build_object(
          'id', 'legacy_method_' || substr(md5(legacy_method), 1, 12),
          'name', normalized_name,
          'type', 'CUSTOM',
          'isActive', true,
          'color', '#10b981',
          'icon', 'CreditCard',
          'allowedUserIds', null,
          'paymentMethod', legacy_method
        )
      );
    end if;
  end loop;

  -- Ensure every current system user has a private payment account.
  for usr in
    select id, coalesce(nullif(name, ''), id) as name
    from users
  loop
    if exists (
      select 1
      from jsonb_array_elements(accounts) as acc
      where acc->>'linkedUserId' = usr.id
    ) then
      accounts := coalesce((
        select jsonb_agg(
          case
            when acc->>'linkedUserId' = usr.id then
              jsonb_strip_nulls(
                acc || jsonb_build_object(
                  'name', usr.name,
                  'type', 'USER',
                  'linkedUserId', usr.id,
                  'isActive', true,
                  'color', coalesce(nullif(acc->>'color', ''), '#3b82f6'),
                  'icon', coalesce(nullif(acc->>'icon', ''), 'User'),
                  'allowedUserIds', jsonb_build_array(usr.id)
                )
              )
            else acc
          end
        )
        from jsonb_array_elements(accounts) as acc
      ), '[]'::jsonb);
    else
      accounts := accounts || jsonb_build_array(
        jsonb_build_object(
          'id', 'user_' || usr.id,
          'name', usr.name,
          'type', 'USER',
          'linkedUserId', usr.id,
          'isActive', true,
          'color', '#3b82f6',
          'icon', 'User',
          'allowedUserIds', jsonb_build_array(usr.id)
        )
      );
    end if;
  end loop;

  update app_settings
  set value = accounts
  where key = 'ledger_accounts';
end
$$;

with account_index as (
  select
    acc->>'id' as account_id,
    acc->>'name' as account_name,
    lower(coalesce(acc->>'name', '')) as name_key,
    lower(coalesce(acc->>'paymentMethod', '')) as method_key
  from app_settings settings
  cross join lateral jsonb_array_elements(
    case
      when settings.key = 'ledger_accounts' and jsonb_typeof(settings.value) = 'array' then settings.value
      else '[]'::jsonb
    end
  ) as acc
  where settings.key = 'ledger_accounts'
),
source_name_matches as (
  select distinct on (entry.id)
    entry.id,
    idx.account_id,
    idx.account_name
  from ledger_entries entry
  join account_index idx
    on lower(coalesce(entry.source_account, '')) = idx.name_key
  order by entry.id
),
payment_method_matches as (
  select distinct on (entry.id)
    entry.id,
    idx.account_id,
    idx.account_name
  from ledger_entries entry
  join account_index idx
    on lower(coalesce(entry.payment_method, '')) = idx.method_key
    or lower(coalesce(entry.payment_method, '')) = idx.name_key
  where nullif(trim(entry.payment_method), '') is not null
  order by entry.id
)
update ledger_entries entry
set
  source_account = coalesce(
    case
      when payment_match.account_name is not null
        and (
          nullif(trim(entry.source_account), '') is null
          or lower(trim(entry.source_account)) = 'company account'
        )
        then payment_match.account_name
      else null
    end,
    source_match.account_name,
    nullif(trim(entry.source_account), ''),
    'Company Account'
  ),
  source_account_id = coalesce(
    case
      when payment_match.account_id is not null
        and (
          nullif(trim(entry.source_account), '') is null
          or lower(trim(entry.source_account)) = 'company account'
          or nullif(trim(entry.source_account_id), '') is null
        )
        then payment_match.account_id
      else null
    end,
    source_match.account_id,
    nullif(trim(entry.source_account_id), ''),
    'company_account'
  )
from source_name_matches source_match
full outer join payment_method_matches payment_match
  on source_match.id = payment_match.id
where entry.id = coalesce(source_match.id, payment_match.id);

update ledger_entries
set
  source_account = coalesce(nullif(trim(source_account), ''), 'Company Account'),
  source_account_id = coalesce(nullif(trim(source_account_id), ''), 'company_account')
where nullif(trim(source_account), '') is null
   or nullif(trim(source_account_id), '') is null;

delete from app_settings
where key = 'payment_methods';

alter table if exists ledger_entries
  drop column if exists payment_method,
  drop column if exists payment_method_id;

commit;
