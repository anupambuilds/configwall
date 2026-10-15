// X lookups without an API key: tweets via the public syndication endpoint (the
// one react-tweet uses), handle existence via oEmbed. Both block browsers (CORS),
// which is why they run here.
import { db } from "./db.ts";

export interface TweetSnapshot {
  id: string;
  url: string;
  text: string;
  author_name: string;
  author_handle: string;
  author_avatar: string | null;
  created_at: string;
  photos: string[];
  videos: { poster: string; src: string }[];
  mentions: string[];
}

export type TweetResult = { ok: true; tweet: TweetSnapshot } | { ok: false; reason: "not_found" | "unavailable" };

const TIMEOUT_MS = 6000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; ConfigWall/1.0)" } });
  } finally {
    clearTimeout(t);
  }
}

function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(6 ** 2).replace(/(0+|\.)/g, "");
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// deno-lint-ignore no-explicit-any
type Raw = any;

function mapTweet(id: string, j: Raw): TweetSnapshot {
  let text: string = j.note_tweet?.note_tweet_results?.result?.text ?? j.text ?? "";
  // Expand t.co links to their real URLs; drop the trailing t.co link that points at the media itself.
  for (const u of j.entities?.urls ?? []) if (u.url && u.expanded_url) text = text.split(u.url).join(u.expanded_url);
  for (const m of j.entities?.media ?? []) if (m.url) text = text.split(m.url).join("");
  text = decodeEntities(text).trim();

  const media: Raw[] = j.mediaDetails ?? [];
  const photos = media.filter((m) => m.type === "photo").map((m) => m.media_url_https as string);
  const videos = media
    .filter((m) => m.type === "video" || m.type === "animated_gif")
    .map((m) => {
      const mp4 = (m.video_info?.variants ?? []).filter((v: Raw) => v.content_type === "video/mp4").sort((a: Raw, b: Raw) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
      // Second-best bitrate keeps mobile data use reasonable.
      const pick = mp4[1] ?? mp4[0];
      return pick ? { poster: m.media_url_https as string, src: pick.url as string } : null;
    })
    .filter((v): v is { poster: string; src: string } => !!v);

  const handle = String(j.user?.screen_name ?? "").toLowerCase();
  return {
    id,
    url: `https://x.com/${j.user?.screen_name ?? "i"}/status/${id}`,
    text,
    author_name: j.user?.name ?? handle,
    author_handle: handle,
    author_avatar: j.user?.profile_image_url_https ?? null,
    created_at: j.created_at ? new Date(j.created_at).toISOString() : new Date().toISOString(),
    photos: photos.slice(0, 4),
    videos: videos.slice(0, 1),
    mentions: [...new Set<string>((j.entities?.user_mentions ?? []).map((m: Raw) => String(m.screen_name).toLowerCase()))],
  };
}

/** not_found = deleted, protected or never existed; unavailable = X didn't answer (fall back to embed). */
export async function fetchTweet(id: string): Promise<TweetResult> {
  try {
    const r = await fetchWithTimeout(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${syndicationToken(id)}`);
    if (r.status === 404) return { ok: false, reason: "not_found" };
    if (!r.ok) return { ok: false, reason: "unavailable" };
    const txt = await r.text();
    if (!txt.trim()) return { ok: false, reason: "not_found" };
    const j = JSON.parse(txt);
    if (j.__typename === "TweetTombstone" || j.tombstone || !j.user) return { ok: false, reason: "not_found" };
    return { ok: true, tweet: mapTweet(id, j) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Does this X handle exist? true / false, or null when X can't be reached
 * (callers allow the post in that case). Cached: hits for 30 days, misses for 1 day.
 */
export async function handleExists(handle: string): Promise<boolean | null> {
  const { data: cached } = await db.from("x_handles").select('"exists", checked_at').eq("handle", handle).maybeSingle();
  if (cached) {
    const age = Date.now() - new Date(cached.checked_at).getTime();
    if (age < (cached.exists ? 30 : 1) * 86_400_000) return cached.exists;
  }
  let exists: boolean | null = null;
  try {
    const r = await fetchWithTimeout(`https://publish.twitter.com/oembed?url=${encodeURIComponent(`https://x.com/${handle}`)}`);
    if (r.status === 404) exists = false;
    else if (r.ok) {
      const body = await r.text();
      try {
        exists = !!JSON.parse(body).url;
      } catch {
        exists = false; // HTML error page = no such account
      }
    }
  } catch {
    exists = null;
  }
  if (exists !== null) await db.from("x_handles").upsert({ handle, exists, checked_at: new Date().toISOString() });
  return exists;
}
