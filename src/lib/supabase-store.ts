"use client";

import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";
import { POST_COLUMNS } from "./db";
import { getAdminSecret, getDeviceId } from "./identity";
import { DuplicatePostError, type Settings, type Store, type StoreEvent } from "./store";
import type { Post, TweetSnapshot } from "./types";
import { tweetIdFromUrl } from "./util";

const COLUMNS = POST_COLUMNS.join(",");

/** An error from an Edge Function, with the form field it belongs to (if any). */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public field?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createSupabaseStore(): Store {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const listeners = new Set<(e: StoreEvent) => void>();
  let channel: RealtimeChannel | null = null;

  function emit(e: StoreEvent) {
    listeners.forEach((l) => l(e));
  }

  async function call<T>(name: string, body: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ApiError("Couldn't reach the wall. Check your connection and try again.", "offline");
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = json.error ?? {};
      if (e.code === "duplicate" && e.existing) throw new DuplicatePostError(e.existing as Post);
      throw new ApiError(e.message ?? "Something went wrong. Try again.", e.code ?? "error", e.field);
    }
    return json as T;
  }

  async function fetchPost(id: string): Promise<Post | null> {
    const { data } = await sb.from("posts").select(COLUMNS).eq("id", id).maybeSingle();
    return (data as Post | null) ?? null;
  }

  // Live updates: the database broadcasts "post X changed" signals; we re-read
  // the post (RLS applies), so a forged signal can't inject anything.
  function ensureChannel() {
    if (channel) return;
    channel = sb
      .channel("wall")
      .on("broadcast", { event: "post" }, async ({ payload }) => {
        const id = typeof payload?.id === "string" ? payload.id : null;
        if (!id) return;
        const post = await fetchPost(id);
        if (post) emit({ kind: payload.op === "insert" ? "insert" : "update", post, fromThisTab: false });
        else if (!getAdminSecret()) emit({ kind: "delete", id, fromThisTab: false });
      })
      .on("broadcast", { event: "settings" }, async () => {
        const settings = await store.getSettings();
        emit({ kind: "settings", settings, fromThisTab: false });
      })
      .subscribe();
  }

  const store: Store = {
    async listPosts(opts) {
      const { data, error } = await sb.from("posts").select(COLUMNS).order("created_at", { ascending: false }).limit(1000);
      if (error) throw new Error("Couldn't load the wall. Refresh to try again.");
      let posts = (data ?? []) as unknown as Post[];
      const secret = getAdminSecret();
      if (opts?.includeHidden && secret) {
        const res = await call<{ posts: Post[] }>("admin", { action: "list_hidden", admin_secret: secret }).catch(() => ({ posts: [] }));
        posts = [...posts, ...res.posts].sort((a, b) => b.created_at.localeCompare(a.created_at));
      }
      return posts;
    },

    getPost: fetchPost,

    async createPost(p) {
      const res = await call<{ post: Post; restored?: boolean }>("create-post", {
        post: p,
        device_id: getDeviceId(),
        idempotency_key: crypto.randomUUID(),
        admin_secret: getAdminSecret() ?? undefined,
      });
      emit({ kind: res.restored ? "update" : "insert", post: res.post, fromThisTab: true });
      return res.post;
    },

    async findByTweet(url) {
      const id = tweetIdFromUrl(url);
      if (!id) return null;
      const { data } = await sb.from("posts").select(COLUMNS).like("link_url", `%/status/${id}`).maybeSingle();
      return (data as Post | null) ?? null;
    },

    async upvote(postId) {
      const { data, error } = await sb.rpc("upvote", { p_post_id: postId, p_device_id: getDeviceId() });
      if (error) throw new Error("Couldn't upvote. Try again.");
      return data === true;
    },

    async myVotes() {
      const { data } = await sb.rpc("my_votes", { p_device_id: getDeviceId() });
      return new Set((data ?? []) as string[]);
    },

    async setHidden(postId, hidden) {
      const res = await call<{ post: Post | null }>("admin", { action: "set_hidden", id: postId, hidden, admin_secret: getAdminSecret() });
      if (res.post) emit({ kind: "update", post: res.post, fromThisTab: true });
    },

    async deletePost(postId) {
      await call("delete-post", { id: postId, device_id: getDeviceId(), admin_secret: getAdminSecret() ?? undefined });
      emit({ kind: "delete", id: postId, fromThisTab: true });
    },

    async uploadPhoto(file) {
      const contentType = file.type || "image/jpeg";
      const r = await call<{ path: string; token: string; public_url: string }>("upload-url", { device_id: getDeviceId(), content_type: contentType });
      const { error } = await sb.storage.from("photos").uploadToSignedUrl(r.path, r.token, file, { contentType });
      if (error) throw new ApiError("Photo upload failed. Try again.", "upload", "photos");
      return r.public_url;
    },

    async resolveTweet(url): Promise<TweetSnapshot | null> {
      try {
        const r = await call<{ tweet: TweetSnapshot | null }>("resolve-tweet", { url });
        return r.tweet;
      } catch (e) {
        // A deleted/private tweet is reported again (on the right field) when posting.
        if (e instanceof ApiError && e.code === "tweet_unavailable") return null;
        return null;
      }
    },

    async verifyAdmin(secret) {
      const r = await call<{ ok: boolean }>("admin", { action: "verify", admin_secret: secret }).catch(() => ({ ok: false }));
      return r.ok === true;
    },

    async getSettings(): Promise<Settings> {
      const { data } = await sb.from("settings").select("read_only").eq("id", true).maybeSingle();
      return { readOnly: !!data?.read_only };
    },

    async setReadOnly(on) {
      await call("admin", { action: "set_read_only", on, admin_secret: getAdminSecret() });
      emit({ kind: "settings", settings: { readOnly: on }, fromThisTab: true });
    },

    async recordVisit() {
      const { data } = await sb.rpc("record_visit", { p_device_id: getDeviceId() });
      return typeof data === "number" ? data : 0;
    },

    subscribe(cb) {
      listeners.add(cb);
      ensureChannel();
      return () => listeners.delete(cb);
    },
  };
  return store;
}
