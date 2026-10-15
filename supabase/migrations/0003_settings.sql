-- Site-wide settings (one row). Read-only mode pauses posting and deleting
-- for everyone except admin. Readable by the public (the app needs it);
-- only the admin Edge Function (service role) can change it.

create table public.settings (
  id         boolean primary key default true check (id),
  read_only  boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values (true) on conflict (id) do nothing;

alter table public.settings enable row level security;

create policy "settings are public" on public.settings
  for select to anon, authenticated using (true);

revoke all on public.settings from anon, authenticated;
grant select on public.settings to anon, authenticated;

-- Clients listen for changes so read-only mode switches on everyone's screen live.
alter publication supabase_realtime add table public.settings;
