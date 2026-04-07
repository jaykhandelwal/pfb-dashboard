-- Shared business-day cutoff used by dashboard defaults and Record Cash.

begin;

insert into app_settings (key, value)
values ('business_day_cutoff_hour', to_jsonb(15))
on conflict (key) do nothing;

commit;
