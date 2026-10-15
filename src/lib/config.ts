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

/**
 * Which environment this build is. "local" = your machine, "test" = the
 * hosted test site (test database), "production" = the public site.
 */
export type AppEnv = "local" | "test" | "production";
export const APP_ENV: AppEnv = (["test", "production"] as const).find((e) => e === process.env.NEXT_PUBLIC_APP_ENV) ?? "local";

/**
 * Supabase project for this build. Both values are public by design (they
 * ship in the page); the database's access rules limit what they can do.
 * Unset → the app runs on local mock data.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

// Admin secret for LOCAL DEVELOPMENT ONLY (mock store). Live builds verify
// the secret on the server and never ship it in the page.
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
