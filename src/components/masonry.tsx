"use client";

import { useEffect, useState } from "react";
import type { Post } from "@/lib/types";

// X embeds need ~250px to render, so phones get a single column below 480px.
function columnsFor(width: number): number {
  if (width < 480) return 1;
  if (width < 900) return 2;
  if (width < 1200) return 3;
  return 4;
}

function useColumnCount(): number {
  const [n, setN] = useState(2);
  useEffect(() => {
    const update = () => setN(columnsFor(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return n;
}

/** Rough height guess so columns stay balanced without measuring the DOM. */
function estimate(p: Post): number {
  const text = (p.body?.length ?? 0) / 2.2;
  switch (p.type) {
    case "post": {
      const t = (p.tweet?.text.length ?? p.body?.length ?? 0) / 2.2;
      if (p.source === "x" && !p.tweet) return 420;
      return 150 + t + (p.tweet?.photos.length ? 260 : 0);
    }
    case "met":
      return 260 + Math.min(text, 140) + (p.photos.length ? 280 : 0);
    case "note":
      return 140 + Math.min(text * 1.2, 260);
    default:
      return 120 + text;
  }
}

/**
 * Shortest-column-first layout: keeps reading order roughly left-to-right,
 * top-to-bottom (unlike CSS columns, which fill one column first).
 */
export function Masonry({ items, render, lead }: { items: Post[]; render: (p: Post) => React.ReactNode; lead?: React.ReactNode }) {
  const n = useColumnCount();
  const cols: Post[][] = Array.from({ length: n }, () => []);
  const heights = new Array(n).fill(0);
  if (lead) heights[0] += 110;
  for (const item of items) {
    const i = heights.indexOf(Math.min(...heights));
    cols[i].push(item);
    heights[i] += estimate(item) + 16;
  }
  return (
    <div className="flex items-start gap-4">
      {cols.map((col, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-4">
          {i === 0 && lead}
          {col.map((p) => (
            <div key={p.id}>{render(p)}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
