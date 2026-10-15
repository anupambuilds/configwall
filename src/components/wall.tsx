"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { BUILDER_HANDLE, TALKS } from "@/lib/config";
import { derivePeople } from "@/lib/people";
import { KIND_LABELS, POST_KINDS, type Post, type PostKind, type PostType } from "@/lib/types";
import { useMyVotes, usePosts } from "@/lib/use-posts";
import { cx, formatCount } from "@/lib/util";
import { AddCard } from "./add-card";
import { useShell } from "./app-shell";
import { Masonry } from "./masonry";
import { PostCard } from "./post-card";

const TABS = [
  { key: "all", label: "All" },
  { key: "posts", label: "Posts" },
  { key: "people", label: "People we met" },
  { key: "notes", label: "Talk notes" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function inTab(p: Post, tab: TabKey): boolean {
  switch (tab) {
    case "all":
      return true;
    case "posts":
      return p.type === "post";
    case "people":
      return p.type === "met";
    case "notes":
      return p.type === "note";
  }
}

const TAB_ADD_TYPE: Record<TabKey, PostType | undefined> = { all: undefined, posts: "post", people: "met", notes: "note" };

export function Wall() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "all") as TabKey;
  const kind = tab === "posts" && POST_KINDS.includes(params.get("kind") as PostKind) ? (params.get("kind") as PostKind) : null;
  const talk = TALKS.includes(params.get("talk") as (typeof TALKS)[number]) ? params.get("talk")! : "";
  const sort = params.get("sort") === "top" ? "top" : "latest";
  const grouped = tab === "notes" && params.get("group") === "talk";

  const { openAdd, isAdmin, showHidden } = useShell();
  // Admin "Show hidden": deleted/hidden posts appear greyed with an Unhide strip.
  const { posts, pending, loading, error, flushPending } = usePosts({ holdRemote: true, includeHidden: isAdmin && showHidden });
  const { votes, add: addVote } = useMyVotes();

  // Animate only posts that arrive after the first load.
  const initialIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!loading && !initialIds.current) initialIds.current = new Set(posts.map((p) => p.id));
  }, [loading, posts]);

  function setParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, posts.filter((p) => inTab(p, t.key)).length])) as Record<TabKey, number>, [posts]);

  const visible = useMemo(() => {
    const list = posts.filter(
      (p) => inTab(p, tab) && (!kind || p.kind === kind) && (tab !== "notes" || !talk || p.talk === talk)
    );
    if (sort === "top") return [...list].sort((a, b) => b.upvotes - a.upvotes || b.created_at.localeCompare(a.created_at));
    return list;
  }, [posts, tab, kind, talk, sort]);

  const peopleCount = useMemo(() => derivePeople(posts).length, [posts]);

  const renderCard = (p: Post) => (
    <PostCard post={p} voted={votes.has(p.id)} onVoted={addVote} fresh={!!initialIds.current && !initialIds.current.has(p.id)} />
  );

  const add = () => openAdd(TAB_ADD_TYPE[tab], { talk: talk || undefined, kind: kind ?? undefined });
  const addCard = <TabAddCard tab={tab} kind={kind} talk={talk} onClick={add} />;

  function showNew() {
    flushPending();
    if (sort === "top") setParams({ sort: null });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16">
      <header className="pt-10 pb-6 sm:pt-14">
        <p className="mb-3 flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-muted uppercase">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-live" />
          </span>
          Live · {loading ? "…" : `${formatCount(posts.length)} posts · ${formatCount(peopleCount)} people`}
        </p>
        <h1 className="font-serif text-[52px] leading-[0.95] tracking-[-0.02em] sm:text-[84px]">
          Config BLR <em className="text-accent">Wall</em>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">
          What Bangalore designers took away from Config: the posts, the people, the talk notes.{" "}
          <span className="text-ink">Unofficial</span>, built by{" "}
          <a href={`https://x.com/${BUILDER_HANDLE}`} target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
            @{BUILDER_HANDLE}
          </a>
          .
        </p>
      </header>

      <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-line/60 bg-paper/90 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3 border-b border-line">
          <nav className="no-scrollbar -ml-4 flex min-w-0 flex-1 gap-5 overflow-x-auto pl-4" role="tablist" aria-label="Feed sections">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setParams({ tab: t.key === "all" ? null : t.key, kind: null, talk: null, group: null })}
                className={cx(
                  "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 py-3 text-[15px] transition-colors",
                  tab === t.key ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
                )}
              >
                {t.label}
                <span className={cx("rounded-full px-1.5 text-[11px] tabular-nums", tab === t.key ? "bg-ink text-paper" : "bg-line text-muted")}>{loading ? "·" : formatCount(counts[t.key])}</span>
              </button>
            ))}
          </nav>
          <div className="flex shrink-0 rounded-full border border-line bg-card p-0.5 text-[13px]" role="group" aria-label="Sort">
            {(["latest", "top"] as const).map((s) => (
              <button
                key={s}
                aria-pressed={sort === s}
                onClick={() => setParams({ sort: s === "top" ? "top" : null })}
                className={cx("rounded-full px-2.5 py-1 capitalize transition-colors", sort === s ? "bg-ink text-paper" : "text-muted hover:text-ink")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {(tab === "posts" || tab === "notes") && (
          <div className="flex flex-wrap items-center gap-2 py-3">
            {tab === "posts" && (
              <div className="no-scrollbar -mx-4 flex w-full gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:px-0">
                {[null, ...POST_KINDS].map((k) => (
                  <button
                    key={k ?? "all"}
                    onClick={() => setParams({ kind: k })}
                    className={cx(
                      "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors",
                      kind === k ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink hover:border-ink/30"
                    )}
                  >
                    {k ? `${KIND_LABELS[k]}s` : "All posts"}
                  </button>
                ))}
              </div>
            )}
            {tab === "notes" && (
              <>
                <select
                  value={talk}
                  onChange={(e) => setParams({ talk: e.target.value || null })}
                  aria-label="Filter by talk"
                  className="min-w-0 flex-1 rounded-full border border-line bg-card px-3 py-1.5 text-sm outline-none focus:border-ink sm:max-w-xs sm:flex-none"
                >
                  <option value="">All talks</option>
                  {TALKS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <button
                  aria-pressed={grouped}
                  onClick={() => setParams({ group: grouped ? null : "talk" })}
                  className={cx(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    grouped ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink hover:border-ink/30"
                  )}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M4 6h16M4 12h10M4 18h13" />
                  </svg>
                  Group by talk
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <div className="pointer-events-none sticky top-[130px] z-20 -mt-2 mb-3 flex justify-center">
          <button onClick={showNew} className="animate-sheet-up pointer-events-auto rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper shadow-lg">
            ↑ {pending.length} new post{pending.length > 1 ? "s" : ""}
          </button>
        </div>
      )}

      {error && <p className="rounded-xl bg-accent/10 p-4 text-sm">{error}</p>}

      {loading ? (
        <SkeletonGrid />
      ) : visible.length === 0 ? (
        <EmptyState tab={tab} talk={talk} onAdd={add} />
      ) : tab === "notes" && grouped ? (
        // Optional view: notes grouped under each talk, in schedule order.
        <div className="flex flex-col gap-10">
          <div className="max-w-sm">{addCard}</div>
          {TALKS.filter((t) => visible.some((p) => p.talk === t)).map((t) => {
            const group = visible.filter((p) => p.talk === t);
            return (
              <section key={t} aria-label={t}>
                <h2 className="mb-4 flex items-baseline gap-3 border-b border-line pb-2">
                  <span className="font-serif text-3xl tracking-[-0.01em]">{t}</span>
                  <span className="text-sm text-muted tabular-nums">
                    {group.length} note{group.length === 1 ? "" : "s"}
                  </span>
                  <button onClick={() => openAdd("note", { talk: t })} className="ml-auto text-sm font-medium text-muted hover:text-ink">
                    + Add notes
                  </button>
                </h2>
                <Masonry items={group} render={renderCard} />
              </section>
            );
          })}
        </div>
      ) : (
        <Masonry items={visible} render={renderCard} lead={addCard} />
      )}
    </main>
  );
}

/** The first card on every tab: opens the add flow for that tab's type. */
function TabAddCard({ tab, kind, talk, onClick }: { tab: TabKey; kind: PostKind | null; talk: string; onClick: () => void }) {
  const copy: Record<TabKey, [string, string]> = {
    all: ["Add to the wall", "A post, someone you met, or talk notes"],
    posts: [kind ? `Add a ${KIND_LABELS[kind].toLowerCase()}` : "Add a post", "Paste your X link, or write one here"],
    people: ["Add someone you met", "Who they are and what you talked about"],
    notes: ["Add talk notes", talk ? `For “${talk}”` : "Your notes from one of the talks"],
  };
  const [title, sub] = copy[tab];
  return <AddCard title={title} sub={sub} onClick={onClick} />;
}

const EMPTY_COPY: Record<TabKey, { title: string; cta: string }> = {
  all: { title: "The wall is empty.", cta: "Add the first post" },
  posts: { title: "No posts here yet.", cta: "Share your X post" },
  people: { title: "No one's shared who they met yet.", cta: "Add someone you met" },
  notes: { title: "No talk notes yet.", cta: "Add notes from a talk" },
};

function EmptyState({ tab, talk, onAdd }: { tab: TabKey; talk: string; onAdd: () => void }) {
  const copy = EMPTY_COPY[tab];
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl border border-dashed border-line px-6 py-14 text-center">
      <p className="font-serif text-3xl leading-tight">{talk ? "Nothing from this talk yet." : copy.title}</p>
      <p className="text-sm text-muted">Be the first. It takes 20 seconds.</p>
      <button onClick={onAdd} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper">
        {copy.cta}
      </button>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3" aria-busy>
      {[180, 260, 140, 220, 300, 160].map((h, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-line bg-card" style={{ height: h }} />
      ))}
    </div>
  );
}
