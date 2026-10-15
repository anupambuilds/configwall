"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { siteHost, siteUrl } from "@/lib/config";
import { personLabel, type Person } from "@/lib/people";
import { xIntentUrl } from "@/lib/share";
import { displayKind, type Post } from "@/lib/types";
import { cx } from "@/lib/util";
import { useShell } from "./app-shell";
import { XLogo } from "./icons";

const W = 1080;
const H = 1350;

/** Posts credited to this person: things they wrote, plus met cards about them. */
export function personPosts(posts: Post[], person: Person): Post[] {
  return posts.filter(
    (p) =>
      (person.handle && p.author_handle === person.handle) ||
      (p.type === "met" &&
        ((person.handle && p.met_handle === person.handle) ||
          (!person.handle && person.name && p.met_name?.trim().toLowerCase() === person.name.toLowerCase())))
  );
}

function postText(p: Post): string {
  if (p.type === "met") return `Met ${p.met_name || (p.met_handle ? `@${p.met_handle}` : "someone")}. ${p.body ?? ""}`.trim();
  return p.body ?? p.tweet?.text ?? "";
}

/** Highest-upvoted entry they authored; if nothing has upvotes yet, their latest. */
function pickFeatured(posts: Post[], handle: string | null): { post: Post; label: string } | null {
  if (!handle) return null;
  const mine = posts.filter((p) => p.author_handle === handle && postText(p));
  if (!mine.length) return null;
  const top = [...mine].sort((a, b) => b.upvotes - a.upvotes || b.created_at.localeCompare(a.created_at))[0];
  if (top.upvotes > 0) return { post: top, label: "Top post" };
  const latest = [...mine].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return { post: latest, label: "Latest post" };
}

function textSize(text: string): number {
  const n = text.length;
  if (n < 60) return 76;
  if (n < 110) return 64;
  if (n < 170) return 54;
  if (n < 230) return 46;
  return 40;
}

function clip(text: string, max = 280): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Side panel with a person's Config card: metrics + top/latest post, save as PNG, share on X. */
export function ConfigCardPanel({ person, posts, onClose }: { person: Person; posts: Post[]; onClose: () => void }) {
  const { toast } = useShell();
  const featured = useMemo(() => pickFeatured(posts, person.handle), [posts, person.handle]);
  const title = person.handle && person.name ? person.name : personLabel(person);
  const cardRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [busy, setBusy] = useState(false);
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / W));
    ro.observe(el);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  const fileBase = person.handle ?? person.key.replace(/[^a-z0-9]+/gi, "-");

  async function save() {
    setBusy(true);
    try {
      const { toBlob } = await import("html-to-image");
      await document.fonts.ready;
      const blob = await toBlob(cardRef.current!, { width: W, height: H, pixelRatio: 1, style: { transform: "none" }, cacheBust: true });
      if (!blob) throw new Error("Render failed");
      const file = new File([blob], `config-blr-${fileBase}.png`, { type: "image/png" });
      // Phones: hand the image to the native share sheet (Save Image / post directly).
      if (navigator.canShare?.({ files: [file] }) && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ files: [file] }).catch(() => {});
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
    } catch {
      toast("Couldn't make the image. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function shareOnX() {
    const who = person.handle ? `@${person.handle}'s` : `${title}'s`;
    const text = `${who} Figma Config BLR in one card. Add yours:`;
    window.open(xIntentUrl(text, siteUrl(`/people/?card=${encodeURIComponent(person.key)}`)), "_blank", "noopener");
  }

  const stats = [
    { n: person.posts, label: "posts" },
    { n: person.connections.size, label: "people met" },
    { n: person.upvotes, label: "upvotes" },
  ];
  const text = featured ? clip(postText(featured.post)) : "";

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={`Config card for ${title}`}>
      <div className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="animate-sheet-up relative flex h-full w-full max-w-[480px] flex-col overflow-y-auto bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-card/95 px-5 py-4 backdrop-blur">
          <h2 className="flex-1 truncate font-serif text-2xl">Config card</h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full text-muted hover:bg-paper" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div ref={boxRef} className="relative w-full overflow-hidden rounded-2xl shadow-[0_24px_50px_-28px_rgba(0,0,0,0.4)]" style={{ aspectRatio: `${W} / ${H}` }}>
            <div
              ref={cardRef}
              className="absolute top-0 left-0 flex flex-col bg-paper text-ink"
              style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left", padding: 88 }}
            >
              <div className="flex items-center justify-between" style={{ fontSize: 26 }}>
                <span className="font-semibold uppercase" style={{ letterSpacing: "0.16em" }}>
                  Figma Config BLR Wall
                </span>
                <span className="rounded-full border-2 border-ink/20 font-medium text-muted uppercase" style={{ padding: "8px 20px", fontSize: 20, letterSpacing: "0.12em" }}>
                  Unofficial
                </span>
              </div>

              <div style={{ marginTop: 72 }}>
                <div className="font-serif" style={{ fontSize: 104, lineHeight: 1, letterSpacing: "-0.02em", wordBreak: "break-word" }}>
                  {title}
                </div>
                {person.handle && person.name && (
                  <div className="text-muted" style={{ fontSize: 32, marginTop: 16 }}>
                    @{person.handle}
                  </div>
                )}
                {(person.role || person.company) && (
                  <div className="text-muted" style={{ fontSize: 28, marginTop: 8 }}>
                    {[person.role, person.company].filter(Boolean).join(" at ")}
                  </div>
                )}
              </div>

              <div className="flex" style={{ gap: 64, marginTop: 56 }}>
                {stats.map((s) => (
                  <div key={s.label}>
                    <div className="font-serif" style={{ fontSize: 112, lineHeight: 0.9 }}>
                      {s.n}
                    </div>
                    <div className="font-medium text-muted uppercase" style={{ fontSize: 22, letterSpacing: "0.12em", marginTop: 12 }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-1 flex-col justify-center" style={{ marginTop: 48 }}>
                <div className="bg-ink" style={{ height: 3, width: 96, marginBottom: 32 }} />
                {featured ? (
                  <>
                    <div className="font-semibold text-muted uppercase" style={{ fontSize: 22, letterSpacing: "0.14em", marginBottom: 20 }}>
                      {featured.label} · {displayKind(featured.post)}
                    </div>
                    <p className="font-serif" style={{ fontSize: textSize(text), lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                      {text}
                    </p>
                  </>
                ) : (
                  <p className="font-serif text-muted" style={{ fontSize: 56, lineHeight: 1.1 }}>
                    Met at Config BLR.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between border-t-2 border-ink/10 text-muted" style={{ paddingTop: 32, fontSize: 24 }}>
                <span className="font-semibold text-ink">{siteHost()}</span>
                <span>Community recap wall</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={save} disabled={busy} className="rounded-full bg-ink py-3 font-semibold text-paper disabled:opacity-60">
              {busy ? "Rendering…" : "Save image"}
            </button>
            <button onClick={shareOnX} className="flex items-center justify-center gap-2 rounded-full border border-ink py-3 font-semibold">
              Share on <XLogo className="size-4" />
            </button>
          </div>

          {featured && (
            <Link href={`/p/?id=${featured.post.id}`} className={cx("text-center text-sm text-muted hover:text-ink hover:underline")}>
              Open the {featured.label.toLowerCase()} →
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}
