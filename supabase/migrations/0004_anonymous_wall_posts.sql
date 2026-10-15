-- Wall posts (written on the wall) may be anonymous: the X handle is optional.
alter table public.posts drop constraint post_rules;
alter table public.posts add constraint post_rules check (
  type <> 'post' or (
    kind is not null and source is not null and
    (source <> 'x' or (link_url is not null and tweet_id is not null)) and
    (source <> 'native' or (body is not null and char_length(body) between 1 and 280))
  )
);
