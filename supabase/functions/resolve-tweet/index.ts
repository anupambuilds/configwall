// Preview for the add form: fetch a tweet's text, author, photos and video.
import { ApiError, json, serve } from "../_shared/http.ts";
import { tweetIdFromUrl } from "../_shared/validate.ts";
import { fetchTweet } from "../_shared/x.ts";

serve(async (req, body) => {
  const id = tweetIdFromUrl(typeof body.url === "string" ? body.url : null);
  if (!id) throw new ApiError(400, "invalid", "Paste an x.com or twitter.com post link.", "link_url");
  const res = await fetchTweet(id);
  if (res.ok) return json(req, { tweet: res.tweet });
  if (res.reason === "not_found") throw new ApiError(404, "tweet_unavailable", "This post is private, deleted or doesn't exist.", "link_url");
  return json(req, { tweet: null }); // X unreachable: the post will show as X's embed
});
