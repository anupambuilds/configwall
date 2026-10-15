# Go-live audit and plan

Status legend: ✅ works end to end · ⚠️ works, with a caveat · ❌ not fetchable / not built yet (blocks launch)

Verified facts behind this audit (2026-10-15):
- Both Supabase projects have the schema; public-key tests pass (read visible posts, no direct writes, one vote per device, hidden posts disappear, invalid rows rejected).
- X's syndication endpoint (`cdn.syndication.twimg.com/tweet-result`) returns text, author name, @handle, avatar, photos, mentions and date in ~0.5 s from a home connection. **It only allows CORS from `platform.twitter.com`, so browsers cannot call it — it must be fetched by a server function.** Not yet tested from Supabase's servers (data-centre IPs can be rate-limited differently).
- The app still runs on **mock data** (`DATA_SOURCE = "mock"`); nothing is shared between visitors yet.

---

## 1. Data shown on each page → where it comes from

### Feed `/`
| Shown | Source | Status |
|---|---|---|
| Live counter (posts · people), tab counts | Computed in the browser from all loaded posts | ⚠️ Fine at event scale (hundreds–low thousands of posts). If we paginate, counts need a server count (RPC). |
| **X post card:** author name, @handle, avatar, date, text, photos, mentions | `posts.tweet` snapshot, fetched once by a server function | ❌ Server function not built. Locally only demo tweets resolve; real tweets fall back to X's embed. |
| X post: link entities | Snapshot `text` | ⚠️ Text contains `t.co` short links and HTML entities (`&amp;`); must expand links (via `entities.urls`) and decode entities when saving. |
| X post: videos, GIFs, quoted tweets, polls, link previews | Not in the snapshot | ⚠️ Not shown (only text + photos). Video tweets show their thumbnail only if we map `mediaDetails`. Decide if acceptable. |
| X post: long posts (>280) | Snapshot | ⚠️ Syndication may return a truncated `text` for long posts; check `note_tweet` when mapping. |
| X post photos and avatar | Hot-linked from `pbs.twimg.com` | ⚠️ Work, but vanish if the tweet is deleted. Optional: copy into our storage. |
| Post type tag, "View on X", upvotes, copy link, 𝕏 button | `posts.kind`, `link_url`, `upvotes`, `id`; X intent link | ✅ |
| **Wall post:** @handle, time, text, tagged people | `author_handle`, `created_at`, `body`, `tagged` | ✅ (no display name — wall posts only have a handle; shows initials) |
| **Met card:** author, name, designation, company, X, LinkedIn, conversation | `author_handle`, `met_*`, `body` | ✅ |
| Met photos | Storage bucket `photos` → `posts.photos` | ❌ Upload function not built. Mock stores photos *inside the browser* (data URLs), invisible to others and too big for the database. |
| **Talk notes card:** talk, notes, author, time | `talk`, `body`, `author_handle`, `created_at` | ✅ |
| Your upvoted state | RPC `my_votes(device_id)` | ✅ (device id from the browser) |
| Live new posts | Realtime INSERT/UPDATE on `posts` | ✅ publication on; client not wired yet |
| Hidden posts disappearing live | Admin broadcast on "moderation" channel | ❌ Not built (RLS hides the UPDATE from clients). |

### People `/people/`
| Shown | Source | Status |
|---|---|---|
| Names | `met_name` | ⚠️ X authors' real names are in their tweet snapshots but not used yet → they show as @handle. Easy fix. |
| Designation, company | Latest met card about them | ✅ |
| Posts, met, upvotes, last active | Computed from posts | ✅ |
| Search by name / @handle | Browser filter | ✅ |
| "You met N people" + CSV | Your saved handle + your met cards | ✅ |
| Avatars | Initials | ⚠️ Could use the X avatar from their tweet snapshots. |

### Person view `/people/?p=…` and Config card `?card=…`
| Shown | Source | Status |
|---|---|---|
| Metrics, connections, activity | Computed from posts | ✅ |
| Config card (metrics, top/latest post, site URL), PNG, share | Computed; PNG made in the browser | ✅ (site URL comes from the build's `NEXT_PUBLIC_SITE_URL` + base path) |

### Single entry `/p/?id=…`
| Shown | Source | Status |
|---|---|---|
| The entry | `getPost(id)` → `posts` by id | ✅ |
| Link preview when shared (OG image/text) | Static site-wide tags | ⚠️ No per-post previews (static hosting). No OG image exists yet. |

### Admin `/admin/`
| Action | Status |
|---|---|
| Access check | ❌ Key is checked in the browser and ships in the JS. Needs a server-side secret (Edge Function). |
| Bulk seed X links | ❌ Needs the server function (tweet fetch + insert with service role). |
| Quick-add talk notes | ❌ Needs the server function (anon cannot insert). |
| Hide / unhide | ❌ Needs the server function + moderation broadcast. |

---

## 2. Data collected while creating a post → database

Every field the forms collect has a column; `npm run check:schema` enforces it. Gaps are in *how* it gets there:

| Collected | Column | Gap |
|---|---|---|
| Entry type, post type, source | `type`, `kind`, `source` | ✅ |
| X link | `link_url` (canonical), `tweet_id` | ❌ server must parse `tweet_id` and dedupe (unique index exists) |
| Tweet preview | `tweet` | ❌ must be fetched **server-side** (browser preview can't be trusted or fetched) |
| Wall post text, tagged | `body`, `tagged` | ✅ |
| Met: name, designation, company, X, LinkedIn, conversation | `met_*`, `body` | ✅ |
| Met photos (≤4) | `photos` + bucket | ❌ upload function |
| Talk + notes | `talk`, `body` | ✅ |
| Your X handle | `author_handle` | ⚠️ self-declared, unverified (by design) |
| Device id | `device_id` | ❌ not sent with posts yet (needed for rate limits/moderation) |
| Double-submit protection | idempotency key | ❌ not built |
| Validation | form + DB constraints | ⚠️ server function must repeat it and return **field-level errors** |
| Rate limiting, spam check | — | ❌ server function |

---

## 3. Launch blockers (must fix)
1. Supabase data layer in the app (shared data, realtime, votes) — today everything is per-browser mock data.
2. `create-post` server function: validation, tweet fetch + snapshot mapping (expand t.co, decode entities, long posts), dedupe, device id, rate limit, idempotency, field-level errors.
3. Photo upload function (signed upload to the `photos` bucket).
4. Admin server function with a secret (seed, quick add, hide/unhide + live removal broadcast).
4b. `delete-post` server function: anyone can delete any post; it sets `hidden` (soft delete, restorable by admin), records who deleted it and when, rate-limits deletes per device, and broadcasts the removal.
5. Placeholders: real talk list, event hashtag, your X handle, admin secret.
6. Mock seed data must never load outside local development.
7. Repo public + GitHub Pages enabled; first CI deploy green (Linux build from a Windows-made lockfile is untested).

## 4. Should fix before launch
- Field-level error display mapped from server errors; keep drafts on failure; offline/retry message.
- Use tweet author names/avatars on People.
- `noindex` on the test site; real favicon and a site OG image.
- Decide region: projects are in Seoul; Mumbai is closer to Bangalore (production is empty, so moving now is free).
- Test the syndication endpoint from Supabase's servers.

## 5. Step-by-step plan (each step needs your OK)
| Step | What | Where |
|---|---|---|
| 0 | You: make the repo public, enable Pages (GitHub Actions) | GitHub |
| 1 | Supabase data layer in the app; tweet snapshot mapping; People uses tweet names | test DB, local + test site |
| 2 | Server functions: create-post, upload-photo, delete-post, admin (+ moderation broadcast) | test project |
| 3 | Error handling: field errors, drafts, retries, rate-limit messages | test |
| 4 | Launch polish: placeholders, noindex test site, favicon/OG, region decision | test |
| 5 | Full test pass on the test site (checklist below), phone + two browsers | test |
| 6 | Production: apply migrations + functions + secrets to production, seed real content, create `production` branch → deploy, smoke test | production |
| 7 | During the event: moderate via admin, watch function logs | production |

## 6. Test checklist (step 5)
- [ ] Feed loads < 2 s on mobile data with 40 posts
- [ ] Paste a real tweet (text-only, with photos, with a long text, a reply, a deleted one, a protected one) → correct card or clear error
- [ ] Same tweet twice → "Already on the wall"
- [ ] Wall post, met card with 4 photos, talk notes → appear on a second phone within 2 s
- [ ] Every field typed appears on the card
- [ ] Each form shows field errors for empty/too-long/invalid input; server rejections land on the right field
- [ ] Upvote once per device; count updates on the other phone
- [ ] ⋮ → Delete on any post removes it on the other phone; admin can restore it; rapid repeated deletes get rate-limited
- [ ] Admin: seed, quick add, hide → disappears live elsewhere; admin unreachable without the secret
- [ ] People: search, metrics, Config card PNG on iPhone and Android, share to X opens with the right link
- [ ] Airplane mode mid-post → draft kept, retry works
- [ ] No test banner and no demo data in production
