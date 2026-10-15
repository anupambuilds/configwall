import type { Post } from "./types";

export interface Person {
  /** Stable id: "x:handle", "li:slug" or "n:name". */
  key: string;
  handle: string | null;
  name: string | null;
  role: string | null;
  company: string | null;
  linkedin: string | null;
  posts: number;
  /** Keys of distinct people linked by a "met" post in either direction. */
  connections: Set<string>;
  upvotes: number;
  /** Latest activity involving them (ISO), for "recently active" ordering. */
  lastActive: string;
}

function linkedinSlug(url: string): string | null {
  return url.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1]?.toLowerCase() ?? null;
}

/**
 * Who a "met" post points at. X handle wins; otherwise LinkedIn; otherwise the
 * typed name. The same person added by name and later by handle can't be
 * merged automatically — that's the price of not requiring X.
 */
export function metKey(p: Pick<Post, "met_handle" | "met_linkedin" | "met_name">): string | null {
  if (p.met_handle) return `x:${p.met_handle}`;
  const slug = p.met_linkedin ? linkedinSlug(p.met_linkedin) : null;
  if (slug) return `li:${slug}`;
  const name = p.met_name?.trim().toLowerCase().replace(/\s+/g, " ");
  return name ? `n:${name}` : null;
}

export function personLabel(p: Pick<Person, "handle" | "name">): string {
  return p.handle ? `@${p.handle}` : p.name ?? "Someone";
}

export function derivePeople(posts: Post[]): Person[] {
  const map = new Map<string, Person>();
  const get = (key: string) => {
    let p = map.get(key);
    if (!p) {
      p = { key, handle: key.startsWith("x:") ? key.slice(2) : null, name: null, role: null, company: null, linkedin: null, posts: 0, connections: new Set(), upvotes: 0, lastActive: "" };
      map.set(key, p);
    }
    return p;
  };

  for (const post of posts) {
    if (post.hidden) continue;
    const a = post.author_handle ? `x:${post.author_handle}` : null;
    if (a) {
      const p = get(a);
      p.posts += 1;
      p.upvotes += post.upvotes;
      if (post.created_at > p.lastActive) p.lastActive = post.created_at;
    }
    if (post.type !== "met") continue;
    const b = metKey(post);
    if (!b) continue;
    const met = get(b);
    if (post.created_at > met.lastActive) met.lastActive = post.created_at;
    met.name ??= post.met_name?.trim() || null;
    met.role ??= post.met_role?.trim() || null;
    met.company ??= post.met_company?.trim() || null;
    met.linkedin ??= post.met_linkedin;
    if (a && a !== b) {
      get(a).connections.add(b);
      met.connections.add(a);
    }
  }

  return [...map.values()].sort(
    (x, y) => y.connections.size - x.connections.size || y.posts - x.posts || x.key.localeCompare(y.key)
  );
}

export interface MetEntry {
  key: string;
  handle: string | null;
  name: string | null;
  role: string | null;
  company: string | null;
  linkedin: string | null;
  note: string | null;
  at: string;
}

/** People `me` personally logged meeting (their own "met" posts), deduped. */
export function peopleIMet(posts: Post[], me: string): MetEntry[] {
  const seen = new Set<string>();
  const out: MetEntry[] = [];
  for (const p of posts) {
    if (p.type !== "met" || p.author_handle !== me || p.hidden) continue;
    const key = metKey(p);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, handle: p.met_handle, name: p.met_name, role: p.met_role, company: p.met_company, linkedin: p.met_linkedin, note: p.body, at: p.created_at });
  }
  return out;
}
