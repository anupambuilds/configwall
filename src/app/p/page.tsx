"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PostCard } from "@/components/post-card";
import { getStore } from "@/lib/store";
import type { Post } from "@/lib/types";
import { useMyVotes } from "@/lib/use-posts";

function SinglePost() {
  const id = useSearchParams().get("id");
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const { votes, add } = useMyVotes();

  useEffect(() => {
    if (!id) return;
    const store = getStore();
    store.getPost(id).then(setPost);
    return store.subscribe((e) => {
      if (e.kind === "settings") return;
      if (e.kind === "delete") {
        if (e.id === id) setPost(null);
      } else if (e.post.id === id) setPost(e.post.hidden ? null : e.post);
    });
  }, [id]);

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-10 pb-16">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← The whole wall
      </Link>
      <div className="mt-5">
        {id && post === undefined ? (
          <div className="h-56 animate-pulse rounded-2xl border border-line bg-card" />
        ) : !post ? (
          <p className="font-serif text-3xl">This post isn&apos;t on the wall (anymore).</p>
        ) : (
          <>
            <PostCard post={post} voted={votes.has(post.id)} onVoted={add} />
            <p className="mt-4 text-center text-sm text-muted">Featured on the Config BLR Wall, an unofficial community recap.</p>
          </>
        )}
      </div>
    </main>
  );
}

export default function PostPage() {
  return (
    <Suspense fallback={null}>
      <SinglePost />
    </Suspense>
  );
}
