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

- Admin: `http://localhost:3000/admin/?key=local-admin`. Use "Reset mock data" there to start over.
- Talk list and builder handle: `src/lib/config.ts`. Mock seed posts: `src/lib/mock-seed.ts`.
- All data access goes through `src/lib/store.ts`. The Supabase backend plugs in there.

## Env vars (optional)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_BASE_PATH` | `/repo-name` when deployed as a GitHub Pages project site |
| `NEXT_PUBLIC_SITE_URL` | Public origin used in share links and the card footer |
| `NEXT_PUBLIC_BUILDER_HANDLE` | Your X handle for the "built by" credit |
| `NEXT_PUBLIC_ADMIN_KEY` | Local admin gate (not real security on a static site) |
