-- Live updates as signals. Every change to a post or to settings broadcasts a
-- tiny message on the public "wall" topic. The payload carries no private data,
-- and clients treat it only as a hint: they re-read the post from the database
-- (where RLS applies), so a forged signal can't inject or reveal anything.

create or replace function public.signal_post_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object('id', new.id, 'op', lower(tg_op)),
    'post',
    'wall',
    false
  );
  return null;
end;
$$;

create trigger posts_signal
after insert or update on public.posts
for each row execute function public.signal_post_change();

create or replace function public.signal_settings_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(jsonb_build_object('read_only', new.read_only), 'settings', 'wall', false);
  return null;
end;
$$;

create trigger settings_signal
after update on public.settings
for each row execute function public.signal_settings_change();

revoke all on function public.signal_post_change() from public, anon, authenticated;
revoke all on function public.signal_settings_change() from public, anon, authenticated;
