import { HASHTAG, siteUrl } from "./config";
import type { Post } from "./types";

function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Text for posting a wall entry to X. X counts any URL as 23 chars, so the
 * text is kept under ~240 to leave room for the link and hashtag.
 */
export function xTextFor(post: Post): string {
  switch (post.type) {
    case "post": {
      const body = post.body ?? "";
      // Tag people who aren't already mentioned in the text.
      const extra = post.tagged.filter((h) => !body.toLowerCase().includes(`@${h}`)).map((h) => `@${h}`);
      const tail = extra.length ? ` with ${extra.join(" ")}` : "";
      return clip(body, 230 - tail.length) + tail;
    }
    case "met": {
      const who = [post.met_name, post.met_handle && `(@${post.met_handle})`].filter(Boolean).join(" ") || "someone great";
      const what = [post.met_role, post.met_company].filter(Boolean).join(" at ");
      const head = `Met ${who}${what ? `, ${what},` : ""} at Config BLR.`;
      return `${head} ${clip(post.body ?? "", 225 - head.length)}`;
    }
    case "note": {
      const head = `My notes from "${post.talk}" at Config BLR: `;
      return head + clip(post.body ?? "", 235 - head.length);
    }
  }
}

export function xIntentUrl(text: string, url: string): string {
  const q = new URLSearchParams({ text, url, hashtags: HASHTAG });
  return `https://x.com/intent/post?${q.toString()}`;
}

export function postToXUrl(post: Post): string {
  return xIntentUrl(xTextFor(post), siteUrl(`/p/?id=${post.id}`));
}

/** Shared X posts already live on X; everything else can be pushed there. */
export function canPostToX(post: Post): boolean {
  return !(post.type === "post" && post.source === "x");
}
