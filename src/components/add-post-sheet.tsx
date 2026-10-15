"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { MAX_BODY, MAX_LONG, TALKS } from "@/lib/config";
import { getMyHandle, rememberMyPost, setMyHandle } from "@/lib/identity";
import { compressImage } from "@/lib/image";
import { DuplicatePostError, getStore } from "@/lib/store";
import { EMPTY_POST, KIND_LABELS, MAX_MET_PHOTOS, POST_KINDS, type NewPost, type Post, type PostKind, type PostType, type TweetSnapshot } from "@/lib/types";
import { cx, handleFromXUrl, linkKind, normalizeHandle, normalizeLink, parseHandles, timeAgo, tweetIdFromUrl, validatePost } from "@/lib/util";
import { useShell } from "./app-shell";
import { XLogo } from "./icons";

const SECTIONS: { type: PostType; label: string; hint: string; icon: React.ReactNode }[] = [
  { type: "post", label: "Post", hint: "Share your X post, or write one here and post it to X.", icon: <XLogo className="size-4" /> },
  { type: "met", label: "Someone I met", hint: "Who they are, how to find them, what you talked about.", icon: "☺" },
  { type: "note", label: "Talk notes", hint: "Your notes from one of the talks.", icon: "✎" },
];

export function AddPostSheet({
  initialType,
  initialTalk,
  initialKind,
  onClose,
  onPosted,
}: {
  initialType?: PostType;
  initialTalk?: string;
  initialKind?: PostKind;
  onClose: () => void;
  onPosted: (post: Post, message?: string) => void;
}) {
  const [type, setType] = useState<PostType | null>(initialType ?? null);
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const section = SECTIONS.find((s) => s.type === type);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Add to the wall">
      <div className="animate-fade-in absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="animate-sheet-up relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          {type && (
            <button onClick={() => setType(null)} className="-ml-2 grid size-9 place-items-center rounded-full text-muted hover:bg-paper" aria-label="Back">
              ←
            </button>
          )}
          <h2 className="flex-1 font-serif text-2xl">{section?.label ?? "Add to the wall"}</h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full text-muted hover:bg-paper" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5">
          {!type ? (
            <div className="flex flex-col gap-2">
              {SECTIONS.map((s) => (
                <button key={s.type} onClick={() => setType(s.type)} className="flex items-center gap-4 rounded-2xl border border-line bg-paper/60 p-4 text-left transition-colors hover:border-ink/40">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-lg text-paper" aria-hidden>
                    {s.icon}
                  </span>
                  <span>
                    <span className="block font-semibold">{s.label}</span>
                    <span className="block text-sm text-muted">{s.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : type === "post" ? (
            <PostForm initialKind={initialKind} onPosted={onPosted} />
          ) : type === "met" ? (
            <MetForm onPosted={onPosted} />
          ) : (
            <NoteForm initialTalk={initialTalk} onPosted={onPosted} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared form plumbing
// ---------------------------------------------------------------------------

/** Error that disappears as soon as any field changes. */
function useFormError(formKey: string) {
  const [state, setState] = useState<{ msg: string; key: string } | null>(null);
  return [state?.key === formKey ? state.msg : null, (msg: string) => setState({ msg, key: formKey })] as const;
}

async function submitDraft(
  draft: NewPost,
  setError: (m: string) => void,
  onPosted: (p: Post, message?: string) => void,
  onDuplicate?: (existing: Post) => void,
  opts?: { asAdmin?: boolean }
): Promise<boolean> {
  const problem = validatePost(draft);
  if (problem) {
    setError(problem);
    return false;
  }
  try {
    const post = await getStore().createPost(draft, { isSeed: !!opts?.asAdmin });
    if (!opts?.asAdmin) {
      rememberMyPost(post.id);
      if (draft.author_handle && (draft.type !== "post" || draft.source === "native")) setMyHandle(draft.author_handle);
    }
    onPosted(post);
    return true;
  } catch (err) {
    // Someone else may have shared it between the check and the submit.
    if (err instanceof DuplicatePostError) onDuplicate?.(err.existing);
    setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    return false;
  }
}

/** Shown when the pasted tweet is already on the wall. */
function DuplicateFlag({ post }: { post: Post }) {
  const by = post.tweet?.author_handle ?? post.author_handle;
  return (
    <div role="alert" className="-mt-1 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-danger" aria-hidden>
        <path d="M4 22V4l8 3 8-3v11l-8 3-8-3" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-danger">Already on the wall</p>
        <p className="text-muted">
          This post{by ? ` by @${by}` : ""} was added {timeAgo(post.created_at)} ago. Each post can only be shared once.
        </p>
        <Link href={`/p/?id=${post.id}`} target="_blank" className="mt-1 inline-block font-medium text-ink underline underline-offset-2">
          View it on the wall ↗
        </Link>
      </div>
    </div>
  );
}

function useMyHandleField() {
  return useState(() => getMyHandle() ?? "");
}

// ---------------------------------------------------------------------------
// Post (X-first)
// ---------------------------------------------------------------------------

/** Distinct X status links in free text (one per line or space-separated). */
function parseTweetLinks(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\s+/)) {
    const url = normalizeLink(raw);
    const id = tweetIdFromUrl(url);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(url);
    }
  }
  return out;
}

function PostForm({ initialKind, onPosted }: { initialKind?: PostKind; onPosted: (p: Post, message?: string) => void }) {
  const { isAdmin } = useShell();
  const [mode, setMode] = useState<"x" | "native">("x");
  const [link, setLink] = useState("");
  const [tweet, setTweet] = useState<TweetSnapshot | null>(null);
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const [duplicate, setDuplicate] = useState<Post | null>(null);
  const [kind, setKind] = useState<PostKind | null>(initialKind ?? null);
  const [body, setBody] = useState("");
  const [tagged, setTagged] = useState("");
  const [handle, setHandle] = useMyHandleField();
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [error, setError] = useFormError([mode, link, kind, body, tagged, handle].join("\u0000"));

  useEffect(() => () => clearTimeout(timer.current), []);

  const linkHandle = linkKind(link) === "x" ? handleFromXUrl(link) : null;
  // Admin bulk mode: more than one X link pasted.
  const bulkLinks = isAdmin && mode === "x" ? parseTweetLinks(link) : [];
  const isBulk = bulkLinks.length > 1;

  async function submitBulk() {
    if (!kind) return setError("Pick what kind of posts these are.");
    setBusy(true);
    const store = getStore();
    let added: Post | null = null;
    let addedCount = 0;
    let dupes = 0;
    let failed = 0;
    for (const url of bulkLinks) {
      try {
        if (await store.findByTweet(url)) {
          dupes++;
          continue;
        }
        const snap = await store.resolveTweet(url).catch(() => null);
        added = await store.createPost(
          { ...EMPTY_POST, type: "post", source: "x", kind, link_url: url, tweet: snap, author_handle: snap?.author_handle ?? handleFromXUrl(url) },
          { isSeed: true }
        );
        addedCount++;
      } catch (err) {
        if (err instanceof DuplicatePostError) dupes++;
        else failed++;
      }
    }
    if (!added) {
      setBusy(false);
      return setError(dupes ? "All of these are already on the wall." : "Couldn't add these links. Try again.");
    }
    const extra = [dupes && `${dupes} already on the wall`, failed && `${failed} failed`].filter(Boolean).join(", ");
    onPosted(added, `Added ${addedCount} post${addedCount === 1 ? "" : "s"}${extra ? ` (skipped: ${extra})` : ""}`);
  }

  function onLinkChange(value: string) {
    setLink(value);
    setTweet(null);
    setDuplicate(null);
    clearTimeout(timer.current);
    const url = normalizeLink(value);
    if (linkKind(url) !== "x" || !/\/status(es)?\/\d+/.test(url)) {
      setFetchState("idle");
      return;
    }
    setFetchState("loading");
    timer.current = setTimeout(async () => {
      const store = getStore();
      const [dup, snap] = await Promise.all([store.findByTweet(url).catch(() => null), store.resolveTweet(url).catch(() => null)]);
      setDuplicate(dup);
      setTweet(snap);
      setFetchState(snap ? "done" : "failed");
    }, 450);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (isBulk) return submitBulk();
    const native = mode === "native";
    const author = native ? normalizeHandle(handle) : tweet?.author_handle ?? linkHandle;
    if (native && handle.trim() && !author) return setError("Your X handle doesn't look right.");
    if (!native && duplicate) return setError("This post is already on the wall.");

    setBusy(true);
    const ok = await submitDraft(
      {
        ...EMPTY_POST,
        type: "post",
        source: mode,
        kind,
        author_handle: author,
        body: native ? body.trim() || null : null,
        tagged: native ? parseHandles(tagged) : [],
        link_url: native ? null : normalizeLink(link),
        tweet: native ? null : tweet,
      },
      setError,
      onPosted,
      setDuplicate
    );
    if (!ok) setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          ["x", "Paste an X link"],
          ["native", "Write a post"],
        ]}
      />

      {mode === "x" ? (
        <>
          {isAdmin ? (
            <Field label="X post link (admin: paste several, one per line)">
              <textarea
                value={link}
                onChange={(e) => onLinkChange(e.target.value)}
                rows={isBulk ? 6 : 2}
                placeholder={"https://x.com/someone/status/…\nhttps://x.com/another/status/…"}
                className={cx(inputCls, "resize-none font-mono text-sm")}
                autoFocus
              />
            </Field>
          ) : (
            <Field label="Link to your post on X">
              <input type="url" inputMode="url" value={link} onChange={(e) => onLinkChange(e.target.value)} placeholder="https://x.com/you/status/…" className={inputCls} autoFocus />
            </Field>
          )}
          {linkKind(normalizeLink(link)) === "linkedin" && (
            <div role="alert" className="-mt-1 flex items-center gap-3 rounded-xl border border-line bg-card p-3 text-sm">
              <span className="flex-1 text-muted">LinkedIn posts aren&apos;t supported yet.</span>
              <button type="button" onClick={() => setMode("native")} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper">
                Write a post instead
              </button>
            </div>
          )}
          {isBulk && (
            <p className="-mt-2 text-xs text-muted">
              {bulkLinks.length} links. Each one is fetched and added with the post type below; any already on the wall are skipped.
            </p>
          )}
          {fetchState === "loading" && <p className="-mt-2 animate-pulse text-xs text-muted">Fetching the post…</p>}
          {duplicate && <DuplicateFlag post={duplicate} />}
          {fetchState === "done" && tweet && !duplicate && <TweetPreview tweet={tweet} />}
          {fetchState === "failed" && (
            <p className="-mt-2 text-xs text-muted">Couldn&apos;t fetch a preview. It&apos;ll show as X&apos;s embedded post{linkHandle ? `, credited to @${linkHandle}` : ""}.</p>
          )}
        </>
      ) : (
        <>
          <Field label="Your post" counter={`${body.length}/${MAX_BODY}`} over={body.length > MAX_BODY}>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={cx(inputCls, "resize-none")} placeholder="What's happening at Config?" autoFocus />
          </Field>
          <Field label="Tag people (optional)">
            <input value={tagged} onChange={(e) => setTagged(e.target.value)} placeholder="@priya @rahul" autoCapitalize="none" className={inputCls} />
          </Field>
        </>
      )}

      <Field label="What kind of post is it?">
        <div className="flex flex-wrap gap-2">
          {POST_KINDS.map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
              {KIND_LABELS[k]}
            </Chip>
          ))}
        </div>
      </Field>

      {mode === "native" ? (
        <Field label="Your X handle (optional)">
          <HandleInput value={handle} onChange={setHandle} placeholder="yourhandle" />
        </Field>
      ) : (
        (tweet || linkHandle) && (
          <p className="-mt-1 text-xs text-muted">
            Credited to <span className="font-semibold text-ink">@{tweet?.author_handle ?? linkHandle}</span> (from the link)
          </p>
        )
      )}

      <FormFooter error={error} busy={busy} />
    </form>
  );
}

function TweetPreview({ tweet }: { tweet: TweetSnapshot }) {
  return (
    <div className="-mt-1 rounded-xl border border-line bg-surface p-3 text-sm">
      <p className="flex items-center gap-1.5 font-semibold">
        {tweet.author_name} <span className="font-normal text-muted">@{tweet.author_handle}</span>
        <XLogo className="ml-auto size-3" />
      </p>
      <p className="mt-1 line-clamp-3 text-ink/80">{tweet.text}</p>
      {tweet.photos.length > 0 && <p className="mt-1 text-xs text-muted">+ {tweet.photos.length} photo{tweet.photos.length > 1 ? "s" : ""}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Someone I met
// ---------------------------------------------------------------------------

function MetForm({ onPosted }: { onPosted: (p: Post, message?: string) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [metHandle, setMetHandle] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<{ blob: Blob; preview: string }[]>([]);
  const [handle, setHandle] = useMyHandleField();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useFormError([name, role, company, metHandle, linkedin, body, photos.map((p) => p.preview).join(), handle].join("\u0000"));

  // Revoke preview URLs when the form goes away.
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  async function onPickPhotos(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_MET_PHOTOS - photos.length;
    if (room <= 0) return setError(`Up to ${MAX_MET_PHOTOS} photos.`);
    try {
      const picked = await Promise.all(
        [...files].slice(0, room).map(async (f) => {
          const blob = await compressImage(f, 1200, 0.8);
          const preview = URL.createObjectURL(blob);
          previews.current.push(preview);
          return { blob, preview };
        })
      );
      setPhotos((prev) => [...prev, ...picked]);
      if (files.length > room) setError(`Only the first ${room} added. Up to ${MAX_MET_PHOTOS} photos.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't use that photo.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const author = normalizeHandle(handle);
    if (handle.trim() && !author) return setError("Your X handle doesn't look right.");
    const met = normalizeHandle(metHandle);
    if (metHandle.trim() && !met) return setError("Their X handle doesn't look right.");

    setBusy(true);
    let photoUrls: string[] = [];
    try {
      photoUrls = await Promise.all(photos.map((p) => getStore().uploadPhoto(p.blob)));
    } catch (err) {
      setBusy(false);
      return setError(err instanceof Error ? err.message : "Photo upload failed.");
    }
    const ok = await submitDraft(
      {
        ...EMPTY_POST,
        type: "met",
        author_handle: author,
        met_name: name.trim() || null,
        met_role: role.trim() || null,
        met_company: company.trim() || null,
        met_handle: met,
        met_linkedin: linkedin.trim() ? normalizeLink(linkedin) : null,
        body: body.trim() || null,
        photos: photoUrls,
      },
      setError,
      onPosted
    );
    if (!ok) setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Their name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" className={inputCls} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Designation">
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Design Lead" className={inputCls} />
        </Field>
        <Field label="Company">
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme" className={inputCls} />
        </Field>
      </div>
      <Field label="Their X handle">
        <HandleInput value={metHandle} onChange={setMetHandle} placeholder="theirhandle" />
      </Field>
      <Field label="Their LinkedIn">
        <input type="url" inputMode="url" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/…" className={inputCls} />
      </Field>
      <p className="-mt-2 text-xs text-muted">Add their X handle if you can: it links you both on the People page and tags them when you post to X.</p>

      <Field label="What did you talk about?" counter={`${body.length}/${MAX_LONG}`} over={body.length > MAX_LONG}>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={cx(inputCls, "resize-none")} placeholder="The conversation, what you learned, how it felt…" />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="flex justify-between text-xs font-medium text-muted">
          Photos (optional)
          <span className="tabular-nums">
            {photos.length}/{MAX_MET_PHOTOS}
          </span>
        </span>
        <div className="grid grid-cols-4 gap-2">
          {photos.map((p, i) => (
            <div key={p.preview} className="relative aspect-square overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Remove photo"
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-ink/70 text-xs text-white"
              >
                ✕
              </button>
            </div>
          ))}
          {photos.length < MAX_MET_PHOTOS && (
            <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line bg-surface text-2xl text-muted hover:border-ink/30" aria-label="Add photos">
              ＋
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => (onPickPhotos(e.target.files), (e.target.value = ""))} />
            </label>
          )}
        </div>
      </div>

      <Field label="Your X handle">
        <HandleInput value={handle} onChange={setHandle} placeholder="yourhandle" />
      </Field>

      <FormFooter error={error} busy={busy} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Takeaway
// ---------------------------------------------------------------------------

function NoteForm({ initialTalk, onPosted }: { initialTalk?: string; onPosted: (p: Post, message?: string) => void }) {
  const { isAdmin } = useShell();
  const [talk, setTalk] = useState(initialTalk ?? "");
  const [body, setBody] = useState("");
  const [savedHandle] = useMyHandleField();
  // Admin posts on someone's behalf: start empty instead of with your own handle.
  const [handle, setHandle] = useState(isAdmin ? "" : savedHandle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useFormError([talk, body, handle].join("\u0000"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const author = normalizeHandle(handle);
    if (handle.trim() && !author) return setError("Your X handle doesn't look right.");

    setBusy(true);
    const ok = await submitDraft(
      { ...EMPTY_POST, type: "note", author_handle: author, talk: talk || null, body: body.trim() || null },
      setError,
      onPosted,
      undefined,
      { asAdmin: isAdmin }
    );
    if (!ok) setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Which talk?">
        <select value={talk} onChange={(e) => setTalk(e.target.value)} className={inputCls}>
          <option value="">Pick a talk</option>
          {TALKS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Your notes" counter={`${body.length}/${MAX_LONG}`} over={body.length > MAX_LONG}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className={cx(inputCls, "resize-none")}
          placeholder={"What you jotted down:\n- key ideas\n- frameworks\n- things to try"}
          autoFocus
        />
      </Field>
      <Field label={isAdmin ? "Credit to (X handle of the person whose notes these are)" : "Your X handle (optional)"}>
        <HandleInput value={handle} onChange={setHandle} placeholder={isAdmin ? "theirhandle" : "yourhandle"} />
      </Field>
      <FormFooter error={error} busy={busy} />
    </form>
  );
}

// ---------------------------------------------------------------------------

function FormFooter({ error, busy }: { error: string | null; busy: boolean }) {
  return (
    <>
      {error && <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-full bg-accent py-3.5 text-[15px] font-semibold text-accent-ink transition-opacity disabled:opacity-60">
        {busy ? "Posting…" : "Post to the wall"}
      </button>
      <p className="-mt-2 text-center text-xs text-muted">Posts are public. Be kind; credit people.</p>
    </>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] outline-none transition-colors placeholder:text-muted/60 focus:border-ink";

function Field({ label, counter, over, children }: { label: string; counter?: string; over?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between text-xs font-medium text-muted">
        {label}
        {counter && <span className={cx("tabular-nums", over && "text-danger")}>{counter}</span>}
      </span>
      {children}
    </label>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cx("rounded-full border px-3.5 py-1.5 text-sm transition-colors", active ? "border-ink bg-ink text-paper" : "border-line bg-surface hover:border-ink/30")}>
      {children}
    </button>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex rounded-full border border-line bg-paper p-1 text-sm">
      {options.map(([v, label]) => (
        <button type="button" key={v} onClick={() => onChange(v)} className={cx("flex-1 rounded-full py-1.5 transition-colors", value === v ? "bg-ink text-paper" : "text-muted")}>
          {label}
        </button>
      ))}
    </div>
  );
}

function HandleInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex items-center rounded-xl border border-line bg-surface focus-within:border-ink">
      <span className="pl-3 text-muted">@</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/^@+/, ""))}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="w-full bg-transparent px-1 py-2.5 text-[15px] outline-none placeholder:text-muted/60"
      />
    </div>
  );
}
