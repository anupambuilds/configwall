# CLAUDE.md — Config BLR Wall

@AGENTS.md

Unofficial, community-built recap wall for Figma Config Bangalore: a live feed of **posts** (X-first), **people we met** and **talk notes**, plus a People directory with shareable **Config cards**.

- **Product spec (source of truth):** [product.md](product.md), a living PRD with a dated **Change log** at the bottom.
- **Launch readiness:** [docs/go-live.md](docs/go-live.md): data audit, blockers, step-by-step plan, test checklist.
- **Repo:** https://github.com/anupambuilds/configwall

---

## Ways of working (rules)

1. **Keep `product.md` current.** Every product change updates the relevant PRD section *and* adds a dated entry at the top of `## 7. Change log`. Never create new versions or copies of the file (no `product-v2.md`).
2. **Confirm before outward or irreversible actions:** deploying to production, changing the production database, deleting data, force-pushing, changing repo settings. The user approves each go-live step in `docs/go-live.md` separately.
3. **Test first.** Local and the test site use the **test** Supabase project. Production is touched only in go-live step 6, after the test checklist passes.
4. **Before every commit:** `npx tsc --noEmit`, `npx eslint src`, `npm run check:schema` and, for anything touching routing/config, `npm run build`. Commit messages end with the `Co-Authored-By` line used in the history. Push to `main` (which deploys the test site).
5. **Verify, don't assume.** For UI, render it and look: headless Edge can screenshot a local page (`"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --screenshot=<file.png> --window-size=W,H --force-device-scale-factor=2 --virtual-time-budget=8000 <url>`), then read the PNG. After CSS/config changes, confirm what the browser actually receives (served CSS/HTML), not just that the server restarted. Say plainly what was and wasn't verified in a real browser.
6. **Never commit or paste secrets.** Only public values (Supabase URLs, publishable keys) live in the repo. Secret keys, the service-role key and database passwords stay in Supabase or in git-ignored `.env*.local` files. Filter secrets out of any CLI output.
7. **Product rules:** unofficial, so no Figma/Config logos or brand colours; the footer line "Unofficial community project. Not affiliated with Figma." must stay on every page. Credit every author. Never invent quotes, people or posts; mock data uses obvious `demo_` handles and stays local-only.
8. **Ask before changing the design direction.** The user iterates on UI in small steps; restate the understanding and confirm when a request is ambiguous, then build exactly that.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.4** (App Router) + **React 19.3** + TypeScript. `output: "export"` (fully static). Read `node_modules/next/dist/docs/` before using Next APIs; this version differs from older training data. |
| Styling | **Tailwind CSS v4** via `@tailwindcss/postcss` (`postcss.config.mjs`). All colours are CSS tokens in `src/app/globals.css`. Fonts: Instrument Serif (display), Geist (body). |
| Hosting | **GitHub Pages**, built by `.github/workflows/deploy.yml` |
| Backend | **Supabase**: Postgres + RLS, Realtime, Storage, Edge Functions |
| Other | `html-to-image` (Config card PNG), X `widgets.js` (embed fallback only), X web intents (posting to X) |

## Commands

```bash
npm run dev          # http://localhost:3000 (uses .env.local → test Supabase)
npm run dev:clean    # same, with a fresh .next/dev cache
npm run build        # static export → out/
npm run check:schema # every Post field has a DB column
npx tsc --noEmit && npx eslint src
```
Windows notes: in PowerShell use `npx.cmd` (script execution is disabled). In Git Bash, prefix builds that set a base path with `MSYS_NO_PATHCONV=1`, or `/configwall/test` gets rewritten to a Windows path.

## Environments

| | URL | Supabase project | Deploys from |
|---|---|---|---|
| Local | http://localhost:3000 | test `gwgrxwgpovpswwqppexf` | `.env.local` |
| Test | https://anupambuilds.github.io/configwall/test/ | test `gwgrxwgpovpswwqppexf` | push to `main` |
| Production | https://anupambuilds.github.io/configwall/ | production `olmdpakuiawvtiolbhne` | `production` branch |

- Until a `production` branch exists, the public URL serves a "coming soon" page. Release = merge `main` into `production`.
- Non-production builds show a yellow banner with the environment and the data source.
- `NEXT_PUBLIC_APP_ENV` (`local`/`test`/`production`), `NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set per build (see `.env.example` and the workflow).
- Supabase CLI: logged in on this machine; run SQL with `npx supabase db query --linked --project-ref <ref> -f file.sql`.

## Architecture

```
src/
  app/                 routes (all static): / (feed), /people, /p (single entry), /admin
  components/
    app-shell.tsx      nav, env banner, toast, add-post sheet host (openAdd/toast via useShell)
    wall.tsx           feed: tabs, filters, sort, add cards, realtime pill
    post-card.tsx      card per type: X-style post · purple met card · yellow talk-notes card
    add-post-sheet.tsx add flow: Post (X link / write) · Someone I met · Talk notes
    people.tsx         directory (search, metrics), person view (activity)
    config-card.tsx    Config card side panel (1080×1350 PNG, share on X)
    admin.tsx          seed / quick add / moderate
    x-embed.tsx        lazy X embed fallback (10 s timeout → "View on X" card)
  lib/
    types.ts           Post / TweetSnapshot types (the data model)
    db.ts              data contract: POST_COLUMNS must cover every Post field
    store.ts           Store interface + mock implementation (DATA_SOURCE)
    use-posts.ts       live post list (holds remote inserts behind "N new posts")
    people.ts          derives people, connections, metrics from posts
    util.ts            validation (validatePost), link/handle normalising, tokenizer
    share.ts           X intent text per entry type
    identity.ts        handle + device id in localStorage
    config.ts          talks, hashtag, env, Supabase URL/key, site URL helpers
supabase/migrations/   SQL applied to both projects (keep identical)
scripts/check-schema.mjs
```

**Static-hosting constraints:** no API routes, server actions, middleware, dynamic route segments or per-page OG images. Use query params (`/p/?id=`, `/people/?p=`, `/people/?card=`). Anything that needs a secret, validation or a cross-origin fetch goes in a **Supabase Edge Function**.

**Data flow (target):** reads → Postgres with the publishable key (RLS shows only `hidden = false`); writes → Edge Functions (validate, rate-limit, fetch tweet, insert with the service role); upvotes → `upvote(post_id, device_id)` RPC; live updates → Realtime on `posts`, plus a "moderation" broadcast for hides. **All UI data access goes through `Store`** (`src/lib/store.ts`), so swapping mock ↔ Supabase never touches components.

## Data model and mapping

One table, `posts`, with `type` ∈ `post | met | note`. People, connections and metrics are **computed** from posts and never stored.

| UI | `Post` field / DB column | Rules |
|---|---|---|
| Entry type | `type` | post · met · note |
| Post type tag | `kind` | takeaway · quote · story · photo · review (posts only) |
| X post vs wall post | `source` | `x` · `native` |
| X link | `link_url` (+ DB-only `tweet_id`, unique) | canonical `https://x.com/{handle}/status/{id}` |
| Tweet content (name, @handle, avatar, text, photos, mentions, date) | `tweet` (jsonb `TweetSnapshot`) | fetched **server-side** from X syndication (CORS blocks browsers) |
| Wall post text / met conversation / talk notes | `body` | 280 for posts; 1000 for met and notes |
| Tagged people | `tagged` | handles, no @ |
| Person met | `met_name`, `met_role` (designation), `met_company`, `met_handle`, `met_linkedin` | name or handle or LinkedIn required; LinkedIn = `/in/` profile |
| Met photos | `photos` (≤4 URLs, bucket `photos`) | images ≤2 MB, compressed on the device |
| Talk | `talk` | required for notes |
| Author | `author_handle` | lowercase X handle, self-declared |
| Upvotes | `upvotes` + `votes(post_id, device_id)` | one per device |
| Moderation / seeds | `hidden`, `is_seed` | admin only |
| Submitter | DB-only `device_id` | never readable with the public key |

Changing the model? Update `types.ts`, `EMPTY_POST`, `db.ts`, a **new** migration in `supabase/migrations/` (applied to test, then production), `validatePost`, the mock seed, and `product.md`. `npm run check:schema` must pass.

## UI conventions
- Admin mode = the normal wall + an admin bar (Show hidden, Read-only, Lock): delete any post, Unhide hidden posts in place, bulk X links in the Post form, notes credited to any handle. State lives in the shell context (`useShell().isAdmin`, `showHidden`, `readOnly`). Read-only is a `settings` row; non-admins can't post or delete while it's on.
- Admin unlock: `/admin/` shows an "Admin secret" box; the secret is stored per device (`cbw:admin-secret`), re-verified on each visit and sent with every admin action. Only the server may verify it; never ship the live secret in the page (local mock secret: `local-admin`).
- Grid: 1 column < 640px, 2 columns < 1024px, max 3 columns (embedded X posts need ≥250px).
- Feed tabs: All · Posts (sub-filters by kind) · People we met · Talk notes (mixed by default, optional "Group by talk"). Latest/Top on the tab row. The first card on each tab is a dashed **Add card**.
- Counters show exact numbers up to 100, then `100+`, `150+`, … (`formatCount`).
- Primary colour near-black `#1c1b19` on off-white `#f5f2ea`; green "Live" dot; add cards tint grey on hover.
- After posting: close the sheet, toast "Post is being added to the wall", go to the wall. Posting to X is the 𝕏 button on each card.
- A tweet is on the wall once: duplicates are keyed by tweet id (`tweetIdFromUrl`); the form flags "Already on the wall" on paste and on submit (`DuplicatePostError`); re-sharing a deleted one restores it.
- Only the poster can delete: posts created on this device (ids in localStorage `cbw:mine`) get a ⋮ menu with Delete (inline confirm). The server must verify the caller's device id equals the post's `device_id`. Soft delete (`hidden`), restorable by admin.
- Text fields show focus by darkening their border only (no outline ring); don't add focus rings to inputs.
- Use tokens (`bg-paper`, `text-ink`, `bg-met-bg`, …), never raw hex in components (exception: LinkedIn blue).
