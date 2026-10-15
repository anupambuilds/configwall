import type { NewPost, Post } from "./types";

/**
 * Data contract between the frontend and the `posts` table
 * (supabase/migrations/0001_init.sql). Every field of `Post` must be listed
 * here — the type check below fails the build if one is missing — and
 * `npm run check:schema` verifies each one exists as a column in the SQL.
 */
export const POST_COLUMNS = [
  "id",
  "type",
  "author_handle",
  "body",
  "source",
  "kind",
  "link_url",
  "tweet",
  "tagged",
  "met_name",
  "met_role",
  "met_company",
  "met_handle",
  "met_linkedin",
  "photos",
  "talk",
  "upvotes",
  "hidden",
  "is_seed",
  "created_at",
] as const satisfies readonly (keyof Post)[];

// Compile-time guarantee that no Post field is left out of the contract.
type Missing = Exclude<keyof Post, (typeof POST_COLUMNS)[number]>;
const allFieldsCovered: [Missing] extends [never] ? true : Missing = true;
void allFieldsCovered;

/** Columns that only exist in the database (never sent to or read by the public client). */
export const DB_ONLY_COLUMNS = ["tweet_id", "device_id"] as const;

/** What the create-post Edge Function receives: the draft plus who sent it. */
export interface CreatePostRequest {
  post: NewPost;
  device_id: string;
  /** Lets the server dedupe double-taps. */
  idempotency_key: string;
}
