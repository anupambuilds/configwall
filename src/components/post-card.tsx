"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { siteUrl } from "@/lib/config";
import { metKey } from "@/lib/people";
import { canPostToX, postToXUrl } from "@/lib/share";
import { getStore } from "@/lib/store";
import { KIND_LABELS, type Post, type PostKind } from "@/lib/types";
import { cx, initials, timeAgo, tokenize } from "@/lib/util";
import { useShell } from "./app-shell";
import { XLogo } from "./icons";
import { XEmbed } from "./x-embed";

interface CardProps {
  post: Post;
  voted: boolean;
  onVoted: (id: string) => void;
  fresh?: boolean;
}

/**
 * Two card families so the mixed "All" feed reads at a glance:
 * - every post (from X or written here) uses one X-style card;
 * - people we met (purple) and talk notes (yellow) share an editorial card.
 */
export function PostCard(props: CardProps) {
  switch (props.post.type) {
    case "post":
      return <XStyleCard {...props} />;
    case "met":
      return <MetCard {...props} />;
    case "note":
      return <NoteCard {...props} />;
  }
}

// ---------------------------------------------------------------------------
// Posts: one X-style card for both shared X posts and wall posts
// ---------------------------------------------------------------------------

const KIND_STYLE: Record<PostKind, string> = {
  takeaway: "bg-t-takeaway",
  quote: "bg-t-quote",
  story: "bg-t-story",
  photo: "bg-t-photo",
  review: "bg-t-review",
};

function XStyleCard({ post, voted, onVoted, fresh }: CardProps) {
  const t = post.tweet;
  const isX = post.source === "x";
  const handle = t?.author_handle ?? post.author_handle;
  const name = t?.author_name ?? null;
  const text = t?.text ?? post.body ?? "";
  const photos = t?.photos ?? [];
  const tagged = isX ? t?.mentions ?? [] : post.tagged;

  return (
    <article className={cx("overflow-hidden rounded-2xl border border-line bg-surface", fresh && "animate-slide-in")}>
      {isX && !t ? (
        // Snapshot unavailable → official embed.
        <div className="px-4 pt-4">
          <div className="mb-3">
            <KindPill kind={post.kind} />
          </div>
          <div className="py-1">
            <XEmbed url={post.link_url!} handle={post.author_handle} />
          </div>
        </div>
      ) : (
        <div className="px-4 pt-4">
          <header className="flex items-start gap-3">
            <Avatar label={name ?? handle ?? "?"} src={t?.author_avatar} size="md" />
            <div className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[15px] font-bold">{name ?? (handle ? `@${handle}` : "Anonymous")}</span>
              <span className="block truncate text-[13px] text-muted">
                {handle && name && <>@{handle} · </>}
                {timeAgo(t?.created_at ?? post.created_at)}
              </span>
            </div>
            {isX ? (
              <a href={post.link_url!} target="_blank" rel="noopener noreferrer" aria-label="Open on X" className="mt-0.5 text-ink hover:opacity-70">
                <XLogo className="size-4" />
              </a>
            ) : (
              <span className="mt-0.5 rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase">Wall post</span>
            )}
          </header>

          <div className="mt-2.5">
            <KindPill kind={post.kind} />
          </div>

          {text && (
            <p className={cx("mt-2 break-words whitespace-pre-line", post.kind === "quote" ? "font-serif text-[21px] leading-[1.25]" : "text-[15px] leading-[1.45]")}>
              <RichText text={text} />
            </p>
          )}

          {photos.length > 0 && <PhotoGrid photos={photos} />}

          {tagged.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">Tagged</span>
              {tagged.map((h) => (
                <Link key={h} href={`/people/?h=${h}`} className="rounded-full bg-paper px-2 py-0.5 font-medium hover:bg-line">
                  @{h}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <CardFooter post={post} voted={voted} onVoted={onVoted} showAuthor={false} viewOnX={isX ? post.link_url : null} />
    </article>
  );
}

export function PhotoGrid({ photos, rounded = "rounded-2xl" }: { photos: string[]; rounded?: string }) {
  const shown = photos.slice(0, 4);
  const n = shown.length;
  return (
    <div className={cx("mt-3 grid gap-0.5 overflow-hidden border border-line", rounded, n === 1 ? "grid-cols-1" : "grid-cols-2", n > 1 && "aspect-[16/10]", n === 3 && "grid-rows-2")}>
      {shown.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src + i} src={src} alt="" loading="lazy" className={cx("h-full w-full bg-line object-cover", n === 1 && "max-h-[420px]", n === 3 && i === 0 && "row-span-2")} />
      ))}
    </div>
  );
}

function RichText({ text }: { text: string }) {
  return (
    <>
      {tokenize(text).map((tok, i) => {
        if (tok.kind === "text") return <span key={i}>{tok.value}</span>;
        const href =
          tok.kind === "url"
            ? tok.value
            : tok.kind === "mention"
              ? `https://x.com/${tok.value.slice(1)}`
              : `https://x.com/hashtag/${encodeURIComponent(tok.value.slice(1))}`;
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
            {tok.kind === "url" ? tok.value.replace(/^https?:\/\/(www\.)?/, "").slice(0, 32) : tok.value}
          </a>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Editorial cards: people we met (purple) and talk notes (yellow)
// ---------------------------------------------------------------------------

const TONES = {
  met: { card: "border-met-line bg-met-bg", pill: "bg-t-met", rule: "border-met-line" },
  note: { card: "border-note-line bg-note-bg", pill: "bg-t-takeaway", rule: "border-note-line" },
} as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{children}</p>;
}

function MetCard({ post, voted, onVoted, fresh }: CardProps) {
  const tone = TONES.met;
  const key = metKey(post);
  const name = post.met_name || (post.met_handle ? `@${post.met_handle}` : "someone");
  const role = [post.met_role, post.met_company].filter(Boolean).join(" at ");

  return (
    <article className={cx("overflow-hidden rounded-2xl border", tone.card, fresh && "animate-slide-in")}>
      <div className="flex flex-col gap-3 px-4 pt-4">
        <span className={cx("self-start rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide text-ink/80 uppercase", tone.pill)}>People we met</span>

        {/* "@you met Priya" */}
        <p className="font-serif text-[24px] leading-[1.15] tracking-[-0.005em]">
          {post.author_handle ? (
            <Link href={`/people/?h=${post.author_handle}`} className="hover:underline">
              @{post.author_handle}
            </Link>
          ) : (
            "Someone"
          )}{" "}
          <span className="text-muted italic">met</span>{" "}
          {key ? (
            <Link href={`/people/?p=${encodeURIComponent(key)}`} className="hover:underline">
              {name}
            </Link>
          ) : (
            name
          )}
        </p>

        {/* Who they are */}
        {(role || post.met_handle || post.met_linkedin) && (
          <div className={cx("border-t border-dashed pt-2.5", tone.rule)}>
            <SectionLabel>Who {post.met_name ? post.met_name.split(" ")[0] : "they"} {post.met_name ? "is" : "are"}</SectionLabel>
            {role && <p className="text-[15px] leading-snug">{role}</p>}
            {(post.met_handle || post.met_linkedin) && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                {post.met_handle && (
                  <a href={`https://x.com/${post.met_handle}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 hover:border-ink/30">
                    <XLogo className="size-3" /> @{post.met_handle}
                  </a>
                )}
                {post.met_linkedin && (
                  <a href={post.met_linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 hover:border-ink/30">
                    <span className="rounded-[3px] bg-[#0a66c2] px-[3px] text-[9px] leading-[13px] font-bold text-white">in</span> LinkedIn
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* What was discussed */}
        {post.body && (
          <div className={cx("border-t border-dashed pt-2.5", tone.rule)}>
            <SectionLabel>What we discussed</SectionLabel>
            <Expandable text={post.body} lines={5} className="text-[15px] leading-snug text-ink/85" />
          </div>
        )}

        {/* Photos */}
        {post.photos.length > 0 && <PhotoGrid photos={post.photos} rounded="rounded-xl" />}
      </div>

      <CardFooter post={post} voted={voted} onVoted={onVoted} showAuthor={false} />
    </article>
  );
}

function NoteCard({ post, voted, onVoted, fresh }: CardProps) {
  const tone = TONES.note;
  return (
    <article className={cx("overflow-hidden rounded-2xl border", tone.card, fresh && "animate-slide-in")}>
      <div className="flex flex-col gap-3 px-4 pt-4">
        <span className={cx("self-start rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide text-ink/80 uppercase", tone.pill)}>Talk notes</span>
        <p className="font-serif text-[22px] leading-[1.15] tracking-[-0.005em]">{post.talk}</p>
        <div className={cx("border-t border-dashed pt-2.5", tone.rule)}>
          <Expandable text={post.body ?? ""} lines={7} className="text-[15px] leading-relaxed text-ink/85" />
        </div>
      </div>
      <CardFooter post={post} voted={voted} onVoted={onVoted} showAuthor />
    </article>
  );
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function CardFooter({
  post,
  voted,
  onVoted,
  showAuthor,
  viewOnX,
}: {
  post: Post;
  voted: boolean;
  onVoted: (id: string) => void;
  showAuthor: boolean;
  viewOnX?: string | null;
}) {
  return (
    <footer className="mt-3 flex items-center gap-2 px-4 pb-3 text-xs text-muted">
      {showAuthor &&
        (post.author_handle ? (
          <Link href={`/people/?h=${post.author_handle}`} className="truncate font-medium text-ink hover:underline">
            @{post.author_handle}
          </Link>
        ) : (
          <span>Anonymous</span>
        ))}
      {showAuthor && <span aria-hidden>·</span>}
      {post.type !== "post" && <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>}
      {viewOnX && (
        <a href={viewOnX} target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">
          View on X ↗
        </a>
      )}
      <span className="ml-auto flex items-center gap-1">
        {canPostToX(post) && (
          <a href={postToXUrl(post)} target="_blank" rel="noopener noreferrer" aria-label="Post this on X" title="Post this on X" className="grid size-8 place-items-center rounded-full text-ink hover:bg-paper">
            <XLogo className="size-3.5" />
          </a>
        )}
        <ShareButton id={post.id} />
        <UpvoteButton post={post} voted={voted} onVoted={onVoted} />
        <PostMenu postId={post.id} />
      </span>
    </footer>
  );
}

/** Kebab menu on every post: delete (removes it from the wall), with an inline confirm step. */
function PostMenu({ postId }: { postId: string }) {
  const { toast } = useShell();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setConfirming(false);
  }

  async function remove() {
    setBusy(true);
    try {
      await getStore().deletePost(postId);
      toast("Post deleted");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't delete the post. Try again.");
      setBusy(false);
      close();
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => (open ? close() : setOpen(true))}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid size-8 place-items-center rounded-full text-ink hover:bg-paper"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="animate-fade-in absolute right-0 bottom-full z-20 mb-1 w-52 overflow-hidden rounded-xl border border-line bg-surface p-1 text-sm text-ink shadow-lg">
          {!confirming ? (
            <button role="menuitem" onClick={() => setConfirming(true)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-danger hover:bg-ink/5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </svg>
              Delete post
            </button>
          ) : (
            <div className="p-2">
              <p className="font-medium">Delete this post?</p>
              <p className="mt-0.5 text-xs text-muted">It will be removed from the wall for everyone.</p>
              <div className="mt-3 flex gap-2">
                <button onClick={close} className="flex-1 rounded-full border border-line py-1.5 hover:bg-ink/5">
                  Cancel
                </button>
                <button onClick={remove} disabled={busy} className="flex-1 rounded-full bg-danger py-1.5 font-semibold text-white disabled:opacity-60">
                  {busy ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KindPill({ kind }: { kind: PostKind | null }) {
  if (!kind) return null;
  return <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide text-ink/80 uppercase", KIND_STYLE[kind])}>{KIND_LABELS[kind]}</span>;
}

function Expandable({ text, lines, className }: { text: string; lines: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > lines * 60 || text.split("\n").length > lines;
  return (
    <div>
      <p className={cx("whitespace-pre-line break-words", className)} style={!open && long ? { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}>
        {text}
      </p>
      {long && (
        <button onClick={() => setOpen(!open)} className="mt-1 text-xs font-semibold text-ink hover:underline">
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

export function Avatar({
  label,
  src,
  size = "sm",
  tone = "ink",
}: {
  label: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  tone?: "ink" | "met" | "accent";
}) {
  const dims = size === "sm" ? "size-8 text-[11px]" : size === "md" ? "size-10 text-xs" : "size-14 text-base";
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cx("shrink-0 rounded-full object-cover", dims)} />;
  }
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        dims,
        tone === "met" ? "bg-met-strong text-white" : tone === "accent" ? "bg-accent text-accent-ink" : "bg-ink text-paper"
      )}
      aria-hidden
    >
      {initials(label)}
    </span>
  );
}

function ShareButton({ id }: { id: string }) {
  const { toast } = useShell();
  async function share() {
    const url = siteUrl(`/p/?id=${id}`);
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ url, title: "Config BLR Wall" });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      /* user cancelled share sheet */
    }
  }
  return (
    <button onClick={share} className="grid size-8 place-items-center rounded-full hover:bg-paper hover:text-ink" aria-label="Copy link to this post">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </button>
  );
}

function UpvoteButton({ post, voted, onVoted }: { post: Post; voted: boolean; onVoted: (id: string) => void }) {
  // Count at click time; once the store echoes the update the real count moves past it.
  const [pendingFrom, setPendingFrom] = useState<number | null>(null);
  const isVoted = voted || pendingFrom !== null;

  async function vote() {
    if (isVoted) return;
    setPendingFrom(post.upvotes);
    const ok = await getStore().upvote(post.id).catch(() => false);
    setPendingFrom(null);
    if (ok) onVoted(post.id);
  }

  const count = pendingFrom !== null && post.upvotes <= pendingFrom ? pendingFrom + 1 : post.upvotes;

  return (
    <button
      onClick={vote}
      aria-pressed={isVoted}
      aria-label={isVoted ? "Upvoted" : "Upvote"}
      className={cx(
        "flex h-8 items-center gap-1 rounded-full border px-2.5 font-semibold tabular-nums transition-colors",
        isVoted ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink hover:border-ink/40"
      )}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 4 3 15h6v5h6v-5h6z" />
      </svg>
      {count}
    </button>
  );
}
