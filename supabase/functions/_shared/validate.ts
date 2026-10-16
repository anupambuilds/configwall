// Server copy of the form rules. KEEP IN SYNC with src/lib/util.ts (validatePost,
// normalizeHandle, normalizeLink, tweetIdFromUrl, looksSpammy) and the DB checks.
import { ApiError } from "./http.ts";

export const MAX_BODY = 280;
export const MAX_LONG = 1000;
export const MAX_PHOTOS = 4;
export const POST_TYPES = ["post", "met", "note"] as const;
export const POST_KINDS = ["takeaway", "quote", "story", "review"] as const;

export function normalizeHandle(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const h = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
    .replace(/^@+/, "")
    .split(/[/?#\s]/)[0];
  return /^[A-Za-z0-9_]{1,15}$/.test(h) ? h.toLowerCase() : null;
}

export function tweetIdFromUrl(url: string | null | undefined): string | null {
  return url?.match(/(?:^|\/\/|\.)(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status(?:es)?\/(\d+)/i)?.[1] ?? null;
}

export function handleFromXUrl(url: string): string | null {
  return url.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status/i)?.[1]?.toLowerCase() ?? null;
}

/** Canonical X status URL, or null if it isn't one. */
export function canonicalTweetUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/(?:^|\/\/|\.)(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d+)/i);
  return m ? `https://x.com/${m[1]}/status/${m[2]}` : null;
}

export function canonicalLinkedIn(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname) || !/^\/in\/[^/]+/i.test(u.pathname)) return null;
    u.protocol = "https:";
    u.search = "";
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}

// Speed bump, not moderation (mirrors the client list).
const BLOCKED = ["fuck", "shit", "bitch", "cunt", "nigger", "faggot", "porn", "casino", "crypto giveaway", "airdrop"];

export function looksSpammy(text: string): boolean {
  const t = text.toLowerCase();
  if (BLOCKED.some((w) => t.includes(w))) return true;
  return (t.match(/https?:\/\/|www\./g)?.length ?? 0) > 1;
}

function text(v: unknown, max: number, field: string, label: string): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string") throw new ApiError(400, "invalid", `${label} looks wrong.`, field);
  const t = v.trim();
  if (t.length > max) throw new ApiError(400, "too_long", `Keep ${label.toLowerCase()} under ${max} characters.`, field);
  return t || null;
}

export interface CleanPost {
  type: (typeof POST_TYPES)[number];
  author_handle: string | null;
  body: string | null;
  source: "x" | "native" | null;
  kind: (typeof POST_KINDS)[number] | null;
  link_url: string | null;
  tagged: string[];
  met_name: string | null;
  met_role: string | null;
  met_company: string | null;
  met_handle: string | null;
  met_linkedin: string | null;
  photos: string[];
  talk: string | null;
}

/** Whitelists and validates a client draft. Throws ApiError with the offending field. */
export function cleanDraft(raw: Record<string, unknown>, photoPrefix: string): CleanPost {
  const type = raw.type as CleanPost["type"];
  if (!POST_TYPES.includes(type)) throw new ApiError(400, "invalid", "Unknown entry type.");

  const handleRaw = raw.author_handle;
  const author_handle = normalizeHandle(handleRaw);
  if (typeof handleRaw === "string" && handleRaw.trim() && !author_handle) throw new ApiError(400, "invalid", "Your X handle doesn't look right.", "author_handle");

  const p: CleanPost = {
    type,
    author_handle,
    body: null,
    source: null,
    kind: null,
    link_url: null,
    tagged: [],
    met_name: null,
    met_role: null,
    met_company: null,
    met_handle: null,
    met_linkedin: null,
    photos: [],
    talk: null,
  };

  if (type === "post") {
    p.kind = POST_KINDS.includes(raw.kind as never) ? (raw.kind as CleanPost["kind"]) : null;
    if (!p.kind) throw new ApiError(400, "required", "Pick what kind of post it is.", "kind");
    p.source = raw.source === "x" ? "x" : raw.source === "native" ? "native" : null;
    if (p.source === "x") {
      p.link_url = canonicalTweetUrl(raw.link_url);
      if (!p.link_url) {
        const isLinkedIn = typeof raw.link_url === "string" && /linkedin\.com/i.test(raw.link_url);
        throw new ApiError(400, "invalid", isLinkedIn ? "LinkedIn posts aren't supported yet. Write a post instead." : "Paste an x.com or twitter.com post link.", "link_url");
      }
    } else if (p.source === "native") {
      p.body = text(raw.body, MAX_BODY, "body", "Your post");
      if (!p.body) throw new ApiError(400, "required", "Write your post.", "body");
      p.tagged = Array.isArray(raw.tagged) ? [...new Set(raw.tagged.map(normalizeHandle).filter((h): h is string => !!h))].slice(0, 10) : [];
    } else throw new ApiError(400, "invalid", "Unknown post source.");
  }

  if (type === "met") {
    p.met_name = text(raw.met_name, 80, "met_name", "Their name");
    p.met_role = text(raw.met_role, 80, "met_role", "Designation");
    p.met_company = text(raw.met_company, 80, "met_company", "Company");
    const mh = raw.met_handle;
    p.met_handle = normalizeHandle(mh);
    if (typeof mh === "string" && mh.trim() && !p.met_handle) throw new ApiError(400, "invalid", "Their X handle doesn't look right.", "met_handle");
    if (raw.met_linkedin) {
      p.met_linkedin = canonicalLinkedIn(raw.met_linkedin);
      if (!p.met_linkedin) throw new ApiError(400, "invalid", "That LinkedIn link should look like linkedin.com/in/name.", "met_linkedin");
    }
    if (!p.met_name && !p.met_handle && !p.met_linkedin) throw new ApiError(400, "required", "Add their name, X handle or LinkedIn.", "met_name");
    if (p.met_handle && p.met_handle === author_handle) throw new ApiError(400, "invalid", "You can't meet yourself (nice try).", "met_handle");
    p.body = text(raw.body, MAX_LONG, "body", "The conversation");
    if (!p.body) throw new ApiError(400, "required", "Write what you talked about.", "body");
    if (!author_handle) throw new ApiError(400, "required", "Add your X handle so the connection counts.", "author_handle");
    const photos = Array.isArray(raw.photos) ? raw.photos : [];
    if (photos.length > MAX_PHOTOS) throw new ApiError(400, "invalid", `Up to ${MAX_PHOTOS} photos.`, "photos");
    for (const u of photos) {
      if (typeof u !== "string" || !u.startsWith(photoPrefix)) throw new ApiError(400, "invalid", "Photos must be uploaded through the wall.", "photos");
    }
    p.photos = photos as string[];
  }

  if (type === "note") {
    p.talk = text(raw.talk, 200, "talk", "The talk");
    if (!p.talk) throw new ApiError(400, "required", "Pick the talk these notes are from.", "talk");
    p.body = text(raw.body, MAX_LONG, "body", "Your notes");
    if (!p.body) throw new ApiError(400, "required", "Add your notes.", "body");
  }

  const all = [p.body, p.met_name, p.met_role, p.met_company].filter(Boolean).join(" ");
  if (looksSpammy(all)) throw new ApiError(400, "spam", "That looks like spam. Try rephrasing.", "body");
  return p;
}
