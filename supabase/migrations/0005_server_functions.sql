-- Support for the Edge Functions (all columns/tables here are server-only:
-- the public key cannot read them).

-- Soft-delete audit, double-submit protection, rate-limit lookups.
alter table public.posts
  add column deleted_at      timestamptz,
  add column deleted_by      text,          -- device id (or 'admin') that removed it
  add column idempotency_key text;          -- client-generated per submit

create unique index posts_idempotency_key on public.posts (idempotency_key) where idempotency_key is not null;
create index posts_device_created_idx on public.posts (device_id, created_at desc);
create index posts_deleted_by_idx on public.posts (deleted_by, deleted_at desc);

-- Cache of X handle existence checks (so we don't ask X on every post).
create table public.x_handles (
  handle     text primary key check (handle ~ '^[a-z0-9_]{1,15}$'),
  "exists"   boolean not null,
  checked_at timestamptz not null default now()
);
alter table public.x_handles enable row level security;
revoke all on public.x_handles from anon, authenticated;
