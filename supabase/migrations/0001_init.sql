-- Config BLR Wall — initial schema.
-- Mirrors `Post` in src/lib/types.ts column-for-column (checked by `npm run check:schema`).
-- Writes go through Edge Functions (service role); the public anon key can only read
-- visible posts and call the upvote / my_votes RPCs.

-- ---------------------------------------------------------------------------
-- posts: every feed entry (X / wall posts, people met, talk notes)
-- ---------------------------------------------------------------------------
create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('post', 'met', 'note')),
  author_handle text check (author_handle ~ '^[a-z0-9_]{1,15}$'),

  -- post: native text · met: what was discussed · note: the notes
  body          text,

  -- post
  source        text check (source in ('x', 'native')),
  kind          text check (kind in ('takeaway', 'quote', 'story', 'photo', 'review')),
  link_url      text check (link_url is null or link_url ~ '^https://x\.com/[A-Za-z0-9_]{1,15}/status/[0-9]+$'),
  tweet         jsonb,                                -- TweetSnapshot (text, photos, author, mentions)
  tweet_id      text,                                 -- DB-only: dedupe key parsed from link_url
  tagged        text[] not null default '{}',         -- native posts: tagged handles

  -- met
  met_name      text check (char_length(met_name) <= 80),
  met_role      text check (char_length(met_role) <= 80),
  met_company   text check (char_length(met_company) <= 80),
  met_handle    text check (met_handle ~ '^[a-z0-9_]{1,15}$'),
  met_linkedin  text check (met_linkedin is null or met_linkedin ~ '^https://([a-z]+\.)?linkedin\.com/in/[^/?#]+/?$'),
  photos        text[] not null default '{}' check (cardinality(photos) <= 4),

  -- note
  talk          text,

  upvotes       int not null default 0 check (upvotes >= 0),
  hidden        boolean not null default false,
  is_seed       boolean not null default false,
  created_at    timestamptz not null default now(),

  -- DB-only, never exposed to the public key: who submitted it (rate limits, moderation)
  device_id     text,

  -- Per-type rules (mirror validatePost in src/lib/util.ts)
  constraint post_rules check (
    type <> 'post' or (
      kind is not null and source is not null and
      (source <> 'x' or (link_url is not null and tweet_id is not null)) and
      (source <> 'native' or (author_handle is not null and body is not null and char_length(body) between 1 and 280))
    )
  ),
  constraint met_rules check (
    type <> 'met' or (
      author_handle is not null and
      coalesce(met_name, met_handle, met_linkedin) is not null and
      body is not null and char_length(body) between 1 and 1000 and
      (met_handle is null or met_handle <> author_handle)
    )
  ),
  constraint note_rules check (
    type <> 'note' or (talk is not null and body is not null and char_length(body) between 1 and 1000)
  )
);

-- One wall entry per tweet.
create unique index posts_tweet_id_key on public.posts (tweet_id) where tweet_id is not null;
create index posts_created_at_idx on public.posts (created_at desc);
create index posts_author_idx on public.posts (author_handle);
create index posts_met_handle_idx on public.posts (met_handle);

-- ---------------------------------------------------------------------------
-- votes: one upvote per post per device
-- ---------------------------------------------------------------------------
create table public.votes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  device_id  text not null check (char_length(device_id) between 8 and 64),
  created_at timestamptz not null default now(),
  primary key (post_id, device_id)
);

-- ---------------------------------------------------------------------------
-- Access: public can read visible posts (minus device_id); nothing else directly.
-- ---------------------------------------------------------------------------
alter table public.posts enable row level security;
alter table public.votes enable row level security;

create policy "visible posts are public" on public.posts
  for select to anon, authenticated using (hidden = false);

revoke all on public.posts from anon, authenticated;
grant select (
  id, type, author_handle, body, source, kind, link_url, tweet, tagged,
  met_name, met_role, met_company, met_handle, met_linkedin, photos, talk,
  upvotes, hidden, is_seed, created_at
) on public.posts to anon, authenticated;

revoke all on public.votes from anon, authenticated;

-- Upvote: records the vote and bumps the count atomically. Returns false if
-- this device already voted (or the post is hidden / missing).
create or replace function public.upvote(p_post_id uuid, p_device_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(coalesce(p_device_id, '')) not between 8 and 64 then
    return false;
  end if;
  if not exists (select 1 from posts where id = p_post_id and hidden = false) then
    return false;
  end if;
  insert into votes (post_id, device_id) values (p_post_id, p_device_id)
  on conflict do nothing;
  if not found then
    return false;
  end if;
  update posts set upvotes = upvotes + 1 where id = p_post_id;
  return true;
end;
$$;

-- Which posts this device has upvoted (to show the voted state).
create or replace function public.my_votes(p_device_id text)
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select post_id from votes where device_id = p_device_id;
$$;

revoke all on function public.upvote(uuid, text) from public;
revoke all on function public.my_votes(text) from public;
grant execute on function public.upvote(uuid, text) to anon, authenticated;
grant execute on function public.my_votes(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: clients subscribe to INSERT / UPDATE on posts.
-- Note: RLS means clients never receive the UPDATE that hides a post, so the
-- admin "hide" Edge Function also sends a broadcast ("moderation" channel,
-- { id, hidden }) that clients use to remove it live.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.posts;

-- ---------------------------------------------------------------------------
-- Storage: met-card photos and copies of tweet photos. Uploads go through an
-- Edge Function (signed upload URLs); the bucket is publicly readable.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
