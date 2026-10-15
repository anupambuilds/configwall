// PLACEHOLDER talk list — replace with today's real schedule before launch.
export const TALKS = [
  "Opening keynote",
  "Design systems at scale",
  "AI in the design workflow",
  "Prototyping & craft",
  "Accessibility in practice",
  "Building design teams in India",
  "Closing panel",
] as const;

/** Label for takeaways not tied to one talk. */
export const GENERAL_TALK_LABEL = "The event overall";

// PLACEHOLDER — use the hashtag attendees are actually using.
export const HASHTAG = "ConfigBLR";

// Your X handle for the "built by" credit (without @).
export const BUILDER_HANDLE = process.env.NEXT_PUBLIC_BUILDER_HANDLE || "yourhandle";

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Local-only admin gate. On a static site this is NOT real security — the
// backend (Supabase RLS / edge function) must enforce admin rights.
export const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "local-admin";

/** Posts and takeaways: fits on X. */
export const MAX_BODY = 280;
/** Conversations and notes. */
export const MAX_LONG = 1000;

/** Absolute URL for a path inside the app, honouring basePath. */
export function siteUrl(path = "/"): string {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin}${BASE_PATH}${path}`;
}

export function siteHost(): string {
  try {
    const u = new URL(siteUrl("/"));
    return (u.host + u.pathname).replace(/\/$/, "");
  } catch {
    return "";
  }
}
