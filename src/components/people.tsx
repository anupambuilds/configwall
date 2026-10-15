"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMyHandle } from "@/lib/identity";
import { derivePeople, peopleIMet, personLabel, type MetEntry, type Person } from "@/lib/people";
import type { Post } from "@/lib/types";
import { useMyVotes, usePosts } from "@/lib/use-posts";
import { cx, normalizeHandle, timeAgo } from "@/lib/util";
import { useShell } from "./app-shell";
import { ConfigCardPanel, personPosts } from "./config-card";
import { XLogo } from "./icons";
import { Masonry } from "./masonry";
import { Avatar, PostCard } from "./post-card";

function displayName(p: Person): string {
  return p.handle && p.name ? p.name : personLabel(p);
}

/** Shared URL state: `?p=` person view, `?card=` open card panel. `?h=handle` is a shortcut for `x:handle`. */
function usePeopleParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const h = normalizeHandle(params.get("h"));
  const selected = params.get("p") ?? (h ? `x:${h}` : null);
  const card = params.get("card");
  function set(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (changes.p !== undefined) next.delete("h");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  return { selected, card, set };
}

export function People() {
  const { selected, card, set } = usePeopleParams();
  const { posts, loading } = usePosts();
  const people = useMemo(() => derivePeople(posts), [posts]);
  const cardPerson = card ? people.find((p) => p.key === card) : undefined;

  return (
    <>
      {selected ? (
        <PersonDetail personKey={selected} people={people} posts={posts} loading={loading} onOpenCard={(k) => set({ card: k })} />
      ) : (
        <Directory people={people} posts={posts} loading={loading} onOpenCard={(k) => set({ card: k })} />
      )}
      {cardPerson && <ConfigCardPanel person={cardPerson} posts={posts} onClose={() => set({ card: null })} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Directory: everyone engaging with the wall, searchable, most recently active first
// ---------------------------------------------------------------------------

function Directory({ people, posts, loading, onOpenCard }: { people: Person[]; posts: Post[]; loading: boolean; onOpenCard: (key: string) => void }) {
  const me = useMyHandle();
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^@/, "");
    return people
      .filter((p) => !needle || p.name?.toLowerCase().includes(needle) || p.handle?.includes(needle))
      .sort((a, b) => b.lastActive.localeCompare(a.lastActive));
  }, [people, q]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-10 pb-16">
      <h1 className="font-serif text-5xl tracking-[-0.02em] sm:text-6xl">People</h1>
      <p className="mt-2 text-muted">Everyone on the wall: who posted, who met whom.</p>

      {me && <MyConnections me={me} posts={posts} />}

      <div className="mt-8 flex items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-ink">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or @handle"
          aria-label="Search people"
          autoCapitalize="none"
          className="w-full bg-transparent py-3 text-[15px] outline-none placeholder:text-muted/70"
        />
        {q && (
          <button onClick={() => setQ("")} className="text-sm text-muted hover:text-ink" aria-label="Clear search">
            ✕
          </button>
        )}
      </div>
      <p className="mt-2 px-1 text-xs text-muted">
        {loading ? "Loading…" : q ? `${list.length} of ${people.length} people` : `${people.length} people · most recently active first`}
      </p>

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {loading && [0, 1, 2, 3].map((i) => <li key={i} className="h-[76px] animate-pulse" />)}
        {!loading && list.length === 0 && (
          <li className="p-8 text-center text-sm text-muted">{q ? `No one matches “${q}”.` : "No one yet. Post on the wall to appear here."}</li>
        )}
        {list.map((p) => (
          <PersonRow key={p.key} person={p} isMe={!!me && p.handle === me} onOpenCard={() => onOpenCard(p.key)} />
        ))}
      </ul>
    </main>
  );
}

function PersonRow({ person: p, isMe, onOpenCard }: { person: Person; isMe: boolean; onOpenCard: () => void }) {
  const role = [p.role, p.company].filter(Boolean).join(" at ");
  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink/[0.03]">
      <Link href={`/people/?p=${encodeURIComponent(p.key)}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar label={p.name ?? p.handle ?? "?"} size="lg" tone={p.handle ? "ink" : "met"} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{displayName(p)}</span>
            {isMe && <span className="rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-paper uppercase">You</span>}
          </span>
          <span className="block truncate text-sm text-muted">{[p.handle && p.name ? `@${p.handle}` : null, role].filter(Boolean).join(" · ") || "Mentioned on the wall"}</span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
            <Metric n={p.posts} label="posts" />
            <Metric n={p.connections.size} label="met" />
            <Metric n={p.upvotes} label="upvotes" />
            {p.lastActive && <span>active {timeAgo(p.lastActive)}</span>}
          </span>
        </span>
      </Link>
      <button onClick={onOpenCard} className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:bg-ink/5">
        Config card
      </button>
    </li>
  );
}

function Metric({ n, label }: { n: number; label: string }) {
  return (
    <span>
      <span className="font-semibold text-ink tabular-nums">{n}</span> {label}
    </span>
  );
}

function entryLabel(e: MetEntry): string {
  return e.handle ? `@${e.handle}` : e.name ?? "Someone";
}

function MyConnections({ me, posts }: { me: string; posts: Post[] }) {
  const { toast } = useShell();
  const list = useMemo(() => peopleIMet(posts, me), [posts, me]);
  if (list.length === 0) return null;

  function copy() {
    const text = list.map((e) => [entryLabel(e), e.handle && e.name, e.role, e.company, e.linkedin].filter(Boolean).join(" · ")).join("\n");
    navigator.clipboard.writeText(text).then(() => toast("Copied"));
  }

  function downloadCsv() {
    const esc = (s: string | null) => `"${(s ?? "").replace(/"/g, '""')}"`;
    const rows = [
      "name,role,company,x_handle,x_url,linkedin,talked_about,logged_at",
      ...list.map((e) => [e.name, e.role, e.company, e.handle, e.handle ? `https://x.com/${e.handle}` : null, e.linkedin, e.note, e.at].map(esc).join(",")),
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    a.download = `config-blr-connections-${me}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <section className="mt-6 rounded-2xl bg-ink p-5 text-paper">
      <h2 className="text-sm font-semibold">
        You met {list.length} {list.length === 1 ? "person" : "people"}
      </h2>
      <p className="mt-2 flex flex-wrap gap-1.5">
        {list.map((e) => (
          <Link key={e.key} href={`/people/?p=${encodeURIComponent(e.key)}`} className="rounded-full bg-paper/10 px-2.5 py-1 text-sm hover:bg-paper/20">
            {e.handle && e.name ? e.name : entryLabel(e)}
          </Link>
        ))}
      </p>
      <div className="mt-4 flex gap-2">
        <button onClick={copy} className="rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink">
          Copy list
        </button>
        <button onClick={downloadCsv} className="rounded-full border border-paper/30 px-4 py-2 text-sm font-semibold">
          Download CSV
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Person view: metrics, links, connections and all their activity
// ---------------------------------------------------------------------------

function PersonDetail({
  personKey,
  people,
  posts,
  loading,
  onOpenCard,
}: {
  personKey: string;
  people: Person[];
  posts: Post[];
  loading: boolean;
  onOpenCard: (key: string) => void;
}) {
  const { votes, add } = useMyVotes();
  const person = people.find((p) => p.key === personKey);
  const byKey = useMemo(() => new Map(people.map((p) => [p.key, p])), [people]);
  const activity = useMemo(() => (person ? personPosts(posts, person) : []), [posts, person]);
  const handle = personKey.startsWith("x:") ? personKey.slice(2) : null;

  if (!loading && !person) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 pt-10 pb-16">
        <BackLink />
        <p className="mt-6 font-serif text-3xl">{handle ? `@${handle} isn't on the wall yet.` : "This person isn't on the wall."}</p>
      </main>
    );
  }

  const title = person ? displayName(person) : handle ? `@${handle}` : "…";
  const role = person ? [person.role, person.company].filter(Boolean).join(" at ") : "";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16">
      <BackLink />
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Avatar label={person?.name ?? handle ?? "?"} size="lg" tone={handle ? "ink" : "met"} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-4xl tracking-[-0.02em] sm:text-5xl">{title}</h1>
          <p className="truncate text-sm text-muted">{[person?.handle && person?.name ? `@${person.handle}` : null, role].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {person && (
            <button onClick={() => onOpenCard(person.key)} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
              Config card
            </button>
          )}
          {person?.handle && (
            <a href={`https://x.com/${person.handle}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-ink/5">
              <XLogo className="size-3.5" /> Profile
            </a>
          )}
          {person?.linkedin && (
            <a href={person.linkedin} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-ink/5">
              LinkedIn ↗
            </a>
          )}
        </div>
      </div>

      {person && (
        <dl className="mt-6 grid grid-cols-3 gap-3 sm:max-w-md">
          {[
            [person.posts, "Posts"],
            [person.connections.size, "People met"],
            [person.upvotes, "Upvotes"],
          ].map(([n, label]) => (
            <div key={label} className="rounded-2xl border border-line bg-card px-4 py-3">
              <dd className="font-serif text-3xl leading-none tabular-nums">{n}</dd>
              <dt className="mt-1 text-xs text-muted">{label}</dt>
            </div>
          ))}
        </dl>
      )}

      {person && person.connections.size > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Met</p>
          <p className="flex flex-wrap gap-1.5">
            {[...person.connections].map((k) => {
              const c = byKey.get(k);
              return (
                <Link key={k} href={`/people/?p=${encodeURIComponent(k)}`} className="rounded-full bg-t-met px-2.5 py-1 text-sm hover:bg-met-line">
                  {c ? displayName(c) : k}
                </Link>
              );
            })}
          </p>
        </div>
      )}

      <h2 className="mt-10 mb-4 border-b border-line pb-2 font-serif text-3xl">Activity</h2>
      {!loading && activity.length === 0 ? (
        <p className="text-muted">Nothing from {title} on the wall yet.</p>
      ) : (
        <Masonry items={[...activity].sort((a, b) => b.created_at.localeCompare(a.created_at))} render={(p) => <PostCard post={p} voted={votes.has(p.id)} onVoted={add} />} />
      )}
    </main>
  );
}

function BackLink() {
  return (
    <Link href="/people/" className={cx("text-sm text-muted hover:text-ink")}>
      ← All people
    </Link>
  );
}
