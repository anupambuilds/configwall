import { EMPTY_POST, type Post, type TweetSnapshot } from "./types";

// LOCAL MOCK DATA ONLY. Every handle is a fake `demo_` handle, every name is
// made up, and every link points nowhere. Never ship this as real content —
// real seeds come from the admin page with credited, real posts.

const ago = (mins: number, now = Date.now()) => new Date(now - mins * 60_000).toISOString();

function tweet(id: string, handle: string, name: string, text: string, mins: number, photos: string[] = []): TweetSnapshot {
  return {
    id,
    url: `https://x.com/${handle}/status/${id}`,
    text,
    author_name: name,
    author_handle: handle,
    author_avatar: null,
    created_at: ago(mins + 2),
    photos,
    mentions: [...text.matchAll(/@([A-Za-z0-9_]{1,15})/g)].map((m) => m[1].toLowerCase()),
  };
}

const pic = (seed: string, w = 1200, h = 800) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

/** Demo tweets the mock `resolveTweet` knows about. Paste one of these URLs to test. */
export const MOCK_TWEETS: Record<string, TweetSnapshot> = Object.fromEntries(
  [
    tweet("1000000000000000001", "demo_rahul", "Rahul (demo)", "Main hall right before the opening keynote. Packed, loud, and very Bangalore. #ConfigBLR", 5, [pic("cbw-hall")]),
    tweet("1000000000000000002", "demo_meera", "Meera (demo)", "“Taste is just a lot of decisions you’ve learned not to regret.” Best line of the morning so far. #ConfigBLR", 8),
    tweet("1000000000000000003", "demo_priya", "Priya (demo)", "Accessibility talk reminder: there’s no such thing as “mostly accessible”. If contrast fails, the design fails. cc @demo_sana", 35),
    tweet("1000000000000000004", "demo_ananya", "Ananya (demo)", "Hallway track > main track (sometimes). With @demo_rahul and @demo_vikram after the systems talk.", 58, [pic("cbw-hallway-1", 900, 900), pic("cbw-hallway-2", 900, 900)]),
    tweet("1000000000000000005", "demo_sana", "Sana (demo)", "Came alone, leaving with nine new people to follow and a notebook full of sketches. First design conference ever and I already want the next one.", 64),
    tweet("1000000000000000006", "demo_karthik", "Karthik (demo)", "Honest review: talks were short and sharp, hallway time was generous. The lunch queue was 40 minutes though. 8/10 would go again. #ConfigBLR", 41),
  ].map((t) => [t.id, t])
);

type Seed = Partial<Post> & Pick<Post, "type"> & { mins: number };

const t = (id: string) => MOCK_TWEETS[id];

const seeds: Seed[] = [
  { mins: 3, type: "note", talk: "The work has to leave the file", body: "Design systems aren't a library, they're an agreement. The components are just the receipt.\n\nThree things to try on Monday:\n1. Write the contribution guide before the next component.\n2. Version tokens separately from components.\n3. Office hours > Slack threads.", author_handle: "demo_ananya", upvotes: 8 },
  { mins: 5, type: "post", source: "x", kind: "photo", link_url: t("1000000000000000001").url, tweet: t("1000000000000000001"), author_handle: "demo_rahul" },
  { mins: 8, type: "post", source: "x", kind: "quote", link_url: t("1000000000000000002").url, tweet: t("1000000000000000002"), author_handle: "demo_meera", upvotes: 14 },
  { mins: 11, type: "met", met_name: "Rahul", met_role: "Product Designer", met_company: "Demo Fintech", met_handle: "demo_rahul", met_linkedin: "https://www.linkedin.com/in/demo-rahul", body: "Talked about tokens in multi-brand apps and why naming is 80% of the work. He showed me their token audit spreadsheet — stealing that format.", photos: [pic("cbw-met-1", 1000, 750), pic("cbw-met-2", 900, 900), pic("cbw-met-3", 900, 900)], author_handle: "demo_ananya", upvotes: 6 },
  { mins: 14, type: "post", source: "native", kind: "story", body: "Asked a question in the AI session, got a follow-up chat at lunch with @demo_meera, now we're planning a meetup in Koramangala next month.", tagged: ["demo_meera"], author_handle: "demo_vikram" },
  { mins: 21, type: "note", talk: "Figma deep dive: Design together with code on the canvas", body: "Prototype the boring states first: empty, loading, error. That's where trust is won.\n- Speaker showed a checklist of 12 states per screen\n- \"If you didn't design the error, the engineer did\"", author_handle: "demo_vikram", upvotes: 12 },
  { mins: 24, type: "met", met_name: "Divya", met_role: "Design Lead", met_company: "Demo Health", met_linkedin: "https://www.linkedin.com/in/demo-divya", body: "She runs crits for a fully remote team across three time zones. Felt way less alone about the same problems. Swapped crit templates.", photos: [pic("cbw-met-4", 1000, 750)], author_handle: "demo_priya", upvotes: 4 },
  { mins: 28, type: "post", source: "native", kind: "takeaway", body: "AI doesn't remove the need for judgement. It just makes the lack of it visible faster.", author_handle: "demo_meera", upvotes: 21 },
  { mins: 32, type: "note", talk: "Designing for intelligent work: inside Microsoft Copilot's new chapter", body: "- Use AI for breadth (50 variations), humans for depth (picking 1)\n- Prompting is a design skill: constraints in, options out\n- Their team logs every AI-assisted decision for review", author_handle: "demo_meera", upvotes: 5 },
  { mins: 35, type: "post", source: "x", kind: "takeaway", link_url: t("1000000000000000003").url, tweet: t("1000000000000000003"), author_handle: "demo_priya", upvotes: 9 },
  { mins: 41, type: "post", source: "x", kind: "review", link_url: t("1000000000000000006").url, tweet: t("1000000000000000006"), author_handle: "demo_karthik", upvotes: 6 },
  { mins: 46, type: "post", source: "native", kind: "takeaway", body: "The best design teams I met today write more than they draw. Docs are design too.", author_handle: "demo_karthik", upvotes: 7 },
  { mins: 52, type: "met", met_name: "Sana", met_role: "UX Researcher", met_company: "Demo Labs", met_handle: "demo_sana", body: "Met at the coffee line. Same bootcamp, five years apart. Talked about breaking into research from visual design.", author_handle: "demo_priya" },
  { mins: 58, type: "post", source: "x", kind: "photo", link_url: t("1000000000000000004").url, tweet: t("1000000000000000004"), author_handle: "demo_ananya", upvotes: 15 },
  { mins: 64, type: "post", source: "x", kind: "story", link_url: t("1000000000000000005").url, tweet: t("1000000000000000005"), author_handle: "demo_sana", upvotes: 18 },
  { mins: 70, type: "note", talk: "The work has to leave the file", body: "Ship the variable, not the hex code. Future-you will rebrand.", author_handle: "demo_rahul", upvotes: 3 },
  { mins: 74, type: "note", talk: "Figma product keynote", body: "- Craft is the sum of decisions nobody asked you to make\n- India has the fastest-growing designer community; mentoring is the bottleneck\n- Closing line: \"Make the thing you wish existed\"", author_handle: "demo_arjun" },
  { mins: 77, type: "met", met_name: "Ananya", met_role: "Senior Designer", met_company: "Demo Commerce", met_handle: "demo_ananya", body: "Talked about mentoring juniors without becoming a bottleneck. Her rule: review the thinking, not the pixels.", author_handle: "demo_arjun" },
  { mins: 85, type: "post", source: "native", kind: "review", body: "Great energy, great people. Audio in the second hall kept cutting out — hope that's fixed next year.", author_handle: "demo_vikram" },
  { mins: 90, type: "note", talk: "Better together: from handoff to handshake", body: "There is no \"mostly accessible\". Contrast first, then focus order, then screen-reader labels — in that order of payoff.", author_handle: "demo_priya", upvotes: 2 },
];

export function buildMockSeed(now = Date.now()): Post[] {
  return seeds.map(({ mins, ...s }, i) => ({
    ...EMPTY_POST,
    id: `seed-${String(i + 1).padStart(3, "0")}`,
    upvotes: 0,
    hidden: false,
    is_seed: true,
    ...s,
    created_at: ago(mins, now),
  }));
}
