"use client";

import { useEffect, useMemo, useState } from "react";
import { TALKS } from "@/lib/config";
import { clearAdminSecret, getAdminSecret, setAdminSecret } from "@/lib/identity";
import { DATA_SOURCE, getStore, resetMockData } from "@/lib/store";
import { displayKind, EMPTY_POST, KIND_LABELS, POST_KINDS, type NewPost, type Post, type PostKind } from "@/lib/types";
import { usePosts } from "@/lib/use-posts";
import { cx, handleFromXUrl, linkKind, normalizeHandle, normalizeLink, timeAgo, validatePost } from "@/lib/util";

type Gate = "checking" | "locked" | "unlocked";

/**
 * Admin is behind a secret: paste it once per device, it's remembered, and
 * every admin action is checked again by the server. Nobody else gets past
 * the "Admin secret" box.
 */
export function Admin() {
  const [gate, setGate] = useState<Gate>("checking");

  // A secret remembered on this device is re-checked on every visit.
  useEffect(() => {
    let alive = true;
    const saved = getAdminSecret();
    (saved ? getStore().verifyAdmin(saved) : Promise.resolve(false)).then((ok) => {
      if (!alive) return;
      if (!ok && saved) clearAdminSecret();
      setGate(ok ? "unlocked" : "locked");
    });
    return () => {
      alive = false;
    };
  }, []);

  if (gate === "checking") return <main className="flex-1" aria-busy />;
  if (gate === "locked") return <AdminLogin onUnlocked={() => setGate("unlocked")} />;
  return (
    <AdminPanel
      onLock={() => {
        clearAdminSecret();
        setGate("locked");
      }}
    />
  );
}

function AdminLogin({ onUnlocked }: { onUnlocked: () => void }) {
  const [secret, setSecret] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "wrong">("idle");

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    const s = secret.trim();
    if (!s || state === "checking") return;
    setState("checking");
    const ok = await getStore().verifyAdmin(s).catch(() => false);
    if (!ok) return setState("wrong");
    setAdminSecret(s);
    onUnlocked();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="font-serif text-4xl tracking-[-0.02em]">Admin</h1>
      <p className="mt-1 text-sm text-muted">Paste your admin secret. This device will remember it until you lock.</p>
      <form onSubmit={unlock} className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Admin secret</span>
          <input
            type="password"
            value={secret}
            onChange={(e) => {
              setSecret(e.target.value);
              if (state === "wrong") setState("idle");
            }}
            autoComplete="current-password"
            autoFocus
            className={box}
          />
        </label>
        {state === "wrong" && <p className="text-sm text-danger">Wrong secret.</p>}
        <button disabled={!secret.trim() || state === "checking"} className="rounded-full bg-ink py-3 font-semibold text-paper disabled:opacity-50">
          {state === "checking" ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}

function AdminPanel({ onLock }: { onLock: () => void }) {
  const { posts } = usePosts({ includeHidden: true });
  const [tab, setTab] = useState<"seed" | "quick" | "moderate">("seed");

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-8 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-5xl tracking-[-0.02em]">Admin</h1>
          <p className="text-sm text-muted">
            {posts.length} posts · {posts.filter((p) => p.hidden).length} hidden · {posts.filter((p) => p.is_seed).length} seeds
          </p>
        </div>
        <div className="flex gap-2">
          {DATA_SOURCE === "mock" && (
            <button
              onClick={() => {
                if (window.confirm("Reset all local mock data to the demo seed?")) {
                  resetMockData();
                  location.reload();
                }
              }}
              className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:border-ink/30 hover:text-ink"
            >
              Reset mock data
            </button>
          )}
          <button onClick={onLock} className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper">
            Lock
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-1 rounded-full border border-line bg-card p-1 text-sm">
        {(
          [
            ["seed", "Bulk seed links"],
            ["quick", "Quick add notes"],
            ["moderate", "Moderate"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={cx("flex-1 rounded-full py-2", tab === k ? "bg-ink text-paper" : "text-muted")}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "seed" && <BulkSeed existing={posts} />}
        {tab === "quick" && <QuickAdd />}
        {tab === "moderate" && <Moderate posts={posts} />}
      </div>
    </main>
  );
}

const box = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] outline-none focus:border-ink";

function BulkSeed({ existing }: { existing: Post[] }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<PostKind>("takeaway");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const seen = new Set(existing.map((p) => p.link_url).filter(Boolean));
    const out: string[] = [];
    for (const raw of text.split(/\s+/).filter(Boolean)) {
      const url = normalizeLink(raw);
      if (linkKind(url) !== "x") {
        out.push(`✗ skipped (not an X post): ${raw}`);
        continue;
      }
      if (seen.has(url)) {
        out.push(`· duplicate: ${url}`);
        continue;
      }
      seen.add(url);
      const tweet = await getStore().resolveTweet(url).catch(() => null);
      await getStore().createPost(
        { ...EMPTY_POST, type: "post", source: "x", kind, link_url: url, tweet, author_handle: tweet?.author_handle ?? handleFromXUrl(url) },
        { isSeed: true }
      );
      out.push(`✓ added ${url}${tweet ? "" : " (no preview, will show as embed)"}`);
    }
    setLog(out);
    setText("");
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Post type for this batch</span>
        {POST_KINDS.map((k) => (
          <button key={k} onClick={() => setKind(k)} className={cx("rounded-full border px-3 py-1", kind === k ? "border-ink bg-ink text-paper" : "border-line")}>
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={"One X post URL per line\nhttps://x.com/someone/status/123…"} className={cx(box, "font-mono text-sm")} />
      <button onClick={run} disabled={busy || !text.trim()} className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-50">
        {busy ? "Seeding…" : "Create posts"}
      </button>
      {log.length > 0 && <pre className="overflow-x-auto rounded-xl bg-card p-3 text-xs">{log.join("\n")}</pre>}
    </div>
  );
}

function QuickAdd() {
  const [body, setBody] = useState("");
  const [talk, setTalk] = useState("");
  const [handle, setHandle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const draft: NewPost = { ...EMPTY_POST, type: "note", body: body.trim(), talk: talk || null, author_handle: normalizeHandle(handle) };
    const problem = validatePost(draft);
    if (problem) return setMsg(problem);
    await getStore().createPost(draft, { isSeed: true });
    setBody("");
    setMsg("Added.");
  }

  return (
    <form onSubmit={add} className="flex max-w-xl flex-col gap-3">
      <p className="text-sm text-muted">Add talk notes credited to their real author (e.g. from a speaker&apos;s own thread).</p>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Notes" className={box} />
      <select value={talk} onChange={(e) => setTalk(e.target.value)} className={box}>
        <option value="">Pick a talk</option>
        {TALKS.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@source handle" className={box} />
      <div className="flex items-center gap-3">
        <button className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper">Add as seed</button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </form>
  );
}

function Moderate({ posts }: { posts: Post[] }) {
  const [q, setQ] = useState("");
  const [onlyHidden, setOnlyHidden] = useState(false);
  const list = useMemo(() => {
    const needle = q.toLowerCase();
    return posts.filter(
      (p) =>
        (!onlyHidden || p.hidden) &&
        (!needle || [p.body, p.talk, p.tweet?.text, p.author_handle, p.met_handle, p.met_name, p.met_company, p.link_url].some((v) => v?.toLowerCase().includes(needle)))
    );
  }, [posts, q, onlyHidden]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search text or handle" className={box} />
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyHidden} onChange={(e) => setOnlyHidden(e.target.checked)} /> Hidden only
        </label>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {list.map((p) => (
          <li key={p.id} className={cx("flex items-start gap-3 p-3", p.hidden && "opacity-50")}>
            <span className="mt-0.5 w-16 shrink-0 text-[11px] font-semibold uppercase text-muted">{displayKind(p)}</span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="line-clamp-2">{p.body || p.tweet?.text || p.link_url || p.met_name || p.met_handle || "—"}</p>
              <p className="text-xs text-muted">
                @{p.author_handle ?? "anon"} · {timeAgo(p.created_at)} · {p.upvotes}▲{p.is_seed && " · seed"}
              </p>
            </div>
            <button
              onClick={() => getStore().setHidden(p.id, !p.hidden)}
              className={cx("shrink-0 rounded-full px-3 py-1 text-xs font-semibold", p.hidden ? "bg-ink text-paper" : "border border-line")}
            >
              {p.hidden ? "Unhide" : "Hide"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
