// Live-update test: one client listens on the "wall" channel while another posts.
// Usage: node scripts/e2e-realtime.mjs <project-ref> <publishable-key>
import { createClient } from "@supabase/supabase-js";
const [ref, key] = process.argv.slice(2);
const URL = `https://${ref}.supabase.co`;
const sb = createClient(URL, key, { auth: { persistSession: false } });
const got = [];
const ch = sb.channel("wall").on("broadcast", { event: "post" }, (m) => got.push(m.payload)).on("broadcast", { event: "settings" }, (m) => got.push({ settings: m.payload }));
await new Promise((res) => ch.subscribe((s) => s === "SUBSCRIBED" && res()));
const t0 = Date.now();
const r = await fetch(`${URL}/functions/v1/create-post`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ device_id: "e2e-realtime-dev", post: { type: "post", source: "native", kind: "story", body: "e2e realtime check" } }) }).then((r) => r.json());
for (let i = 0; i < 40 && !got.some((g) => g.id === r.post?.id); i++) await new Promise((res) => setTimeout(res, 100));
const sig = got.find((g) => g.id === r.post?.id);
console.log(sig ? `PASS  live signal received in ${Date.now() - t0}ms: ${JSON.stringify(sig)}` : `FAIL  no signal (got ${JSON.stringify(got)})`);
const { data } = await sb.from("posts").select("id,body").eq("id", r.post?.id).single();
console.log(data ? "PASS  listener re-read the post from the database" : "FAIL  re-read");
await sb.removeChannel(ch);
process.exit(0);
