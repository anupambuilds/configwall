"use client";

import { useCallback, useEffect, useState } from "react";
import { getStore } from "./store";
import type { Post } from "./types";

/**
 * Live list of posts. Inserts from other clients are held in `pending` so the
 * wall can show a "N new posts" pill instead of shifting content under the reader.
 */
export function usePosts(opts?: { includeHidden?: boolean; holdRemote?: boolean }) {
  const includeHidden = !!opts?.includeHidden;
  const holdRemote = opts?.holdRemote ?? false;
  const [posts, setPosts] = useState<Post[]>([]);
  const [pending, setPending] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const store = getStore();
    let alive = true;

    store
      .listPosts({ includeHidden })
      .then((p) => alive && setPosts(p))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Couldn't load the wall."))
      .finally(() => alive && setLoading(false));

    const unsub = store.subscribe((e) => {
      if (e.kind === "delete") {
        setPosts((prev) => prev.filter((x) => x.id !== e.id));
        setPending((q) => q.filter((x) => x.id !== e.id));
        return;
      }
      if (e.kind === "insert") {
        if (holdRemote && !e.fromThisTab) setPending((q) => [e.post, ...q]);
        else setPosts((prev) => [e.post, ...prev.filter((x) => x.id !== e.post.id)]);
        return;
      }
      const visible = includeHidden || !e.post.hidden;
      const apply = (list: Post[]) => {
        const exists = list.some((x) => x.id === e.post.id);
        if (!visible) return list.filter((x) => x.id !== e.post.id);
        if (exists) return list.map((x) => (x.id === e.post.id ? e.post : x));
        // Unhidden post: put it back.
        return [e.post, ...list];
      };
      setPosts(apply);
      setPending((q) => (visible ? q.map((x) => (x.id === e.post.id ? e.post : x)) : q.filter((x) => x.id !== e.post.id)));
    });

    return () => {
      alive = false;
      unsub();
    };
  }, [includeHidden, holdRemote]);

  const flushPending = useCallback(() => {
    setPending((q) => {
      if (q.length) setPosts((prev) => [...q, ...prev.filter((p) => !q.some((n) => n.id === p.id))]);
      return [];
    });
  }, []);

  return { posts, pending, loading, error, flushPending };
}

export function useMyVotes() {
  const [votes, setVotes] = useState<Set<string>>(new Set());
  useEffect(() => {
    getStore().myVotes().then(setVotes);
  }, []);
  const add = useCallback((id: string) => setVotes((v) => new Set(v).add(id)), []);
  return { votes, add };
}
