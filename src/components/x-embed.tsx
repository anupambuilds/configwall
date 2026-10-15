"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/util";

declare global {
  interface Window {
    twttr?: {
      widgets: {
        createTweet: (id: string, el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLElement | undefined>;
      };
    };
  }
}

/** Give up on X's embed after this long and show the "View on X" card instead. */
const EMBED_TIMEOUT_MS = 10_000;

let loader: Promise<void> | null = null;

function loadWidgets(): Promise<void> {
  if (window.twttr?.widgets) return Promise.resolve();
  loader ??= new Promise((resolve, reject) => {
    const fail = (why: string) => {
      loader = null;
      reject(new Error(why));
    };
    const s = document.createElement("script");
    s.src = "https://platform.twitter.com/widgets.js";
    s.async = true;
    s.onload = () => {
      // widgets.js sets twttr synchronously but `widgets` may lag a tick; don't poll forever.
      let tries = 0;
      const wait = () => (window.twttr?.widgets ? resolve() : ++tries > 100 ? fail("widgets.js never initialised") : setTimeout(wait, 50));
      wait();
    };
    s.onerror = () => fail("widgets.js blocked");
    document.head.appendChild(s);
  });
  return loader;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e))
    );
  });
}

function tweetId(url: string): string | null {
  return url.match(/status(?:es)?\/(\d+)/)?.[1] ?? null;
}

/**
 * Lazy X embed: nothing loads until the card is near the viewport, and a
 * plain fallback card shows when the embed is blocked, slow, or the post is gone.
 */
export function XEmbed({ url, handle }: { url: string; handle: string | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [state, setState] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const id = tweetId(url);

  useEffect(() => {
    const el = wrap.current;
    if (!el || !id) return;
    let alive = true;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || started.current) return;
        started.current = true;
        io.disconnect();
        setState("loading");
        withTimeout(
          loadWidgets().then(() => window.twttr!.widgets.createTweet(id, target.current!, { dnt: true, conversation: "none", align: "center" })),
          EMBED_TIMEOUT_MS
        )
          .then((node) => alive && setState(node ? "done" : "failed"))
          .catch(() => {
            if (!alive) return;
            target.current?.replaceChildren();
            setState("failed");
          });
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [id]);

  const loading = (state === "idle" || state === "loading") && !!id;

  return (
    <div ref={wrap} className="relative min-w-0 overflow-hidden">
      {/*
        React never renders children here, so widgets.js can own this node.
        It must stay laid out (not display:none) while loading: X only reports
        "rendered" once the tweet has drawn and measured itself.
      */}
      <div
        ref={target}
        className={cx("x-embed", state === "done" ? "" : state === "failed" ? "hidden" : "pointer-events-none opacity-0")}
        aria-hidden={state !== "done"}
      />
      {loading && (
        <div className="absolute inset-x-0 top-0 flex min-h-48 animate-pulse flex-col gap-2 rounded-xl border border-line bg-paper p-4">
          <div className="h-3 w-24 rounded bg-line" />
          <div className="h-3 w-full rounded bg-line" />
          <div className="h-3 w-4/5 rounded bg-line" />
          <div className="mt-auto text-xs text-muted">Loading post from X…</div>
        </div>
      )}
      {loading && <div className="min-h-48" aria-hidden />}
      {(!id || state === "failed") && <ExternalCard url={url} handle={handle} site="X" />}
    </div>
  );
}

export function ExternalCard({ url, handle, site }: { url: string; handle: string | null; site: "X" | "LinkedIn" }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-line bg-paper/60 p-3.5 transition-colors hover:border-ink/30"
    >
      <span
        className={
          "grid size-10 shrink-0 place-items-center rounded-lg text-sm font-bold text-white " +
          (site === "LinkedIn" ? "bg-[#0a66c2]" : "bg-ink")
        }
        aria-hidden
      >
        {site === "LinkedIn" ? "in" : "𝕏"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold group-hover:underline">View on {site}</span>
        <span className="block truncate text-xs text-muted">{handle ? `Post by @${handle}` : new URL(url).hostname}</span>
      </span>
      <span className="text-muted" aria-hidden>
        ↗
      </span>
    </a>
  );
}
