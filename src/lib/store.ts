"use client";

import { getDeviceId } from "./identity";
import { buildMockSeed, MOCK_TWEETS } from "./mock-seed";
import type { NewPost, Post, TweetSnapshot } from "./types";

/**
 * Data layer. Everything the UI touches goes through this interface so the
 * backend can be swapped from the local mock to Supabase without UI changes.
 */
export interface Store {
  listPosts(opts?: { includeHidden?: boolean }): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;
  createPost(p: NewPost, opts?: { isSeed?: boolean }): Promise<Post>;
  /** Returns false when this device already voted. */
  upvote(postId: string): Promise<boolean>;
  myVotes(): Promise<Set<string>>;
  setHidden(postId: string, hidden: boolean): Promise<void>;
  /** Public URL for an uploaded (already compressed) photo. */
  uploadPhoto(file: Blob): Promise<string>;
  /**
   * Fetch and snapshot a tweet so we can render our own card. Returns null
   * when it can't be fetched; the card then falls back to X's embed.
   * Backend: a Supabase Edge Function calling X's syndication endpoint.
   */
  resolveTweet(url: string): Promise<TweetSnapshot | null>;
  subscribe(cb: (e: StoreEvent) => void): () => void;
}

export type StoreEvent =
  | { kind: "insert"; post: Post; fromThisTab: boolean }
  | { kind: "update"; post: Post; fromThisTab: boolean };

// ---------------------------------------------------------------------------
// Local mock: localStorage for persistence, BroadcastChannel to fake realtime
// across tabs (open two tabs to test "appears live in another browser").
// ---------------------------------------------------------------------------

const POSTS_KEY = "cbw:mock:posts:v4";
const VOTES_KEY = "cbw:mock:votes:v4";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    throw new Error(
      e instanceof DOMException && e.name === "QuotaExceededError"
        ? "Local storage is full (mock mode keeps photos in the browser). Reset mock data on /admin."
        : "Couldn't save locally."
    );
  }
}

function createMockStore(): Store {
  const listeners = new Set<(e: StoreEvent) => void>();
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("cbw") : null;

  channel?.addEventListener("message", (msg) => {
    const e = msg.data as StoreEvent;
    listeners.forEach((l) => l({ ...e, fromThisTab: false }));
  });

  function emit(e: StoreEvent) {
    listeners.forEach((l) => l(e));
    channel?.postMessage({ ...e, fromThisTab: false });
  }

  function all(): Post[] {
    let posts = read<Post[] | null>(POSTS_KEY, null);
    if (!posts) {
      posts = buildMockSeed();
      write(POSTS_KEY, posts);
    }
    return posts;
  }

  function save(posts: Post[]) {
    write(POSTS_KEY, posts);
  }

  // Simulate network latency so loading states get exercised.
  const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

  return {
    async listPosts(opts) {
      await delay();
      return all().filter((p) => opts?.includeHidden || !p.hidden);
    },

    async getPost(id) {
      await delay(60);
      return all().find((p) => p.id === id && !p.hidden) ?? null;
    },

    async createPost(p, opts) {
      await delay(250);
      const post: Post = {
        ...p,
        id: crypto.randomUUID(),
        upvotes: 0,
        hidden: false,
        is_seed: !!opts?.isSeed,
        created_at: new Date().toISOString(),
      };
      save([post, ...all()]);
      emit({ kind: "insert", post, fromThisTab: true });
      return post;
    },

    async upvote(postId) {
      await delay(80);
      const votes = read<string[]>(VOTES_KEY, []);
      const key = `${postId}:${getDeviceId()}`;
      if (votes.includes(key)) return false;
      const posts = all();
      const post = posts.find((x) => x.id === postId);
      if (!post) return false;
      post.upvotes += 1;
      save(posts);
      write(VOTES_KEY, [...votes, key]);
      emit({ kind: "update", post, fromThisTab: true });
      return true;
    },

    async myVotes() {
      const device = getDeviceId();
      return new Set(
        read<string[]>(VOTES_KEY, [])
          .filter((k) => k.endsWith(`:${device}`))
          .map((k) => k.slice(0, k.lastIndexOf(":")))
      );
    },

    async setHidden(postId, hidden) {
      await delay(80);
      const posts = all();
      const post = posts.find((x) => x.id === postId);
      if (!post) return;
      post.hidden = hidden;
      save(posts);
      emit({ kind: "update", post, fromThisTab: true });
    },

    async uploadPhoto(file) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("Couldn't read the photo."));
        r.readAsDataURL(file);
      });
    },

    async resolveTweet(url) {
      await delay(400);
      const id = url.match(/status(?:es)?\/(\d+)/)?.[1];
      // Mock mode only knows the demo tweets; anything else falls back to the embed.
      return (id && MOCK_TWEETS[id]) || null;
    },

    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

export function resetMockData() {
  try {
    localStorage.removeItem(POSTS_KEY);
    localStorage.removeItem(VOTES_KEY);
  } catch {}
}

/** Where data actually comes from in this build (shown in the non-production banner). */
export const DATA_SOURCE: "mock" | "supabase" = "mock";

let instance: Store | null = null;

export function getStore(): Store {
  // TODO(backend): return createSupabaseStore() when NEXT_PUBLIC_SUPABASE_URL is set.
  instance ??= createMockStore();
  return instance;
}
