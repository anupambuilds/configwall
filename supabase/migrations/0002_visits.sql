-- Unique visitor count for the footer: one row per device.
-- Never readable directly; the public key can only call record_visit().

create table public.visits (
  device_id  text primary key check (char_length(device_id) between 8 and 64),
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);

alter table public.visits enable row level security;
revoke all on public.visits from anon, authenticated;

-- Records this device's visit and returns the number of unique visitors.
create or replace function public.record_visit(p_device_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(coalesce(p_device_id, '')) between 8 and 64 then
    insert into visits (device_id) values (p_device_id)
    on conflict (device_id) do update set last_seen = now();
  end if;
  return (select count(*) from visits);
end;
$$;

revoke all on function public.record_visit(text) from public;
grant execute on function public.record_visit(text) to anon, authenticated;
