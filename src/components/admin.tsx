"use client";

import Link from "next/link";
import { useState } from "react";
import { DATA_SOURCE, resetMockData } from "@/lib/store";
import { useShell } from "./app-shell";

const box = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] outline-none focus:border-ink";

/**
 * /admin only unlocks admin mode. Everything admin does happens on the wall:
 * delete any post, show + restore hidden posts, add several X links at once,
 * add talk notes credited to anyone, and the read-only switch.
 */
export function Admin() {
  const { isAdmin, adminChecking, lockAdmin } = useShell();
  if (adminChecking) return <main className="flex-1" aria-busy />;
  if (!isAdmin) return <AdminLogin />;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <h1 className="font-serif text-4xl tracking-[-0.02em]">Admin mode is on</h1>
      <p className="mt-2 text-muted">Use the dark admin bar on any page. On the wall you can:</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
        <li>
          Delete <span className="text-ink">any</span> post from its ⋮ menu
        </li>
        <li>
          Turn on <span className="text-ink">Show hidden</span> to see deleted posts and <span className="text-ink">Unhide</span> them
        </li>
        <li>Paste several X links at once in the Post form</li>
        <li>Add talk notes credited to any X handle</li>
        <li>
          Switch on <span className="text-ink">Read-only</span> to pause posting and deleting for everyone
        </li>
      </ul>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/" className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper">
          Go to the wall
        </Link>
        <button onClick={lockAdmin} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:bg-ink/5">
          Lock
        </button>
        {DATA_SOURCE === "mock" && (
          <button
            onClick={() => {
              if (window.confirm("Reset all local mock data to the demo seed?")) {
                resetMockData();
                location.reload();
              }
            }}
            className="rounded-full px-3 py-2.5 text-xs text-muted hover:text-ink"
          >
            Reset mock data
          </button>
        )}
      </div>
    </main>
  );
}

function AdminLogin() {
  const { unlockAdmin } = useShell();
  const [secret, setSecret] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "wrong">("idle");

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    const s = secret.trim();
    if (!s || state === "checking") return;
    setState("checking");
    const ok = await unlockAdmin(s);
    if (!ok) setState("wrong");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="font-serif text-4xl tracking-[-0.02em]">Admin</h1>
      <p className="mt-1 text-sm text-muted">Paste your admin secret. This device will remember it until you lock.</p>
      <form onSubmit={unlock} className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Admin secret</span>
          <input
            type="password"
            value={secret}
            onChange={(e) => {
              setSecret(e.target.value);
              if (state === "wrong") setState("idle");
            }}
            autoComplete="current-password"
            autoFocus
            className={box}
          />
        </label>
        {state === "wrong" && <p className="text-sm text-danger">Wrong secret.</p>}
        <button disabled={!secret.trim() || state === "checking"} className="rounded-full bg-ink py-3 font-semibold text-paper disabled:opacity-50">
          {state === "checking" ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
