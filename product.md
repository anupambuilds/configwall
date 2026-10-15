# Config BLR Wall — Product Requirements

> Unofficial, community-built recap wall for Figma Config Bangalore.
> Status: **frontend wireframe running locally on mock data**; backend not started.

---

## 1. What this is

A live, public **feed** of what people took away from Config Bangalore. It has three kinds of entry:

- **Posts**: X-first. Mostly real X posts pulled onto the wall and shown as faithful tweet cards. People can also write a post here and push it to X.
- **People we met**: who you met, who they are, how to find them, and what you talked about. **This is the most valuable part of the product.**
- **Talk notes**: notes from a specific talk.

It works in both directions: X posts come onto the wall, and anything written on the wall can be posted to X in one tap.

The builder was not at the event, so the product is **online-first**: it pulls the conversation already happening on X into one place and lets attendees add to it directly. No login. Every entry credits its author.

### Why

- Remote designers want the highlights without scrolling X for hours.
- Attendees want to share what they learned and who they met, and get a shareable artifact out of it.
- The builder wants to show fast product/design execution and become visible in the Bangalore design community.

### Ground rules

- **Unofficial.** No Figma or Config logos, colours or branding. "Unofficial" is visible in the header and on the share card.
- **Credit everyone.** Every entry shows an author handle (or "Anonymous"). Shared posts link to the original tweet.
- **Never invent content.** Seeds are real, credited posts. Mock data exists only for local development and uses obvious `demo_` handles.

---

## 2. Users

| User | Wants | Primary screens |
|---|---|---|
| **Attendee** | Bring their X posts in, log who they met, share talk notes, get a Config card to post | Feed, Add, People |
| **Remote designer** | Skim the best of the day, read notes per talk | Feed (Top sort), single post |
| **Admin (builder)** | Seed content before launch, remove spam | Admin |

---

## 3. Features

### 3.1 Feed — `/`
- Header: title, "What Bangalore designers took away from Config: the posts, the people, the talk notes. Unofficial, built by @handle", live counter (`N posts · M people`).
- **Counters** (tab counts and the header’s posts/people): exact up to 100, then rounded down in steps of 50: 100+, 150+, 200+, 250+…
- **Tabs** (each with a count): **All** · **Posts** · **People we met** · **Talk notes**.
  - **All**: everything mixed, newest first. No filters.
  - **Posts**: sub-filters **All posts · Takeaways · Quotes · Stories · Photos · Reviews**. "Takeaway" is just a post type.
  - **People we met**: only met cards.
  - **Talk notes**: a mixed feed of all notes by default. A talk dropdown (default **All talks**) and a **Group by talk** toggle, which shows notes under each talk in schedule order; each group heading has the note count and "+ Add notes".
- **Toolbar:** tabs and **Latest / Top** sit on one row (sort right-aligned; tabs scroll on small screens). The second row only appears for Posts (type sub-filters) and Talk notes (talk dropdown + Group by talk).
- Everything lives in the URL (`?tab=posts&kind=quote&sort=top`, `?tab=notes&talk=…&group=talk`), so any view is shareable.
- **Masonry grid:** 1 column under 640px (phones), 2 from 640px (tablets), **3 max** from 1024px (desktop), so every card, especially embedded X posts, gets enough room. Shortest-column-first placement keeps the reading order roughly chronological.
- **Realtime:** other people's posts wait behind a "↑ N new posts" pill; your own appear immediately and animate in.
- **Add card:** the first card on every tab is a small dashed "+" card.
  - All → "Add to the wall", which opens the type picker (Post / Someone I met / Talk notes).
  - Posts → opens the Post form, with the type pre-selected if a sub-filter is active ("Add a quote").
  - People we met → opens the met form. Talk notes → opens the notes form, with the talk pre-selected if one is filtered.
- **Empty state per tab** with a matching CTA ("Share your X post", "Add someone you met", "Add notes from a talk").
- **The single-entry page** (`/p/`) has a **"+ Add"** button in the top nav. The People page has none. The floating "Add to the wall" button is gone.

### 3.2 Card designs
Two card families. **Every field entered at creation appears on the card.**

**Post card**: one design for every post, whether from X or written on the wall.
- Header: avatar, name, @handle, time. Top-right: the **X logo** (links to the tweet) for X posts, or a **"Wall post"** label for native posts.
- **Type tag** (Takeaway / Quote / Story / Photo / Review), colour per type; Review is grey.
- Text with @mentions, #hashtags and links styled like X (quotes in large serif), a 1–4 photo grid like X's, "Tagged" people chips.
- Footer: **View on X ↗** (X posts only), then engagement: 𝕏 post-to-X (wall posts only), copy link, upvote.
- If the tweet's saved copy isn't available, the body falls back to X's official embed, lazy-loaded, still with the type tag and footer, with exactly 12px above and below the tweet. If X doesn't load it within 10 s, a "View on X" card shows instead.

**Editorial card**: same layout in two colours.

| | People we met (purple) | Talk notes (yellow) |
|---|---|---|
| Pill | PEOPLE WE MET | TALK NOTES |
| Headline (serif) | **@you met Priya** | the talk name |
| Sections (dashed dividers) | **Who Priya is**: designation at company, X and LinkedIn chips · **What we discussed** (expands after 5 lines) · **Photos** (1–4, X-style grid) | the notes (expand after 7 lines) |
| Footer | time, 𝕏, copy link, upvote | @author, time, 𝕏, copy link, upvote |

### 3.3 Add to the wall
Step 1 picks one of **three** sections, step 2 is a short form, step 3 is a success screen.

**① Post** (X-first). Two modes, defaulting to the first:

| Mode | Fields | Required |
|---|---|---|
| **Paste an X link** | X post URL → the post is fetched and previewed; the author handle is **auto-filled from the post** · post type | URL, type |
| **Write a post** | text (280) · tag people (@handles) · post type · your X handle | text, type, your handle |

Post types: **Takeaway · Quote · Story · Photo · Review**. Posts don't carry a talk.

**Duplicate tweets.** A tweet can be on the wall only once. The duplicate key is the **tweet id**, so `twitter.com` vs `x.com`, `?s=20`, `/photo/1` and `mobile.` links all count as the same post.
- As soon as a link is pasted, the form checks the wall. If it's already there, it shows a red **"Already on the wall"** flag ("This post by @handle was added 2h ago. Each post can only be shared once." + **View it on the wall ↗**) instead of the preview, and posting is blocked.
- The check runs again on submit, in case someone else shared it in the meantime.
- If the earlier copy was **deleted**, sharing it again **restores the original post** (same id and upvotes) instead of creating a second one. Native posts have no photo upload; photos come from tweets.

**② Someone I met**

| Field | Notes |
|---|---|
| Their name | |
| Designation · Company | |
| Their X handle | Recommended: it links you both on People, and gets them tagged on X |
| Their LinkedIn | `linkedin.com/in/…` |
| What did you talk about? | up to 1000 chars |
| Photos | optional, **up to 4**, multi-select; each compressed on the device to 1200px, removable before posting |
| Your X handle | required |

Required: name **or** X handle **or** LinkedIn, plus the conversation and your handle.

**③ Talk notes**

| Field | Notes |
|---|---|
| Which talk? | required, from the fixed talk list (pre-selected when opened from a talk group's "+ Add notes") |
| Your notes | required, up to 1000 chars |
| Your X handle | optional |

**Common**
- Your X handle is pre-filled from the device and saved after your first post.
- Required-field validation, character counters, and a basic profanity / link-spam check.
- twitter.com links are normalised to x.com.

**Deleting posts (only the poster)**
- **Only the person who posted can delete it.** With no logins, "the poster" = **the device and browser they posted from**. Posts made from this device show a **⋮ (kebab) menu** in the card footer → **Delete post** → inline confirm ("Delete this post? It will be removed from the wall for everyone.") → Cancel / Delete → toast "Post deleted". It disappears live for everyone.
- How it's enforced: each device has a random private id; it's stored with the post in a column the public can't read, and the device remembers its own post ids. The server deletes only when the requesting device's id matches the post's.
- Limits: deleting must happen from the same phone/browser used to post; clearing browser data or a private window loses that ability; admin-seeded posts have no owner device. **Admin can remove or restore anything** from Moderate.
- Delete is a **soft delete** (the post is hidden, not erased), restorable by admin.

**After posting**
- The sheet closes, a toast says **"Post is being added to the wall"**, and you're taken to the wall (the feed, scrolled to the top, where your post appears). No success screen.
- Posting to X happens from the card itself: every wall post, met card and talk note has a 𝕏 button that opens X with the text pre-filled, a link back to the entry, the hashtag, and (for met cards) the person tagged.

### 3.4 People — `/people/`
Everyone engaging with the wall, with their metrics. **No leaderboard:** no ranks, no sorting by score.

**Directory**
- One row per person: initials avatar, name, @handle, designation at company, and metrics: **posts · met · upvotes · active Xm ago**. A "You" badge marks your own row.
- **Search** by name or @handle, instant and case-insensitive (`@` optional), with a "N of M people" count.
- **Order:** most recently active first.
- Each row opens the person's activity; a **card icon** button on the row (tooltip "Config card") opens their card in a side panel.
- No add button on the People page (it's for browsing).
- **"You met N people"** panel at the top (when your handle is saved on this device): chips for each person, **Copy list** and **Download CSV** (`name, role, company, x_handle, x_url, linkedin, talked_about, logged_at`).

**Person view** (`/people/?p=x:handle`, or the `?h=handle` shortcut)
- Name, @handle, designation at company; **card icon** (Config card), X profile and LinkedIn buttons.
- Metric tiles: Posts, People met, Upvotes.
- "Met" chips linking to each connection.
- **Activity:** starts with an **Add to the wall** card (opens the type picker), then everything they posted plus met cards about them, newest first.

**Identity and connections**
- People are identified by X handle, otherwise LinkedIn profile, otherwise the typed name. Someone added by name now and by handle later shows up as two entries; the form nudges people to add a handle.
- A met card from A about B counts as one connection for **both** A and B; repeat cards about the same pair count once.

### 3.5 Config card — side panel (`/people/?card=x:handle`)
- Opens from the People directory, a person's page, or "Make your card" after posting. It's in the URL, so the link can be shared and opens straight to the card.
- **1080×1350 card:** "My Config BLR" + "Unofficial" badge; name, @handle and designation at company; metrics (**posts · people met · upvotes**); the person's **top post** (most upvoted). If nothing has upvotes yet, it shows their **latest post** instead and is labelled accordingly. Footer with the site URL.
- **Save image:** PNG made on the device (`html-to-image`); on phones it opens the native share sheet.
- **Share on X:** opens X with "@handle's Config BLR in one card. Add yours:" and the card link.
- **Open the top/latest post →** goes to that post's page.
- No separate card page and no add buttons on the card.

### 3.6 Single entry — `/p/?id=…`
- One entry, full width, with "Featured on the Config BLR Wall" copy. This is the target of every card's link button and of every "Post on X" link.

### 3.7 Admin mode (on the wall)
Admin uses the **same wall as everyone**, with extra powers.

**Unlocking:** `/admin/` shows an **"Admin secret"** box → **Unlock**. The device remembers it until **Lock**; a remembered secret is re-checked on every visit. Live, the server checks the secret on every admin action (step 2); until that exists, live builds stay locked. Locally the secret is `local-admin`. If it leaks, generate a new one; the old one stops working.

**While unlocked**, a dark **admin bar** sits under the nav on every page: **ADMIN** badge · **Show hidden** toggle · **Read-only** switch · **Lock**.

| # | Power | How |
|---|---|---|
| 1 | **Delete any post** | Every post's ⋮ menu shows **Delete post (admin)** (your own posts show the normal Delete). Soft delete: hidden, restorable. |
| 2 | **Post any tweet, several at once** | The Post form's X link box accepts **several links** (one per line). Each is fetched and added with the chosen post type, credited to its author; ones already on the wall are skipped; a toast reports "Added N posts (skipped: …)". Admin posts are marked as seeds and aren't rate-limited. |
| 3 | **See and restore hidden posts** | **Show hidden** adds deleted/hidden posts to the wall, greyed inside a dashed frame with a "Hidden from the wall · **Unhide**" strip. |
| 4 | **Admin badge + Lock** | The admin bar shows you're in admin mode; **Lock** leaves it (and forgets the secret on this device). |
| 5 | **Talk notes on someone's behalf** | In admin mode the notes form's handle field becomes **"Credit to (X handle…)"**, empty by default; the notes are credited to that person and don't change your saved handle. |
| 9 | **Read-only switch** | Pauses posting and deleting **for everyone except admin**, live on every open screen. Visitors see "Posting is paused right now. You can still browse and upvote."; add cards and the + button show a "paused" toast; ⋮ Delete disappears for non-admins. Stored in a one-row `settings` table (public read, admin-only write). |

`/admin/` itself, once unlocked, only explains admin mode with **Go to the wall**, **Lock** and (local only) **Reset mock data**. The old back-office tabs (bulk seed, quick add, moderate list) were replaced by the above.

### 3.8 Visual style
- **Paper** design: Instrument Serif headlines, Geist body text.
- **Background:** warm off-white `#f5f2ea`; cards `#fffdf8`.
- **Primary colour:** near-black `#1c1b19` with white text (buttons, add cards, the "+ Add" nav button, upvoted state, the "Wall" accent in the header).
- **Live indicator:** the blinking dot next to "Live" in the header is green `#16a34a`.
- **Add cards:** dashed outline; on hover the outline stays and the card gets a light grey tint (no black border).
- **Card colours:** purple for people we met, yellow for talk notes, a pastel per post type (Review is grey).
- All colours are CSS tokens in `src/app/globals.css`; components only use tokens (except LinkedIn's brand blue).

### Non-goals (v1)
Accounts or auth, comments, DMs, auto-pulling posts from X by hashtag, notifications, editing entries after publishing, LinkedIn post embeds.

---

## 4. User flows

### Flow A: Attendee already tweeted (X → wall)
1. Opens the wall from a link on X.
2. **Add to the wall** card on All → **Post** → *Paste an X link* → the preview appears with their name and photos → handle auto-filled → type "Photo" → **Post**.
3. It appears as an X-style card under All and Posts › Photos. Success screen → **Make your card**.

### Flow B: Someone I met (wall → X)
1. People we met tab → **Add someone you met** card → "Priya Sharma", Design Lead, Acme, @priya, LinkedIn → "Talked about running remote crits. Felt less alone." → adds 3 photos → your @handle → **Post**.
2. Purple connection card appears under All and People we met; both of you get +1 connection on `/people/`.
3. **Post on 𝕏** → X opens with "Met Priya Sharma (@priya), Design Lead at Acme, at Config BLR …" + link → Priya gets notified → comes to the wall and logs her own. *(growth loop)*
4. Later: People → **You met N people** → Download CSV.

### Flow C: Talk notes
1. Feed → **Talk notes** → the "Add talk notes" card (or, with **Group by talk** on, "+ Add notes" under "Design systems at scale", which pre-selects the talk) → notes → **Post**.
2. The note appears at the top of the feed (and in that talk's group). **Post on 𝕏** → followers click → land on `/p/?id=…` → **+ Add** in the nav.

### Flow D: Takeaway as a post
1. Posts tab → **Add a post** card → *Write a post* → "The best teams write more than they draw" → type **Takeaway** → **Post** → **Post on 𝕏**.
2. Appears under Posts › Takeaways.

### Flow E: Native post
1. Posts tab → **Add a post** card → *Write a post* → text → tags @rahul → type "Story" → your handle → **Post** → **Post on 𝕏**.

### Flow F: Remote designer catches up
1. Opens `/?tab=notes&group=talk` → reads notes talk by talk (or picks one talk from the dropdown) → switches to Posts › Takeaways, sorted Top → upvotes → shares one card.

### Flow G: Admin seeds and moderates
1. Before launch: `/admin/` → enter the admin secret → paste 15–20 X URLs from event hashtags, one batch per post type → **Create posts**.
2. Quick-add credited talk notes (e.g. from speakers' own threads).
3. During the event: Moderate → search → **Hide** spam (it disappears live from everyone's feed).

### Flow H: Realtime
1. Two people have the feed open. A posts → it appears instantly for A; B sees "↑ 1 new post" → taps → it slides in.

---

## 5. Tech requirements

### Project links
- Code: https://github.com/anupambuilds/configwall (public).

### Environments
| | Site | Supabase project | Deployed from |
|---|---|---|---|
| **Local** | `http://localhost:3000` | test (`gwgrxwgpovpswwqppexf`) via `.env.local` | your machine |
| **Test** | `https://anupambuilds.github.io/configwall/test/` | test (`gwgrxwgpovpswwqppexf`) | every push to `main` |
| **Production** | `https://anupambuilds.github.io/configwall/` | production (`olmdpakuiawvtiolbhne`, "Config Wall") | the `production` branch |

- Both Supabase projects are in `ap-northeast-2` (Seoul) and have the same schema (`0001_init.sql` applied and verified on both).
- Non-production builds show a yellow banner ("Test environment… / Local development") with the data source.
- **Until a `production` branch exists, the public URL shows a "coming soon" page.** Launch or release = update the `production` branch (merge `main` into it).
- One GitHub Actions workflow (`.github/workflows/deploy.yml`) builds both sites into one GitHub Pages deployment; it runs `check:schema` on every build.
- Only public values (project URLs, publishable keys) are in the repo. Secret keys and database passwords stay in Supabase / a git-ignored local file.

### Hosting: GitHub Pages (static)
- **Next.js 16 (App Router) + TypeScript + Tailwind v4**, built with `output: "export"` into `out/`.
- `basePath` comes from `NEXT_PUBLIC_BASE_PATH` (e.g. `/config-blr-wall` for a project site); `trailingSlash: true` so GitHub Pages serves `folder/index.html`.
- Deployed by a GitHub Actions workflow (build, then upload `out/` to Pages).

**What static hosting rules out, and how we handle it:**

| Assumption | On GitHub Pages | Our approach |
|---|---|---|
| Dynamic routes `/people/[handle]`, `/p/[id]` | Not possible without knowing every id at build time | Query params: `/people/?p=…&card=…`, `/p/?id=…` |
| Per-card / per-post OG images | No server to render them | One static site-wide OG image. Optional later: an Edge Function that returns OG HTML. |
| Fetching tweet data | The browser blocks cross-origin calls to X | Supabase Edge Function `resolve-tweet` fetches it once when the post is added |
| Server-side validation, admin key check | No server | Supabase RLS, Postgres constraints and an Edge Function / RPC for admin actions |
| `.env` secrets | Every `NEXT_PUBLIC_*` value ships in the JS bundle | Only the Supabase **anon** key in the frontend; never the service-role key |

### Data layer
- All UI code talks to a single `Store` interface (`src/lib/store.ts`): `listPosts`, `getPost`, `createPost`, `upvote`, `myVotes`, `setHidden`, `uploadPhoto`, `resolveTweet`, `subscribe`.
- **Now:** a mock implementation using localStorage, with BroadcastChannel to fake realtime between tabs. `resolveTweet` knows only the demo tweets; any other link falls back to the embed.
- **Next:** a Supabase implementation behind the same interface, so the UI doesn't change.

### Tweet snapshots
- When an X link is added, `resolveTweet(url)` returns `{ id, url, text, author_name, author_handle, author_avatar, created_at, photos[], mentions[] }`, stored on the post.
- Backend: an Edge Function calls X's public syndication endpoint (the one `react-tweet` uses). It's unofficial, so it may break or be rate-limited. If it fails, the post is saved without a snapshot and renders with the official embed. Photos should be copied to our storage so cards still work if the tweet is deleted.

### Data captured (and where it lives once live)
Everything the frontend collects has a column. `npm run check:schema` fails if a `Post` field is missing from the contract (`src/lib/db.ts`) or from the migration.

| Collected in the UI | Stored as |
|---|---|
| Entry type, post type, source (X / wall) | `posts.type`, `kind`, `source` |
| Wall post text, met conversation, talk notes | `posts.body` |
| X link + fetched tweet (text, photos, author, avatar, mentions, date) | `posts.link_url`, `posts.tweet` (jsonb), `posts.tweet_id` (dedupe, DB-only) |
| Tagged people on wall posts | `posts.tagged` (text[]) |
| Person met: name, designation, company, X handle, LinkedIn | `posts.met_name`, `met_role`, `met_company`, `met_handle`, `met_linkedin` |
| Met photos (up to 4) | Storage bucket `photos` → URLs in `posts.photos` |
| Talk (for notes) | `posts.talk` |
| Your X handle | `posts.author_handle` (also remembered in the browser) |
| Upvotes | `votes(post_id, device_id)` + `posts.upvotes` |
| Device id | `votes.device_id`, `posts.device_id` (DB-only: rate limits, moderation) |
| Admin: hide / seed | `posts.hidden`, `posts.is_seed` |
| People, connections, metrics, last active | Computed from `posts`; not stored separately, so never out of sync |

Links are canonicalised before saving: X → `https://x.com/{handle}/status/{id}`; LinkedIn → https, no query.

### Backend (Supabase): to build
- **Migration applied** to both projects: `supabase/migrations/0001_init.sql` (tables, per-type check constraints mirroring the form rules, RLS, column grants hiding `device_id`, `upvote`/`my_votes` RPCs, realtime publication, `photos` bucket). Verified with the public key: reads visible posts only; cannot insert, read votes or see `device_id`; one upvote per device; hidden posts disappear; invalid data is rejected by the database.
```sql
posts (
  id uuid pk default gen_random_uuid(),
  type text not null check (type in ('post','met','note')),
  author_handle text,
  body text,                                   -- post text / met conversation / talk notes
  -- post
  source text check (source in ('x','native')),
  kind text check (kind in ('takeaway','quote','story','photo','review')),
  link_url text,
  tweet jsonb,                                 -- saved tweet snapshot
  tagged text[] not null default '{}',
  -- met
  met_name text, met_role text, met_company text, met_handle text, met_linkedin text,
  photos text[] not null default '{}',         -- up to 4
  -- note
  talk text,
  upvotes int not null default 0,
  hidden bool not null default false,
  is_seed bool not null default false,
  created_at timestamptz not null default now(),
  check (type <> 'post' or kind is not null),
  check (type <> 'note' or talk is not null),
  check (cardinality(photos) <= 4),
  check (char_length(body) <= case when type = 'post' then 280 else 1000 end)
)
votes (post_id uuid references posts, device_id text, primary key (post_id, device_id))
```
- **RLS:**
  - anon can `select` where `hidden = false`;
  - anon can `insert` only `WITH CHECK (upvotes = 0 AND hidden = false AND is_seed = false)`;
  - no anon `update` or `delete`.
- **`upvote(post_id, device_id)`** as a `SECURITY DEFINER` RPC that inserts the vote and increments the count atomically (one vote per device).
- **Storage:** public `photos` bucket for met-card photos (and copies of tweet photos), images only, ≤ 2 MB per file.
- **Edge Functions:** `resolve-tweet`, plus admin actions (seed, quick add, hide). The service-role key stays inside Supabase.
- **Realtime:** turn on the `posts` publication; the client listens for INSERT and UPDATE events.
- **Rate limiting:** basic per-device / per-IP limits on insert.

### Client
- Identity: X handle stored in localStorage; a device id (UUID) in localStorage for votes.
- Post to X via the X web intent (`x.com/intent/post`): no API key, nothing to log into.
- X embed fallback: `widgets.js` loaded once, only when a card is near the viewport.
- Photos compressed on the device before upload.
- Share card: `html-to-image` (DOM → PNG), loaded only when needed.

### Quality bar (acceptance)
- [ ] Feed loads in < 2s on mobile with 40 seed posts
- [ ] Each tab shows the right entries; Posts sub-filters work; Talk notes default to a mixed feed, "Group by talk" groups them, the dropdown filters to one talk
- [ ] The add card opens the right form on each tab (type picker on All, pre-selected type/talk where filtered)
- [ ] Add each of: X-link post, native post, met (with several photos), talk notes. Each appears live in another browser
- [ ] Every field entered shows up on its card
- [ ] Pasting an X link shows a preview and auto-fills the handle; an unknown tweet falls back to the embed
- [ ] "Post on 𝕏" opens a pre-filled post with a link back to the wall; met posts tag the person
- [ ] One upvote per device
- [ ] People metrics (posts, met, upvotes) are correct; CSV includes company
- [ ] People search finds by name and handle; Config card opens in the side panel; PNG downloads; the X share link opens the card
- [ ] Admin can bulk-seed and hide; the admin page shows nothing without the key
- [ ] No Figma/Config logos; "Unofficial" visible in the header

---

## 6. Open questions
- Real talk list + speaker names for the day (currently placeholders in `src/lib/config.ts`).
- The event hashtag people are actually using (`HASHTAG` in `src/lib/config.ts`, placeholder `ConfigBLR`).
- Builder handle for the credit line (`NEXT_PUBLIC_BUILDER_HANDLE`).
- Is "Config" in the product name OK, given the no-branding rule?
- Talk notes: should they get photo upload too (e.g. photos of slides or notebooks)? Currently no; easy to add.

---

## 7. Change log

Newest first. The sections above always describe the current product; this log records what changed and why.

### 2026-10-15 — Toggle switch fixed
- The admin bar switches collapsed because their track and knob were inline spans (size ignored). Rebuilt as a reusable `Toggle` (36×20 track, 16px knob, accessible `role="switch"`), verified with a headless screenshot in both themes and states.

### 2026-10-15 — Admin mode on the wall
- Admin is now the **same wall with extra powers**, via a dark admin bar (ADMIN · Show hidden · Read-only · Lock): delete any post, see and **Unhide** hidden posts on the wall, paste **several X links at once** in the Post form, add talk notes **credited to any handle**, and a **read-only switch** that pauses posting/deleting for everyone else live.
- `/admin/` is now just the unlock screen (and a short explainer once unlocked); the old back-office tabs are gone.
- New migration `0003_settings.sql` (one-row `settings` table with `read_only`, public read, realtime), applied to the **test** project only.

### 2026-10-15 — Admin unlocked with a secret
- `/admin/` no longer uses a `?key=` link. It shows an **"Admin secret"** box: paste once per device, **Unlock**, and it's remembered until **Lock**. Live builds verify the secret on the server (step 2) and stay locked until then; locally the secret is `local-admin`.

### 2026-10-15 — Only the poster can delete
- Delete is back to **owner-only**: the ⋮ → Delete menu shows only on posts made from this device, and the store refuses deletes from other devices. When live, the server checks the device id against the post's private `device_id`. Still a soft delete; admin can remove or restore any post.

### 2026-10-15 — Max 3 columns
- The feed (and person activity) now caps at **3 columns** on desktop (was 4), with 2 columns from 640px and 1 below. Cards get ~290–330px of content width on desktop, so embedded tweets are no longer cramped.

### 2026-10-15 — Embedded X posts respect the card padding
- X’s embed has a ~250px minimum width set inline, wider than a card’s content area in 3–4 column layouts, so it overflowed and hid the right padding. The embed is now forced to the card’s content width (and clipped if X still renders wider), keeping 16px padding on both sides.

### 2026-10-15 — Exact spacing around embedded X posts
- Embedded tweets now have exactly **12px** above (from the post-type tag) and **12px** below (to the footer). X’s own ~10px embed margin is zeroed so the gap no longer depends on X.

### 2026-10-15 — Duplicate tweet detection
- Pasting a tweet that's already on the wall shows an "Already on the wall" flag with a link to the existing post, and blocks posting (checked on paste and again on submit). Duplicates are matched by tweet id across all link variants.
- Re-sharing a tweet whose post was deleted restores the original post instead of duplicating it.

### 2026-10-15 — Delete on every post
- The ⋮ → Delete option is now on **every** post, not just ones made from this device (no ownership, no logins). Delete hides the post from the wall for everyone; admin can restore it from Moderate.
- Removed the "posts made on this device" tracking.

### 2026-10-15 — Delete own posts, calmer focus, roomier X embeds
- **Delete:** posts made from this device get a ⋮ menu with **Delete post** and an inline confirmation; deletion removes it live everywhere (mock now; server function checks the device id when live).
- **Text fields:** focus now just darkens the field's border; the extra outline ring is gone (checkboxes, buttons and links keep the keyboard focus ring).
- **Embedded X posts:** more space between the type tag, the tweet and the footer (removed the negative margins).

### 2026-10-15 — Footer: visitors, builder handle, Built with Claude Code
- Site footer on every page (except admin): unique visitor count (one per device, via `record_visit` RPC; migration `0002_visits.sql`, applied to the test project only), the builder’s X handle, and “Built with Claude Code”.
- Still to do: real X handle in `NEXT_PUBLIC_BUILDER_HANDLE` (placeholder `yourhandle`); apply 0002 to production at go-live step 6.

### 2026-10-15 — Go-live audit, CLAUDE.md, X embed fix
- Fixed X posts stuck on "Loading post from X…": the embed target was hidden while loading (X never reports it rendered), and nothing timed out. It now loads in a laid-out, invisible box and falls back to a "View on X" card after 10 s.
- Added `docs/go-live.md`: every piece of data on every page and form mapped to its source, launch blockers, and the step-by-step plan with a test checklist. Verified that X’s tweet endpoint works but blocks browsers (CORS), so tweets must be fetched by a server function.
- Added `CLAUDE.md`: rules, tech stack, environments, architecture, data mapping and ways of working.

### 2026-10-15 — No success modal after posting
- Submitting any post now closes the sheet, shows "Post is being added to the wall" and takes you to the wall. The success screen (Post on X / Make your card / Done) is removed; the 𝕏 button on each card still posts it to X.

### 2026-10-15 — Supabase set up; test environment
- Applied the schema to the production project and verified it end to end with the public key (then removed the test data).
- Created a separate **test** Supabase project (`configwall-test`, `gwgrxwgpovpswwqppexf`) with the same schema.
- Added environments: local and the hosted **test site** (`/configwall/test/`, from `main`) use the test database; **production** (`/configwall/`) deploys only from a `production` branch, and shows "coming soon" until then.
- GitHub Actions workflow for GitHub Pages; yellow environment banner on non-production builds.
- The app still runs on mock data; the Supabase data layer is next.

### 2026-10-15 — Add card on person pages
- The Activity section of every person page now starts with the **Add to the wall** card (opens the type picker). The add card is now a shared component used by the feed and People.

### 2026-10-15 — Repo and Supabase project
- Code pushed to https://github.com/anupambuilds/configwall; Supabase project `olmdpakuiawvtiolbhne` created. Site base path will be `/configwall`.

### 2026-10-15 — Card icon, no add on People, data contract + migration
- People rows and the person view use a **card icon** for the Config card instead of the text label.
- Removed the "+ Add" nav button from the People page.
- Added the **data contract** (`src/lib/db.ts`), the first **Supabase migration** (`supabase/migrations/0001_init.sql`) and `npm run check:schema`, which fails if any field the frontend collects has no column.
- Links are canonicalised (X status URLs → `https://x.com/{handle}/status/{id}`; LinkedIn → https without query) so they always pass the database checks.

### 2026-10-15 — People directory + Config card side panel; card page removed
- **Removed the standalone card page** (`/card/`) and the "My card" nav link.
- **People** is now a directory, not a leaderboard: no ranks; each row shows posts, people met, upvotes and last activity; most recently active first; **search by name or @handle**.
- Each person has a **Config card** button that opens the card in a **side panel**: metrics (posts, people met, upvotes) and their **top post**, or **latest post** if nothing has upvotes yet. Save as PNG, Share on X, open the post. The panel is in the URL (`/people/?card=…`) so card links are shareable.
- Person view gained metric tiles and an "Activity" section (their posts plus met cards about them).
- "Make your card" after posting now opens your Config card on the People page.

### 2026-10-15 — Card page: no add entry points
- Removed the "+ Add" nav button and the "Add a takeaway to fill your card" button from the card page; it is only for viewing and sharing the card.

### 2026-10-15 — Green live dot, softer add-card hover, Tailwind setup fix
- The blinking "Live" dot is now green (`--live: #16a34a`).
- Add cards no longer turn their border black on hover; they get a light grey tint instead.
- Dev fix: switched Tailwind from the custom `@tailwindcss/turbopack` loader rule to the standard `@tailwindcss/postcss` plugin (`postcss.config.mjs`), as the Next docs recommend. The old setup kept serving stale CSS after edits; consecutive CSS edits now update live.

### 2026-10-15 — Black primary, playground removed
- Removed the colour playground (`/themes/`), the per-palette CSS and the theme-switching script.
- Primary colour is now near-black `#1c1b19` (was orange `#ff5b1f`); the background stays warm off-white `#f5f2ea`.
- Dev note: the dev server sometimes served a stale stylesheet after CSS changes; `npm run dev:clean` restarts it with a fresh cache.

### 2026-10-15 — Colour playground replaces theme playground
- Kept the original Paper design; removed the Midnight, Studio, Jacaranda and Newsprint themes and their fonts (Space Grotesk, JetBrains Mono, Fraunces, Playfair).
- `/themes/` is now a colour playground: the original plus five palettes that change only the background and primary colour (Sage & Terracotta, Mist & Cobalt, Blush & Plum, Butter & Forest, Stone & Teal). All five have better text contrast than the original orange.
- Nav link renamed "Colours".

### 2026-10-15 — Theme playground
- Added `/themes/`: five themes (Paper, Midnight, Studio, Jacaranda, Newsprint) previewed side by side with real cards, with **Apply** to switch the whole site (saved per browser).
- All hard-coded colours in components replaced with theme tokens (surface, danger, link, met/note backgrounds and lines, tag colours); display font and corner radii are per-theme tokens too.
- Added the "Themes" link to the top nav (desktop).

### 2026-10-15 — Rounded counters
- Tab counts and the header’s posts/people counter show exact numbers up to 100, then 100+, 150+, 200+, 250+… (steps of 50). Upvote counts stay exact.

### 2026-10-15 — Add cards, sort on the tab row, Talk notes view toggle
- **Talk notes** now default to a mixed feed; **Group by talk** is an optional toggle (`&group=talk`) next to the talk dropdown.
- **Latest / Top** moved onto the tab row (right-aligned). The second toolbar row only appears for Posts and Talk notes.
- **Removed the floating "+ Add to the wall" button.** Every tab now starts with a small **Add card**: on All it opens the type picker; on other tabs it opens that tab's form directly, pre-selecting the post type (Posts sub-filter) or talk (Talk notes filter).
- Pages outside the feed (People directory, My card, single entry) get a **"+ Add"** button in the top nav.
- **Review** type tag is now grey.

### 2026-10-15 — Feed refinements: Talk notes, one post card, purple met card
- **Takeaways tab → Talk notes.** Talk notes are just a talk (required) + notes (1000 chars); no headline, no "outside the talks". The tab groups notes under each talk, with a talk dropdown (default **All talks**).
- **Takeaway is now only a post type** (with Quote, Story, Photo, Review). The separate takeaway card is gone; posts no longer carry a talk.
- **Talk filter dropdown removed** from All; it only exists inside Talk notes.
- **One post card design** for X and wall posts: type tag, X logo (X posts) or "Wall post" label (native), "View on X", engagement row (𝕏 for wall posts, copy link, upvote).
- **People we met** now uses the editorial card in purple: "@you met Priya" → who they are → what we discussed → photos.
- **Multiple photos on met cards** (up to 4, multi-select, removable). The demo feed includes a met card with 3 photos.
- Data model: `type` is now `post | met | note`; `photo_url` → `photos[]`; removed `context` and `notes` (a note's text is `body`).
- Admin quick add now creates talk notes. My card logic is unchanged for now (to be revisited).

### 2026-10-15 — Feed rebuilt as three sections (Posts · People we met · Takeaways)
- **Feed tabs:** All · Posts · People we met · Takeaways, with counts. Posts has sub-filters (Takeaways, Quotes, Stories, Photos, Reviews). Posts typed "Takeaway" also show in the Takeaways tab. The talk filter applies to All and Takeaways.
- **Posts are X-first:** pasting an X link fetches the tweet (text, photos, author, mentions), shows a preview and auto-fills the handle. Posts render as **our own X-style card** from that saved copy, falling back to X's embed. Native posts are written on the wall, can tag people, and can be posted to X.
- **Reviews** are now a post type, not their own section. Ratings were dropped.
- **People we met** gained designation, company and an optional photo together. The conversation can be up to 1000 chars. "Post on 𝕏" tags the person.
- **Takeaways** gained "Outside the talks" with free-text context, plus a separate notes field (1000 chars). The takeaway itself stays at 280 so it fits on X.
- **Photos:** shown when the tweet has them, and one optional photo on met cards. No uploads on native posts or takeaways. Storage is back in the backend plan.
- **Card designs:** three distinct cards (white X-style post, purple connection card, yellow editorial takeaway), each showing every field from creation. Every native card has a 𝕏 button.
- **LinkedIn post links are no longer accepted** for posts (Posts are X-only). LinkedIn stays as a profile link on met cards.
- Data model: `type` is now `post | met | takeaway`; added `source`, `kind`, `tweet` (snapshot), `tagged`, `met_company`, `photo_url`, `context`, `notes`; removed `tag`, `disliked`, `rating`.
- Store: added `resolveTweet` and `uploadPhoto`. Admin bulk seed fetches each tweet and is X-only. CSV export adds company.

### 2026-10-15 — Four-section posting + wall → X
- **Add to the wall** now has four sections instead of six post types: **Share your X post**, **Takeaway**, **Who I met**, **Review**.
  - Shared X/LinkedIn posts are tagged Takeaway / Quote / Story / Photo so they show under the wall's filters.
  - Takeaways can be written on the wall or shared from X, and can be about a specific talk or *the event overall*.
  - Who I met accepts an X handle, a LinkedIn profile, or just a name + role, plus what you talked about / how it felt.
  - New **Review** section: optional ★ rating, what you liked, what could be better.
- **Wall → X:** after posting a takeaway, met or review, the success screen offers **Also post on X** (pre-filled text + link back to the wall + hashtag; tags the person you met).
- **Removed** native photo, quote and story posts. Photos, quotes and stories now come in as tagged X posts, so the backend no longer needs Storage.
- Wall chips: All, Takeaways, People met, Reviews, From X, Quotes, Stories, Photos.
- People: people are identified by X handle, then LinkedIn profile, then name; the CSV export now includes name, role and LinkedIn.
- Card: the top takeaway is drawn from written takeaways, falling back to your review.
- Admin: bulk seed takes a tag per batch; quick add is takeaways only.
- Data model: `type` is now `x_post | takeaway | met | review`; added `tag`, `disliked`, `rating`, `met_name`, `met_role`, `met_linkedin`; removed `quote_by` and `photo_url`.

### 2026-10-15 — First draft
- PRD written; frontend wireframe built as a Next.js static export for GitHub Pages, running on mock data (localStorage + cross-tab realtime).
- Moved away from the original PRD because GitHub Pages is static: `/card/?h=` and `/p/?id=` instead of dynamic routes, one site-wide OG image, and admin security has to live in the backend.
