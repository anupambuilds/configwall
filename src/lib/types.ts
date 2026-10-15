/**
 * The feed has three kinds of entry:
 * - post: X-first. Either a shared X post (source "x") or a native wall post
 *         (source "native") that can be pushed to X. Typed takeaway/quote/…
 * - met:  someone you met — the heart of the product.
 * - note: notes from a specific talk.
 */
export const POST_TYPES = ["post", "met", "note"] as const;
export type PostType = (typeof POST_TYPES)[number];

export const POST_KINDS = ["takeaway", "quote", "story", "photo", "review"] as const;
export type PostKind = (typeof POST_KINDS)[number];

export type PostSource = "x" | "native";

export const MAX_MET_PHOTOS = 4;

/** Copy of a tweet saved when it's added, so we can render our own card. */
export interface TweetSnapshot {
  id: string;
  url: string;
  text: string;
  author_name: string;
  author_handle: string;
  author_avatar: string | null;
  created_at: string;
  photos: string[];
  /** Video or GIF (mp4 + poster frame), played inline on the card. */
  videos?: { poster: string; src: string }[];
  /** Handles mentioned in the tweet (without @). */
  mentions: string[];
}

export interface Post {
  id: string;
  type: PostType;
  author_handle: string | null;

  /** post: native text · met: what was discussed · note: the notes. */
  body: string | null;

  // --- post ---
  source: PostSource | null;
  kind: PostKind | null;
  link_url: string | null;
  /** Null when the tweet couldn't be fetched — the card falls back to X's embed. */
  tweet: TweetSnapshot | null;
  /** Native posts: people tagged (handles, without @). */
  tagged: string[];

  // --- met ---
  met_name: string | null;
  met_role: string | null;
  met_company: string | null;
  met_handle: string | null;
  met_linkedin: string | null;
  /** Up to MAX_MET_PHOTOS. */
  photos: string[];

  // --- note ---
  /** One of the fixed talks. */
  talk: string | null;

  upvotes: number;
  hidden: boolean;
  is_seed: boolean;
  created_at: string;
}

export type NewPost = Omit<Post, "id" | "upvotes" | "hidden" | "is_seed" | "created_at">;

export const EMPTY_POST: NewPost = {
  type: "post",
  author_handle: null,
  body: null,
  source: null,
  kind: null,
  link_url: null,
  tweet: null,
  tagged: [],
  met_name: null,
  met_role: null,
  met_company: null,
  met_handle: null,
  met_linkedin: null,
  photos: [],
  talk: null,
};

export const KIND_LABELS: Record<PostKind, string> = {
  takeaway: "Takeaway",
  quote: "Quote",
  story: "Story",
  photo: "Photo",
  review: "Review",
};

export const TYPE_LABELS: Record<PostType, string> = {
  post: "Post",
  met: "People we met",
  note: "Talk notes",
};

export function displayKind(p: Pick<Post, "type" | "kind">): string {
  if (p.type === "post") return p.kind ? KIND_LABELS[p.kind] : "Post";
  return p.type === "met" ? "Met" : "Talk notes";
}
