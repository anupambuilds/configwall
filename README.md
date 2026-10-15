# Config BLR Wall

Unofficial community recap wall for Config Bangalore. See [product.md](product.md) for the PRD.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export → out/ (GitHub Pages)
npm run dev:clean  # dev server with a fresh cache
```

The app currently runs on **mock data** stored in your browser (localStorage). Open two tabs to see realtime updates.

- Admin: `http://localhost:3000/admin/`, then enter the admin secret `local-admin` (local only) and **Unlock**. Use "Reset mock data" there to start over, and **Lock** to forget the secret on this device.
- Talk list and builder handle: `src/lib/config.ts`. Mock seed posts: `src/lib/mock-seed.ts`.
- All data access goes through `src/lib/store.ts`. The Supabase backend plugs in there.
- Database schema: `supabase/migrations/0001_init.sql`. Run `npm run check:schema` to confirm every field the UI collects has a column.

## Environments

| | URL | Database | Deploys from |
|---|---|---|---|
| Local | http://localhost:3000 | test Supabase project (`.env.local`) | — |
| Test | https://anupambuilds.github.io/configwall/test/ | test Supabase project | push to `main` |
| Production | https://anupambuilds.github.io/configwall/ | production Supabase project | `production` branch |

Copy `.env.example` to `.env.local` for local development. Release to production by merging `main` into `production`.

## Env vars

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_BASE_PATH` | `/repo-name` when deployed as a GitHub Pages project site |
| `NEXT_PUBLIC_SITE_URL` | Public origin used in share links and the Config card footer |
| `NEXT_PUBLIC_BUILDER_HANDLE` | Your X handle for the "built by" credit |
| `NEXT_PUBLIC_ADMIN_KEY` | Local admin gate (not real security on a static site) |
| `NEXT_PUBLIC_APP_ENV` | `local`, `test` or `production` (controls the environment banner) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project for this build (public values) |
