// UI QA: drives Microsoft Edge (playwright-core, channel "msedge") through the
// real user journeys against a running site + its database.
// Usage: node scripts/qa-ui.mjs [baseUrl]   (default http://localhost:3000)
// Test devices use ids starting with "e2e" so supabase/e2e-cleanup.sql removes their data.
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const ADMIN = readFileSync(new URL("../.env.supabase.local", import.meta.url), "utf8").match(/^ADMIN_SECRET=(.+)$/m)?.[1]?.trim();
const RUN = `e2e ${Date.now().toString(36)}`;
const results = [];
const consoleErrors = [];

async function step(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${detail ? `  — ${detail}` : ""}`);
  } catch (e) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  — ${String(e?.message ?? e).split("\n")[0].slice(0, 220)}`);
  }
}

function watch(page, label) {
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`[${label}] ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`[${label}] pageerror: ${String(e.message).slice(0, 200)}`));
}

async function device(browser, id, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  await ctx.addInitScript((d) => {
    try {
      if (!localStorage.getItem("cbw:device")) localStorage.setItem("cbw:device", d);
    } catch {}
  }, id);
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  watch(page, id);
  return { ctx, page };
}

const expectVisible = async (locator, what) => {
  await locator.first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {
    throw new Error(`not visible: ${what}`);
  });
};

// The first card on a tab, or the empty-state button when the wall has no posts yet.
const ADD_ENTRY = /Add to the wall|Add the first post|Share your X post|Add someone you met|Add notes from a talk/;

async function openAdd(page, section) {
  await page.getByRole("button", { name: ADD_ENTRY }).first().click();
  if (section) await page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${section}`) }).click();
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const A = await device(browser, "e2e-qa-a");
const B = await device(browser, "e2e-qa-b");
const pa = A.page;
const pb = B.page;

// ---------------------------------------------------------------- Wall basics
await step("wall loads with title, tabs, add card and footer", async () => {
  await pa.goto(`${BASE}/`);
  await expectVisible(pa.getByRole("heading", { name: /Figma Config BLR/ }), "heading");
  await expectVisible(pa.getByRole("tab", { name: /^All/ }), "All tab");
  await expectVisible(pa.getByRole("button", { name: ADD_ENTRY }), "add card or empty-state button");
  await expectVisible(pa.getByText("Built with Claude Code"), "footer");
  await expectVisible(pa.getByText(/Not affiliated with Figma/), "footer disclaimer");
});
await pb.goto(`${BASE}/`);

await step("add card opens the type picker (Post / Someone I met / Talk notes)", async () => {
  await openAdd(pa);
  const d = pa.getByRole("dialog");
  for (const s of ["Post", "Someone I met", "Talk notes"]) await expectVisible(d.getByRole("button", { name: new RegExp(`^${s}`) }), s);
  await pa.keyboard.press("Escape");
});

// ---------------------------------------------------------------- Wall post
const wallText = `${RUN} anonymous wall post from QA`;
await step("empty wall post shows an error", async () => {
  await openAdd(pa, "Post");
  await pa.getByRole("button", { name: "Write a post" }).click();
  await pa.getByRole("button", { name: "Post to the wall" }).click();
  await expectVisible(pa.getByRole("dialog").getByText(/Pick what kind of post|Write your post/), "validation error");
});
await step("anonymous wall post: toast, sheet closes, card appears", async () => {
  const d = pa.getByRole("dialog");
  await d.getByPlaceholder("What's happening at Config?").fill(wallText);
  await d.getByRole("button", { name: "Story", exact: true }).click();
  await d.getByRole("button", { name: "Post to the wall" }).click();
  await expectVisible(pa.getByRole("status").filter({ hasText: "Post is being added to the wall" }), "toast");
  await pa.getByRole("dialog").waitFor({ state: "detached" });
  await expectVisible(pa.locator("article", { hasText: wallText }), "new card");
});
await step("other browser sees it live as '1 new post' (no refresh)", async () => {
  const pill = pb.getByRole("button", { name: /new post/ });
  await expectVisible(pill, "new posts pill on browser B");
  await pill.click();
  await expectVisible(pb.locator("article", { hasText: wallText }), "card on B");
});
await step("own post doesn't show a '1 new post' pill for the poster", async () => {
  const n = await pa.getByRole("button", { name: /new post/ }).count();
  if (n) throw new Error("poster sees a new-post pill for their own post");
});

// ---------------------------------------------------------------- Upvote
await step("upvote counts once per device", async () => {
  const card = pb.locator("article", { hasText: wallText });
  await card.getByRole("button", { name: "Upvote" }).click();
  await expectVisible(card.getByRole("button", { name: "Upvoted" }).filter({ hasText: "1" }), "count 1");
  await card.getByRole("button", { name: "Upvoted" }).click();
  await pb.waitForTimeout(800);
  const t = await card.getByRole("button", { name: "Upvoted" }).innerText();
  if (t.trim() !== "1") throw new Error(`count is ${t}`);
});
await step("upvote reaches the other browser live", async () => {
  await expectVisible(pa.locator("article", { hasText: wallText }).getByRole("button", { name: /Upvote/ }).filter({ hasText: "1" }), "count 1 on A");
});

// ---------------------------------------------------------------- Delete (owner only)
await step("delete menu only on your own post", async () => {
  const onB = await pb.locator("article", { hasText: wallText }).getByRole("button", { name: "More options" }).count();
  if (onB) throw new Error("other device sees the ⋮ delete menu");
  await expectVisible(pa.locator("article", { hasText: wallText }).getByRole("button", { name: "More options" }), "⋮ on poster's device");
});
await step("poster deletes: confirm, toast, gone on both browsers", async () => {
  const card = pa.locator("article", { hasText: wallText });
  await card.getByRole("button", { name: "More options" }).click();
  await card.getByRole("menuitem", { name: /Delete post/ }).click();
  await card.getByRole("button", { name: "Delete", exact: true }).click();
  await expectVisible(pa.getByRole("status").filter({ hasText: "Post deleted" }), "toast");
  await pa.locator("article", { hasText: wallText }).waitFor({ state: "detached" });
  await pb.locator("article", { hasText: wallText }).waitFor({ state: "detached", timeout: 15000 });
});

// ---------------------------------------------------------------- X posts
const TWEET = "https://twitter.com/jack/status/20?s=20";
await step("X link: preview fetched, handle credited", async () => {
  await openAdd(pa, "Post");
  const d = pa.getByRole("dialog");
  await d.getByPlaceholder(/x\.com\/you\/status/).fill(TWEET);
  await expectVisible(d.getByText("just setting up my twttr"), "tweet preview");
  await expectVisible(d.getByText(/Credited to/).filter({ hasText: "@jack" }), "credited to @jack");
});
await step("X post saved and shown as an X-style card", async () => {
  const d = pa.getByRole("dialog");
  await d.getByRole("button", { name: "Quote", exact: true }).click();
  await d.getByRole("button", { name: "Post to the wall" }).click();
  await pa.getByRole("dialog").waitFor({ state: "detached" });
  await expectVisible(pa.locator("article", { hasText: "just setting up my twttr" }), "tweet card");
});
await step("same tweet again (different link form) is flagged as duplicate", async () => {
  await openAdd(pa, "Post");
  const d = pa.getByRole("dialog");
  await d.getByPlaceholder(/x\.com\/you\/status/).fill("https://x.com/jack/status/20/photo/1");
  await expectVisible(d.getByRole("alert").filter({ hasText: "Already on the wall" }), "duplicate flag");
  await pa.keyboard.press("Escape");
});
await step("LinkedIn post link → not supported + switch to writing", async () => {
  await openAdd(pa, "Post");
  const d = pa.getByRole("dialog");
  await d.getByPlaceholder(/x\.com\/you\/status/).fill("https://www.linkedin.com/posts/someone-activity-123");
  await expectVisible(d.getByText("LinkedIn posts aren't supported yet."), "LinkedIn notice");
  await d.getByRole("button", { name: "Write a post instead" }).click();
  await expectVisible(d.getByPlaceholder("What's happening at Config?"), "write mode");
  await pa.keyboard.press("Escape");
});

// ---------------------------------------------------------------- Met card
await step("met card: made-up X handle is rejected with a clear message", async () => {
  await openAdd(pa, "Someone I met");
  const d = pa.getByRole("dialog");
  await d.getByPlaceholder("Priya Sharma").fill("QA Person");
  await d.getByPlaceholder("theirhandle").fill("zq9xknotreal777");
  await d.getByPlaceholder(/The conversation/).fill(`${RUN} talked about QA`);
  await d.getByPlaceholder("yourhandle").fill("_anupambhowmick");
  await d.getByRole("button", { name: "Post to the wall" }).click();
  await expectVisible(d.getByText(/couldn't find @zq9xknotreal777/i), "handle not found error");
});
await step("met card with real handles appears with all fields", async () => {
  const d = pa.getByRole("dialog");
  await d.getByPlaceholder("theirhandle").fill("jack");
  await d.getByPlaceholder("Designation").fill("Product Designer").catch(async () => d.getByLabel("Designation").fill("Product Designer"));
  await d.getByRole("button", { name: "Post to the wall" }).click();
  await pa.getByRole("dialog").waitFor({ state: "detached" });
  const card = pa.locator("article", { hasText: `${RUN} talked about QA` });
  await expectVisible(card, "met card");
  await expectVisible(card.getByText("QA Person"), "their name");
  await expectVisible(card.getByText("@jack"), "their X chip");
});

// ---------------------------------------------------------------- Talk notes
await step("talk notes: needs a talk; card shows talk + speakers", async () => {
  await openAdd(pa, "Talk notes");
  const d = pa.getByRole("dialog");
  await d.getByPlaceholder(/What you jotted down/).fill(`${RUN} notes from QA`);
  await d.getByRole("button", { name: "Post to the wall" }).click();
  await expectVisible(d.getByText(/Pick the talk/), "talk required error");
  await d.getByRole("combobox").selectOption("Taking stupid seriously");
  await d.getByRole("button", { name: "Post to the wall" }).click();
  await pa.getByRole("dialog").waitFor({ state: "detached" });
  const card = pa.locator("article", { hasText: `${RUN} notes from QA` });
  await expectVisible(card.getByText("Taking stupid seriously"), "talk title");
  await expectVisible(card.getByText("Soren Iverson"), "speaker");
});

// ---------------------------------------------------------------- Tabs
await step("tabs filter: Posts / People we met / Talk notes + group by talk", async () => {
  await pa.getByRole("tab", { name: /^Talk notes/ }).click();
  await expectVisible(pa.getByRole("tab", { name: /^Talk notes/, selected: true }), "Talk notes selected");
  await expectVisible(pa.locator("article", { hasText: `${RUN} notes from QA` }), "note in Talk notes");
  await pa
    .locator("article", { hasText: `${RUN} talked about QA` })
    .waitFor({ state: "detached", timeout: 5000 })
    .catch(() => {
      throw new Error("met card leaked into Talk notes");
    });
  await pa.getByRole("button", { name: "Group by talk" }).click();
  await expectVisible(pa.getByRole("heading", { name: /Taking stupid seriously/ }), "talk group heading");
  await pa.getByRole("tab", { name: /^People we met/ }).click();
  await expectVisible(pa.locator("article", { hasText: `${RUN} talked about QA` }), "met card in People we met");
  await pa.getByRole("tab", { name: /^Posts/ }).click();
  await expectVisible(pa.locator("article", { hasText: "just setting up my twttr" }), "tweet in Posts");
  await pa.getByRole("tab", { name: /^All/ }).click();
});

// ---------------------------------------------------------------- Single post page
await step("single post page (/p/?id=) renders the post", async () => {
  const id = await pa.evaluate(async () => {
    const r = await fetch(document.querySelector("a[href*='/p/?id=']")?.getAttribute("href") ?? "", { method: "HEAD" }).catch(() => null);
    return r ? "ok" : null;
  });
  const link = await pa.evaluate(() => {
    const ids = JSON.parse(localStorage.getItem("cbw:mine") ?? "[]");
    return ids[ids.length - 1] ?? null;
  });
  if (!link) throw new Error("no own post id found");
  const p2 = await A.ctx.newPage();
  watch(p2, "single");
  await p2.goto(`${BASE}/p/?id=${link}`);
  await expectVisible(p2.locator("article"), "post on single page");
  await expectVisible(p2.getByText(/Featured on the Figma Config BLR Wall/), "featured line");
  await p2.close();
  return id ? undefined : undefined;
});

// ---------------------------------------------------------------- People + Config card
await step("people: list, search by name and @handle, person activity", async () => {
  await pa.goto(`${BASE}/people/`);
  const search = pa.getByLabel("Search people");
  await search.fill("@jack");
  await expectVisible(pa.getByRole("link", { name: /jack/i }), "jack in results");
  await search.fill("QA Person");
  await expectVisible(pa.getByRole("link", { name: /QA Person/ }), "QA Person in results");
  await search.fill("zzzz-nobody");
  await expectVisible(pa.getByText(/No one matches/), "empty search");
  await search.fill("_anupambhowmick");
  await pa.getByRole("link", { name: /_anupambhowmick/ }).first().click();
  await expectVisible(pa.getByRole("heading", { name: "Activity" }), "activity section");
  await expectVisible(pa.locator("article", { hasText: `${RUN} talked about QA` }), "their met card in activity");
});
await step("config card opens in the side panel and saves a PNG", async () => {
  await pa.getByRole("button", { name: "Config card" }).first().click();
  const panel = pa.getByRole("dialog", { name: /Config card/ });
  await expectVisible(panel, "card panel");
  const [dl] = await Promise.all([pa.waitForEvent("download", { timeout: 20000 }), panel.getByRole("button", { name: "Save image" }).click()]);
  if (!/\.png$/.test(dl.suggestedFilename())) throw new Error(`downloaded ${dl.suggestedFilename()}`);
  await pa.keyboard.press("Escape");
  return dl.suggestedFilename();
});

// ---------------------------------------------------------------- Admin
await step("admin: wrong secret refused", async () => {
  await pa.goto(`${BASE}/admin/`);
  await pa.waitForLoadState("networkidle");
  await pa.locator('input[type="password"]').fill("definitely-wrong");
  await pa.getByRole("button", { name: "Unlock" }).click();
  await expectVisible(pa.getByText("Wrong secret."), "wrong secret message");
});
await step("admin: correct secret unlocks admin mode (admin bar)", async () => {
  await pa.locator('input[type="password"]').fill(ADMIN);
  await pa.getByRole("button", { name: "Unlock" }).click();
  await expectVisible(pa.getByText("Admin mode is on"), "admin page");
  await expectVisible(pa.getByRole("switch", { name: "Read-only" }), "admin bar");
});
await step("admin: read-only pauses posting for others, live", async () => {
  await pa.goto(`${BASE}/`);
  await pa.getByRole("switch", { name: "Read-only" }).click();
  await expectVisible(pb.getByText("Posting is paused right now.", { exact: true }), "banner on B");
  await pb.getByRole("button", { name: ADD_ENTRY }).first().click();
  await expectVisible(pb.getByRole("status").filter({ hasText: /paused/ }), "paused toast on B");
  if (await pb.getByRole("dialog").count()) throw new Error("add sheet opened while read-only");
  await pa.getByRole("switch", { name: "Read-only" }).click();
  await pb.getByText("Posting is paused right now.", { exact: true }).waitFor({ state: "detached", timeout: 15000 });
});
await step("admin: delete anyone's post, then restore it via Show hidden", async () => {
  const card = pa.locator("article", { hasText: "just setting up my twttr" });
  await card.getByRole("button", { name: "More options" }).click();
  await card.getByRole("menuitem", { name: /Delete post/ }).click();
  await card.getByRole("button", { name: "Delete", exact: true }).click();
  await pb.locator("article", { hasText: "just setting up my twttr" }).waitFor({ state: "detached", timeout: 15000 });
  await pa.getByRole("switch", { name: "Show hidden" }).click();
  await expectVisible(pa.getByText("Hidden from the wall"), "hidden strip");
  await pa.getByRole("button", { name: "Unhide" }).first().click();
  await expectVisible(pa.getByRole("status").filter({ hasText: /restored/ }), "restored toast");
  await pa.getByRole("switch", { name: "Show hidden" }).click();
});
await step("admin: Lock leaves admin mode", async () => {
  await pa.getByRole("button", { name: "Lock" }).click();
  await pa.getByRole("switch", { name: "Read-only" }).waitFor({ state: "detached" });
});

// ---------------------------------------------------------------- Phone
const P = await device(browser, "e2e-qa-phone", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
for (const path of ["/", "/people/", "/admin/"]) {
  await step(`phone 390px: no sideways scrolling on ${path}`, async () => {
    await P.page.goto(`${BASE}${path}`);
    await P.page.waitForTimeout(1500);
    const { sw, cw } = await P.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    if (sw > cw + 1) throw new Error(`page is ${sw}px wide in a ${cw}px screen`);
  });
}
await step("phone: add sheet fits and is usable", async () => {
  await P.page.goto(`${BASE}/`);
  await openAdd(P.page, "Someone I met");
  const box = await P.page.getByRole("dialog").locator("div").nth(1).boundingBox();
  if (!box || box.width > 391) throw new Error(`sheet width ${box?.width}`);
  await expectVisible(P.page.getByRole("button", { name: "Post to the wall" }), "submit reachable");
});

await step("unknown page shows a 404", async () => {
  const r = await pa.goto(`${BASE}/definitely-not-a-page/`);
  if (r && r.status() !== 404) throw new Error(`status ${r.status()}`);
});

await browser.close();

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
const uniqErrors = [...new Set(consoleErrors)];
console.log(`Browser console errors: ${uniqErrors.length}`);
for (const e of uniqErrors.slice(0, 15)) console.log("  " + e);
process.exit(failed ? 1 : 0);
