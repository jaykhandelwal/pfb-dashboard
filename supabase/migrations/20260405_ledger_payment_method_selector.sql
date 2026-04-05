-- Create a dedicated selector list for ledger account payment-method labels.
-- Existing account labels are preserved; deleting a selector option later does not clear old account values.

begin;

insert into app_settings (key, value)
values ('ledger_payment_methods', '[]'::jsonb)
on conflict (key) do nothing;

update app_settings settings
set value = coalesce(
  (
    select jsonb_agg(to_jsonb(method_name) order by method_name)
    from (
      select distinct on (lower(trim(acc->>'paymentMethod')))
        trim(acc->>'paymentMethod') as method_name
      from app_settings accounts
      cross join lateral jsonb_array_elements(
        case
          when accounts.key = 'ledger_accounts' and jsonb_typeof(accounts.value) = 'array' then accounts.value
          else '[]'::jsonb
        end
      ) as acc
      where accounts.key = 'ledger_accounts'
        and nullif(trim(acc->>'paymentMethod'), '') is not null
      order by lower(trim(acc->>'paymentMethod')), trim(acc->>'paymentMethod')
    ) seeded_methods
  ),
  '[]'::jsonb
)
where settings.key = 'ledger_payment_methods'
  and (
    jsonb_typeof(settings.value) <> 'array'
    or jsonb_array_length(settings.value) = 0
  );

commit;
