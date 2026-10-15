import { MAX_BODY, MAX_LONG } from "./config";
import type { NewPost } from "./types";

export function normalizeHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const h = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
    .replace(/^@+/, "")
    .split(/[/?#\s]/)[0];
  return /^[A-Za-z0-9_]{1,15}$/.test(h) ? h.toLowerCase() : null;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  // Older than a month (e.g. an old tweet): show the date instead.
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export type LinkKind = "x" | "linkedin";

export function linkKind(url: string | null): LinkKind | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com") return "x";
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
  } catch {}
  return null;
}

/**
 * Canonical links, matching the database checks:
 * X status → https://x.com/{handle}/status/{id} (twitter.com, /photo/1, query and hash dropped);
 * everything else → https, no query or hash.
 */
export function normalizeLink(url: string): string {
  try {
    const u = new URL(url.trim());
    if (linkKind(u.href) === "x") {
      const m = u.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d+)/);
      if (m) return `https://x.com/${m[1]}/status/${m[2]}`;
      u.hostname = "x.com";
    }
    u.protocol = "https:";
    u.search = "";
    u.hash = "";
    return u.href;
  } catch {
    return url.trim();
  }
}

/** The tweet id from any X/Twitter status URL (the duplicate key). */
export function tweetIdFromUrl(url: string | null | undefined): string | null {
  return url?.match(/(?:^|\/\/|\.)(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status(?:es)?\/(\d+)/i)?.[1] ?? null;
}

/** Try to read the author handle out of an X status URL. */
export function handleFromXUrl(url: string): string | null {
  const m = url.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status/i);
  return m ? m[1].toLowerCase() : null;
}

// Tiny list on purpose — this is a speed bump, not moderation. Real checks
// belong server-side once the backend exists.
const BLOCKED = ["fuck", "shit", "bitch", "cunt", "nigger", "faggot", "porn", "casino", "crypto giveaway", "airdrop"];

export function looksSpammy(text: string): boolean {
  const t = text.toLowerCase();
  if (BLOCKED.some((w) => t.includes(w))) return true;
  const urls = t.match(/https?:\/\/|www\./g)?.length ?? 0;
  return urls > 1;
}

export function isLinkedInProfile(url: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return /(^|\.)linkedin\.com$/i.test(u.hostname) && /^\/in\/[^/]+/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function validatePost(p: NewPost): string | null {
  const body = p.body?.trim() ?? "";
  switch (p.type) {
    case "post":
      if (!p.kind) return "Pick what kind of post it is.";
      if (p.source === "x") {
        if (linkKind(p.link_url) !== "x") return "Paste an x.com or twitter.com post link.";
      } else {
        if (!body) return "Write your post.";
        if (body.length > MAX_BODY) return `Posts are capped at ${MAX_BODY} characters so they fit on X.`;
      }
      break;
    case "met":
      if (!p.met_handle && !p.met_linkedin && !p.met_name?.trim()) return "Add their name, X handle or LinkedIn.";
      if (p.met_linkedin && !isLinkedInProfile(p.met_linkedin)) return "That LinkedIn link should look like linkedin.com/in/name.";
      if (p.met_handle && p.met_handle === p.author_handle) return "You can't meet yourself (nice try).";
      if (!body) return "Write what you talked about.";
      if (body.length > MAX_LONG) return `Keep the conversation under ${MAX_LONG} characters.`;
      if (!p.author_handle) return "Add your X handle so the connection counts.";
      break;
    case "note":
      if (!p.talk) return "Pick the talk these notes are from.";
      if (!body) return "Add your notes.";
      if (body.length > MAX_LONG) return `Keep notes under ${MAX_LONG} characters.`;
      break;
  }
  const text = [body, p.met_name, p.met_role, p.met_company].filter(Boolean).join(" ");
  if (looksSpammy(text)) return "That looks like spam. Try rephrasing.";
  return null;
}

/** Split text into plain / @mention / #hashtag / url tokens for rendering. */
export type Token = { kind: "text" | "mention" | "hashtag" | "url"; value: string };

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const re = /(https?:\/\/\S+)|(@[A-Za-z0-9_]{1,15})|(#[\p{L}\p{N}_]+)/gu;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    out.push({ kind: m[1] ? "url" : m[2] ? "mention" : "hashtag", value: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

/** Parse "@a, b  @c" into unique normalized handles. */
export function parseHandles(raw: string): string[] {
  const set = new Set<string>();
  for (const part of raw.split(/[\s,]+/)) {
    const h = normalizeHandle(part);
    if (h) set.add(h);
  }
  return [...set];
}

export function initials(handle: string): string {
  return handle.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "?";
}

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

/** Feed counters: exact up to 100, then rounded down to the nearest 50 ("100+", "150+", …). */
export function formatCount(n: number): string {
  return n <= 100 ? String(n) : `${Math.floor(n / 50) * 50}+`;
}
