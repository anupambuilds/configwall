"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    twttr?: {
      widgets: {
        createTweet: (id: string, el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLElement | undefined>;
      };
    };
  }
}

let loader: Promise<void> | null = null;

function loadWidgets(): Promise<void> {
  if (window.twttr?.widgets) return Promise.resolve();
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://platform.twitter.com/widgets.js";
    s.async = true;
    s.onload = () => {
      // widgets.js sets twttr synchronously but `widgets` may lag a tick.
      const wait = () => (window.twttr?.widgets ? resolve() : setTimeout(wait, 50));
      wait();
    };
    s.onerror = () => {
      loader = null;
      reject(new Error("widgets.js blocked"));
    };
    document.head.appendChild(s);
  });
  return loader;
}

function tweetId(url: string): string | null {
  return url.match(/status(?:es)?\/(\d+)/)?.[1] ?? null;
}

/**
 * Lazy X embed: nothing loads until the card is near the viewport, and a
 * plain fallback card shows when the embed is blocked or the post is gone.
 */
export function XEmbed({ url, handle }: { url: string; handle: string | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const id = tweetId(url);

  useEffect(() => {
    const el = wrap.current;
    if (!el || !id) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setState("loading");
        loadWidgets()
          .then(() => window.twttr!.widgets.createTweet(id, target.current!, { dnt: true, conversation: "none", align: "center" }))
          .then((node) => setState(node ? "done" : "failed"))
          .catch(() => setState("failed"));
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [id]);

  const showFallback = !id || state === "failed";

  return (
    <div ref={wrap} className="relative">
      {/* React never renders children here, so widgets.js can own this node. */}
      <div ref={target} className={state === "done" ? "-my-2.5" : "hidden"} />
      {(state === "idle" || state === "loading") && id && (
        <div className="flex min-h-48 animate-pulse flex-col gap-2 rounded-xl border border-line bg-paper/60 p-4">
          <div className="h-3 w-24 rounded bg-line" />
          <div className="h-3 w-full rounded bg-line" />
          <div className="h-3 w-4/5 rounded bg-line" />
          <div className="mt-auto text-xs text-muted">Loading post from X…</div>
        </div>
      )}
      {showFallback && <ExternalCard url={url} handle={handle} site="X" />}
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
