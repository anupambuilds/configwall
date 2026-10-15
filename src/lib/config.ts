/**
 * Config India, Oct 15 (Main Stage + Leadership Collective Lounge at BIEC), in
 * schedule order. Source: config.figma.com/india/agenda/?day=2. The event is
 * over, so titles won't change (renaming would split existing notes).
 */
export const TALK_LIST = [
  { title: "Figma product keynote", speakers: "Dylan Field" },
  { title: "Designing from India, thinking globally", speakers: "Arjun Singh, Animesh Mishra" },
  { title: "The work has to leave the file", speakers: "Ashish Kashyap, Saptarshi Prakash" },
  { title: "Figma Weave: What we keep in creative work and what we refuse to automate", speakers: "Ken Vreman" },
  { title: "Designing for intelligent work: inside Microsoft Copilot's new chapter", speakers: "Parinishtha Yadav" },
  { title: "When everyone can make anything, how far can we take it?", speakers: "Daisuke Sakai" },
  { title: "Figma deep dive: Design together with code on the canvas", speakers: "Manish Kumar, Samantha Lee" },
  { title: "Figma deep dive: Nothing lost in translation, from canvas to production", speakers: "Jake Albaugh, Megan Bednarczyk" },
  { title: "Connecting public services by design", speakers: "Nav Pawera, Debabrata Nayak, Meghna Seshadri" },
  { title: "Applied Insights: the hard thing about easy things", speakers: "Matt Walker, Viral Shah" },
  { title: "An Eternal system of design", speakers: "Priyanka Srinivasagopalan" },
  { title: "What changed when designers started shipping code", speakers: "Sascha Michael Trinkaus, Kaushal Cavale" },
  { title: "Better together: from handoff to handshake", speakers: "Shahee Nannore Hiran, Rhish Neog" },
  { title: "Taking stupid seriously", speakers: "Soren Iverson" },
  { title: "What makes the House of Masaba feel like Masaba", speakers: "Masaba Gupta, Loredana Crisan" },
  { title: "Parting thoughts", speakers: "Dylan Field" },
] as const;

/** Talk titles (what's stored on notes). */
export const TALKS = TALK_LIST.map((t) => t.title);

const SPEAKERS: Record<string, string> = Object.fromEntries(TALK_LIST.map((t) => [t.title, t.speakers]));

/** Speakers for a stored talk title ("" if unknown). */
export function talkSpeakers(title: string | null | undefined): string {
  return (title && SPEAKERS[title]) || "";
}

/** Label for takeaways not tied to one talk. */
export const GENERAL_TALK_LABEL = "The event overall";


// Your X handle for the "built by" credit (without @).
export const BUILDER_HANDLE = process.env.NEXT_PUBLIC_BUILDER_HANDLE || "_anupambhowmick";

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
