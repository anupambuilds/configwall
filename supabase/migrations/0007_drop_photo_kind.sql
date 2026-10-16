-- "Photo" is no longer a post type: photos belong to takeaways, quotes,
-- stories and reviews (they come from the tweet).
update public.posts set kind = 'story' where kind = 'photo';
alter table public.posts drop constraint if exists posts_kind_check;
alter table public.posts add constraint posts_kind_check check (kind in ('takeaway', 'quote', 'story', 'review'));
