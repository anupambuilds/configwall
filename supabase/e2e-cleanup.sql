-- Removes rows created by scripts/e2e-backend.mjs (device ids start with "e2e").
-- (Uploaded test photos stay in storage; they are tiny and unreferenced.)
delete from public.votes where device_id like 'e2e%';
delete from public.visits where device_id like 'e2e%';
delete from public.posts where device_id like 'e2e%' or body like 'e2e %';
update public.settings set read_only = false;
select (select count(*) from public.posts) as posts_left;
