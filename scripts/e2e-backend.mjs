// End-to-end backend test against a Supabase project, acting like browsers.
// Usage: node scripts/e2e-backend.mjs <project-ref> <publishable-key>
// Reads ADMIN_SECRET from .env.supabase.local (never printed). Cleans up after itself.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const [ref, key] = process.argv.slice(2);
if (!ref || !key) throw new Error("usage: node scripts/e2e-backend.mjs <ref> <publishable-key>");
const URL = `https://${ref}.supabase.co`;
const ADMIN = readFileSync(new globalThis.URL("../.env.supabase.local", import.meta.url), "utf8").match(/^ADMIN_SECRET=(.+)$/m)?.[1]?.trim();
const sb = createClient(URL, key, { auth: { persistSession: false } });

const run = `e2e${Date.now().toString(36)}`;
const devA = `${run}-device-a`;
const devB = `${run}-device-b`;
const created = [];
let pass = 0;
let failCount = 0;

async function fn(name, body) {
  const r = await fetch(`${URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}

function check(name, ok, detail = "") {
  if (ok) pass++;
  else failCount++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const native = (extra = {}) => ({ type: "post", source: "native", kind: "story", body: `e2e ${run} wall post`, ...extra });

// --- Tweets ---------------------------------------------------------------
let r = await fn("resolve-tweet", { url: "https://twitter.com/jack/status/20?s=20" });
check("resolve real tweet", r.tweet?.author_handle === "jack" && r.tweet?.text?.includes("twttr"), r.tweet?.text);
r = await fn("resolve-tweet", { url: "https://x.com/jack/status/1" });
check("resolve missing tweet → not available", r.status === 404 && r.error?.code === "tweet_unavailable", r.error?.message);

// --- Create --------------------------------------------------------------
r = await fn("create-post", { device_id: devA, idempotency_key: `${run}-1`, post: native() });
check("anonymous wall post", r.status === 200 && r.post?.id && r.post.author_handle === null, r.error?.message);
if (r.post) created.push(r.post.id);
const anonId = r.post?.id;

r = await fn("create-post", { device_id: devA, idempotency_key: `${run}-1`, post: native() });
check("double submit (same key) → same post", r.post?.id === anonId);

r = await fn("create-post", { device_id: devA, post: native({ author_handle: "zq9xknotreal777" }) });
check("made-up X handle rejected", r.status === 400 && r.error?.code === "handle_not_found" && r.error?.field === "author_handle", r.error?.message);

r = await fn("create-post", { device_id: devA, post: native({ author_handle: "_anupambhowmick" }) });
check("real X handle accepted", r.status === 200 && r.post?.author_handle === "_anupambhowmick", r.error?.message);
if (r.post) created.push(r.post.id);

r = await fn("create-post", { device_id: devA, post: { type: "post", source: "x", kind: "quote", link_url: "https://www.linkedin.com/posts/someone-123" } });
check("LinkedIn post link → not supported message", r.status === 400 && /LinkedIn/.test(r.error?.message), r.error?.message);

r = await fn("create-post", { device_id: devA, post: { type: "post", source: "x", kind: "quote", link_url: "https://twitter.com/jack/status/20?s=20" } });
check("X post: saved with server-fetched snapshot", r.status === 200 && r.post?.tweet?.author_handle === "jack" && r.post.author_handle === "jack" && r.post.link_url === "https://x.com/jack/status/20", r.error?.message);
const tweetPostId = r.post?.id;
if (tweetPostId) created.push(tweetPostId);

r = await fn("create-post", { device_id: devB, post: { type: "post", source: "x", kind: "story", link_url: "https://x.com/jack/status/20/photo/1" } });
check("same tweet again → duplicate with existing post", r.status === 409 && r.error?.code === "duplicate" && r.error?.existing?.id === tweetPostId, r.error?.message);

r = await fn("create-post", { device_id: devA, post: { type: "met", author_handle: "_anupambhowmick", met_name: "Test Person" } });
check("met card without conversation rejected", r.status === 400 && r.error?.field === "body", r.error?.message);

r = await fn("create-post", { device_id: devA, post: { type: "met", met_name: "Test Person", body: "hi" } });
check("met card requires your handle", r.status === 400 && r.error?.field === "author_handle", r.error?.message);

r = await fn("create-post", { device_id: devA, post: { type: "met", author_handle: "_anupambhowmick", met_handle: "_anupambhowmick", body: "hi" } });
check("can't meet yourself", r.status === 400 && r.error?.field === "met_handle", r.error?.message);

r = await fn("create-post", { device_id: devA, post: { type: "met", author_handle: "_anupambhowmick", met_name: "P", body: "hi", photos: ["https://evil.example.com/a.jpg"] } });
check("photos from outside our storage rejected", r.status === 400 && r.error?.field === "photos", r.error?.message);

// Photo upload via signed URL, then a met card using it.
r = await fn("upload-url", { device_id: devA, content_type: "image/jpeg" });
let photoOk = false;
if (r.path && r.token) {
  const jpeg = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex");
  const up = await sb.storage.from("photos").uploadToSignedUrl(r.path, r.token, new Blob([jpeg], { type: "image/jpeg" }), { contentType: "image/jpeg" });
  photoOk = !up.error;
  const met = await fn("create-post", { device_id: devA, post: { type: "met", author_handle: "_anupambhowmick", met_name: "Photo Person", met_role: "Designer", met_company: "Acme", body: "Talked about tokens", photos: [r.public_url] } });
  check("met card with uploaded photo", met.status === 200 && met.post?.photos?.[0] === r.public_url, met.error?.message);
  if (met.post) created.push(met.post.id);
  const head = await fetch(r.public_url);
  check("uploaded photo is publicly viewable", head.ok, `HTTP ${head.status}`);
}
check("signed photo upload", photoOk, r.error?.message);

r = await fn("create-post", { device_id: devA, post: { type: "note", body: "notes" } });
check("talk notes require a talk", r.status === 400 && r.error?.field === "talk", r.error?.message);

// --- Public reads -----------------------------------------------------------
const { data: visible } = await sb.from("posts").select("id").in("id", created);
check("public can read created posts", (visible?.length ?? 0) === created.length, `${visible?.length}/${created.length}`);
const { error: privErr } = await sb.from("posts").select("device_id").limit(1);
check("public cannot read device ids", !!privErr);
const { error: insErr } = await sb.from("posts").insert({ type: "post", source: "native", kind: "story", body: "sneaky" });
check("public cannot insert directly", !!insErr);

// --- Upvotes ------------------------------------------------------------------
const v1 = await sb.rpc("upvote", { p_post_id: anonId, p_device_id: devB });
const v2 = await sb.rpc("upvote", { p_post_id: anonId, p_device_id: devB });
check("one upvote per device", v1.data === true && v2.data === false);

// --- Delete -------------------------------------------------------------------
r = await fn("delete-post", { device_id: devB, id: anonId });
check("another device can't delete", r.status === 403 && r.error?.code === "not_owner", r.error?.message);
r = await fn("delete-post", { device_id: devA, id: anonId });
check("poster can delete", r.status === 200 && r.ok);
const { data: gone } = await sb.from("posts").select("id").eq("id", anonId);
check("deleted post disappears for the public", (gone?.length ?? 1) === 0);

r = await fn("delete-post", { device_id: devA, id: tweetPostId });
r = await fn("create-post", { device_id: devB, post: { type: "post", source: "x", kind: "takeaway", link_url: "https://x.com/jack/status/20" } });
check("re-sharing a deleted tweet restores the original", r.status === 200 && r.post?.id === tweetPostId && r.restored === true && r.post.kind === "takeaway", r.error?.message);

// --- Admin --------------------------------------------------------------------
r = await fn("admin", { action: "verify", admin_secret: "wrong-secret" });
check("wrong admin secret refused", r.ok === false);
r = await fn("admin", { action: "set_read_only", on: true, admin_secret: "wrong-secret" });
check("admin action without secret refused", r.status === 401);
r = await fn("admin", { action: "verify", admin_secret: ADMIN });
check("admin secret accepted", r.ok === true);

r = await fn("admin", { action: "set_read_only", on: true, admin_secret: ADMIN });
const { data: s1 } = await sb.from("settings").select("read_only").single();
r = await fn("create-post", { device_id: devA, post: native() });
check("read-only blocks visitors from posting", s1?.read_only === true && r.status === 423 && r.error?.code === "read_only", r.error?.message);
r = await fn("create-post", { device_id: devA, admin_secret: ADMIN, post: native({ body: `e2e ${run} admin while read-only` }) });
check("admin can still post in read-only", r.status === 200, r.error?.message);
if (r.post) created.push(r.post.id);
await fn("admin", { action: "set_read_only", on: false, admin_secret: ADMIN });
const { data: s2 } = await sb.from("settings").select("read_only").single();
check("read-only switched off again", s2?.read_only === false);

r = await fn("admin", { action: "set_hidden", id: created[1], hidden: true, admin_secret: ADMIN });
check("admin hides any post", r.post?.hidden === true);
r = await fn("admin", { action: "list_hidden", admin_secret: ADMIN });
check("admin can list hidden posts", (r.posts ?? []).some((p) => p.id === created[1]));
r = await fn("admin", { action: "set_hidden", id: created[1], hidden: false, admin_secret: ADMIN });
check("admin restores a post", r.post?.hidden === false);

// --- Visitors -----------------------------------------------------------------
const c1 = await sb.rpc("record_visit", { p_device_id: devA });
const c2 = await sb.rpc("record_visit", { p_device_id: devA });
check("visitor counted once per device", typeof c1.data === "number" && c1.data === c2.data);

console.log(`\n${pass} passed, ${failCount} failed`);
console.log(`CLEANUP_IDS=${created.join(",")}`);
console.log(`CLEANUP_RUN=${run}`);
process.exit(failCount ? 1 : 0);
