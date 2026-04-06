-- Add configuration for the sidebar "Record Cash" action.
-- The feature stores the destination payment account plus per-user visibility.

begin;

insert into app_settings (key, value)
values (
  'ledger_record_cash',
  jsonb_build_object(
    'accountId', '',
    'accountName', '',
    'allowedUserIds', null
  )
)
on conflict (key) do nothing;

update app_settings
set value = jsonb_strip_nulls(
  jsonb_build_object(
    'accountId', coalesce(nullif(value->>'accountId', ''), ''),
    'accountName', nullif(value->>'accountName', ''),
    'allowedUserIds',
      case
        when value ? 'allowedUserIds' and jsonb_typeof(value->'allowedUserIds') = 'array'
          then value->'allowedUserIds'
        else 'null'::jsonb
      end
  )
)
where key = 'ledger_record_cash';

commit;
