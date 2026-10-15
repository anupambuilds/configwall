// Creates a wall entry. Every write goes through here: validation, read-only
// mode, rate limits, double-submit protection, X handle checks, server-side
// tweet fetch, and one-entry-per-tweet (re-sharing a deleted tweet restores it).
import { isAdminSecret } from "../_shared/admin.ts";
import { db, isReadOnly, PHOTO_URL_PREFIX, PUBLIC_COLUMNS, rateLimit } from "../_shared/db.ts";
import { ApiError, deviceId, json, serve, str } from "../_shared/http.ts";
import { cleanDraft, handleFromXUrl, tweetIdFromUrl } from "../_shared/validate.ts";
import { fetchTweet, handleExists } from "../_shared/x.ts";

const POSTS_PER_10_MIN = 10;

async function requireHandle(handle: string | null, field: string, whose: string) {
  if (!handle) return;
  // null = X unreachable → allow (posting never fails because X is down).
  if ((await handleExists(handle)) === false) throw new ApiError(400, "handle_not_found", `We couldn't find @${handle} on X. Check ${whose} handle.`, field);
}

serve(async (req, body) => {
  const device = deviceId(body.device_id);
  const admin = isAdminSecret(body.admin_secret);
  const idem = str(body.idempotency_key);

  if (!admin && (await isReadOnly())) throw new ApiError(423, "read_only", "Posting is paused right now. Check back soon.");

  // Double-tap / retry: return the post this key already created.
  if (idem) {
    const { data: prior } = await db.from("posts").select(PUBLIC_COLUMNS).eq("idempotency_key", idem).maybeSingle();
    if (prior) return json(req, { post: prior });
  }

  const p = cleanDraft((body.post ?? {}) as Record<string, unknown>, PHOTO_URL_PREFIX);
  if (!admin) await rateLimit("device_id", device, "created_at", POSTS_PER_10_MIN, "posted");

  let tweet = null;
  let tweet_id: string | null = null;
  if (p.type === "post" && p.source === "x") {
    tweet_id = tweetIdFromUrl(p.link_url)!;

    // One entry per tweet.
    const { data: existing } = await db.from("posts").select("id, hidden").eq("tweet_id", tweet_id).maybeSingle();
    if (existing && !existing.hidden) {
      const { data: shown } = await db.from("posts").select(PUBLIC_COLUMNS).eq("id", existing.id).single();
      throw new ApiError(409, "duplicate", "This post is already on the wall.", "link_url", { existing: shown });
    }

    const res = await fetchTweet(tweet_id);
    if (!res.ok && res.reason === "not_found") throw new ApiError(400, "tweet_unavailable", "This post is private, deleted or doesn't exist.", "link_url");
    if (res.ok) tweet = res.tweet;
    p.author_handle = tweet?.author_handle || handleFromXUrl(p.link_url!) || p.author_handle;

    if (existing) {
      // Deleted earlier: restore the original instead of duplicating it; it now belongs to this sharer.
      const { data: restored, error } = await db
        .from("posts")
        .update({ hidden: false, deleted_at: null, deleted_by: null, kind: p.kind, tweet: tweet ?? undefined, device_id: device })
        .eq("id", existing.id)
        .select(PUBLIC_COLUMNS)
        .single();
      if (error) throw error;
      return json(req, { post: restored, restored: true });
    }
  } else {
    await requireHandle(p.author_handle, "author_handle", "your");
  }
  if (p.type === "met") await requireHandle(p.met_handle, "met_handle", "their");

  const { data: post, error } = await db
    .from("posts")
    .insert({ ...p, tweet, tweet_id, device_id: device, idempotency_key: idem, is_seed: admin })
    .select(PUBLIC_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505" && String(error.message).includes("idempotency")) {
      const { data: prior } = await db.from("posts").select(PUBLIC_COLUMNS).eq("idempotency_key", idem).single();
      return json(req, { post: prior });
    }
    if (error.code === "23505") throw new ApiError(409, "duplicate", "This post is already on the wall.", "link_url");
    if (error.code === "23514") throw new ApiError(400, "invalid", "Something in this post isn't allowed. Check the fields and try again.");
    throw error;
  }
  return json(req, { post });
});
