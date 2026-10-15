"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { APP_ENV, BUILDER_HANDLE } from "@/lib/config";
import { clearAdminSecret, getAdminSecret, setAdminSecret } from "@/lib/identity";
import { DATA_SOURCE, getStore } from "@/lib/store";
import type { Post, PostKind, PostType } from "@/lib/types";
import { cx, formatCount } from "@/lib/util";
import { AddPostSheet } from "./add-post-sheet";

interface ToastMsg {
  id: number;
  text: string;
  action?: { label: string; href: string };
}

interface Shell {
  openAdd: (type?: PostType, opts?: { talk?: string; kind?: PostKind }) => void;
  toast: (text: string, action?: ToastMsg["action"]) => void;

  /** Admin mode: unlocked on this device with a verified admin secret. */
  isAdmin: boolean;
  /** Still checking a remembered admin secret. */
  adminChecking: boolean;
  unlockAdmin: (secret: string) => Promise<boolean>;
  lockAdmin: () => void;
  /** Admin: also show hidden/deleted posts on the wall (greyed, with Unhide). */
  showHidden: boolean;
  setShowHidden: (on: boolean) => void;

  /** Posting and deleting paused for everyone except admin. */
  readOnly: boolean;
  setReadOnly: (on: boolean) => Promise<void>;
}

const ShellContext = createContext<Shell | null>(null);

export function useShell(): Shell {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside <AppShell>");
  return ctx;
}

const NAV = [
  { href: "/", label: "Wall" },
  { href: "/people/", label: "People" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sheet, setSheet] = useState<{ type?: PostType; talk?: string; kind?: PostKind } | null>(null);
  const [toastMsg, setToastMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecking, setAdminChecking] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [readOnly, setReadOnlyState] = useState(false);

  const toast = useCallback<Shell["toast"]>((text, action) => {
    clearTimeout(timer.current);
    setToastMsg({ id: Date.now(), text, action });
    timer.current = setTimeout(() => setToastMsg(null), action ? 6000 : 2800);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Re-check a remembered admin secret; load settings and follow live changes.
  useEffect(() => {
    let alive = true;
    const store = getStore();
    const saved = getAdminSecret();
    (saved ? store.verifyAdmin(saved).catch(() => false) : Promise.resolve(false)).then((ok) => {
      if (!alive) return;
      if (!ok && saved) clearAdminSecret();
      setIsAdmin(ok);
      setAdminChecking(false);
    });
    store
      .getSettings()
      .then((s) => alive && setReadOnlyState(s.readOnly))
      .catch(() => {});
    const unsub = store.subscribe((e) => {
      if (e.kind === "settings") setReadOnlyState(e.settings.readOnly);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const unlockAdmin = useCallback(async (secret: string) => {
    const ok = await getStore()
      .verifyAdmin(secret)
      .catch(() => false);
    if (ok) {
      setAdminSecret(secret);
      setIsAdmin(true);
    }
    return ok;
  }, []);

  const lockAdmin = useCallback(() => {
    clearAdminSecret();
    setIsAdmin(false);
    setShowHidden(false);
  }, []);

  const setReadOnly = useCallback(
    async (on: boolean) => {
      await getStore().setReadOnly(on);
      setReadOnlyState(on);
      toast(on ? "Read-only: posting and deleting are paused for everyone" : "Posting is open again");
    },
    [toast]
  );

  const openAdd = useCallback<Shell["openAdd"]>(
    (type, opts) => {
      if (readOnly && !isAdmin) return toast("Posting is paused right now. Check back soon.");
      setSheet({ type, talk: opts?.talk, kind: opts?.kind });
    },
    [readOnly, isAdmin, toast]
  );

  const onAdminPage = pathname?.startsWith("/admin");
  // The feed has its own "Add" cards and People is for browsing; other pages get a nav button.
  const showNavAdd = !onAdminPage && pathname !== "/" && !pathname?.startsWith("/people");
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href.replace(/\/$/, "")));

  const shell: Shell = {
    openAdd,
    toast,
    isAdmin,
    adminChecking,
    unlockAdmin,
    lockAdmin,
    showHidden,
    setShowHidden,
    readOnly,
    setReadOnly,
  };

  return (
    <ShellContext.Provider value={shell}>
      {APP_ENV !== "production" && (
        <div className="bg-[#fde68a] px-4 py-1.5 text-center text-xs font-medium text-ink">
          {APP_ENV === "test" ? "Test environment: data here is for testing and may be wiped." : "Local development"}
          {DATA_SOURCE === "supabase" ? " · test database" : " · mock data in this browser"}
        </div>
      )}
      <nav className="sticky top-0 z-30 border-b border-line/80 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="shrink-0 font-serif text-lg leading-none tracking-tight sm:text-xl">
            Config BLR Wall
          </Link>
          <span className="hidden rounded-full border border-ink/15 px-2 py-0.5 text-[10px] font-medium tracking-wider text-muted uppercase sm:inline">
            Unofficial
          </span>
          <div className="ml-auto flex items-center gap-0.5 text-[13px] sm:gap-1 sm:text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cx("rounded-full px-2.5 py-1.5 transition-colors sm:px-3", isActive(n.href) ? "bg-ink text-paper" : "text-muted hover:text-ink")}
              >
                {n.label}
              </Link>
            ))}
            {showNavAdd && (
              <button
                onClick={() => openAdd()}
                aria-label="Add to the wall"
                className="ml-1 flex h-8 items-center gap-1 rounded-full bg-accent px-2.5 font-semibold text-accent-ink transition-transform hover:scale-[1.03] sm:px-3"
              >
                <span className="text-base leading-none">+</span>
                <span className="hidden sm:inline">Add</span>
              </button>
            )}
          </div>
        </div>
        {isAdmin && <AdminBar />}
      </nav>

      {readOnly && !isAdmin && (
        <div role="status" className="border-b border-line bg-card px-4 py-2 text-center text-sm text-muted">
          <span className="font-semibold text-ink">Posting is paused right now.</span> You can still browse and upvote.
        </div>
      )}

      <div className="flex flex-1 flex-col">{children}</div>
      {!onAdminPage && <SiteFooter />}

      {toastMsg && (
        <div
          key={toastMsg.id}
          role="status"
          className="animate-sheet-up fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-32px)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-paper shadow-xl"
        >
          <span className="flex-1">{toastMsg.text}</span>
          {toastMsg.action && (
            <Link href={toastMsg.action.href} onClick={() => setToastMsg(null)} className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink">
              {toastMsg.action.label}
            </Link>
          )}
        </div>
      )}

      {sheet && (
        <AddPostSheet
          initialType={sheet.type}
          initialTalk={sheet.talk}
          initialKind={sheet.kind}
          onClose={() => setSheet(null)}
          onPosted={(_post: Post, message?: string) => {
            setSheet(null);
            toast(message ?? "Post is being added to the wall");
            // Show the wall: go to the feed (or stay on it) and scroll to the top, where new posts appear.
            if (pathname !== "/") router.push("/");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </ShellContext.Provider>
  );
}

/** Dark strip under the nav while admin mode is on. */
function AdminBar() {
  const { showHidden, setShowHidden, readOnly, setReadOnly, lockAdmin, toast } = useShell();
  const [busy, setBusy] = useState(false);
  return (
    <div className="bg-ink text-paper">
      <div className="no-scrollbar mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 py-2 text-[13px]">
        <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-[11px] font-bold tracking-wide text-ink uppercase">Admin</span>
        <Toggle label="Show hidden" on={showHidden} onChange={setShowHidden} />
        <Toggle
          label="Read-only"
          on={readOnly}
          disabled={busy}
          onChange={async (on) => {
            setBusy(true);
            await setReadOnly(on).catch(() => toast("Couldn't change read-only mode."));
            setBusy(false);
          }}
        />
        <button onClick={lockAdmin} className="ml-auto shrink-0 rounded-full border border-paper/30 px-3 py-1 font-semibold hover:bg-paper/10">
          Lock
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, on, onChange, disabled }: { label: string; on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex shrink-0 items-center gap-2 rounded-full px-2 py-1 hover:bg-paper/10 disabled:opacity-50"
    >
      <span className={cx("relative h-4 w-7 rounded-full transition-colors", on ? "bg-live" : "bg-paper/30")}>
        <span className={cx("absolute top-0.5 size-3 rounded-full bg-paper transition-transform", on ? "translate-x-3.5" : "translate-x-0.5")} />
      </span>
      {label}
    </button>
  );
}

function SiteFooter() {
  const [visitors, setVisitors] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    getStore()
      .recordVisit()
      .then((n) => alive && setVisitors(n))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return (
    <footer className="border-t border-line px-4 py-6 text-center text-sm text-muted">
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span>
          <span className="font-semibold text-ink tabular-nums">{visitors === null ? "…" : formatCount(visitors)}</span> visitors
        </span>
        <span aria-hidden>·</span>
        <a href={`https://x.com/${BUILDER_HANDLE}`} target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">
          @{BUILDER_HANDLE}
        </a>
        <span aria-hidden>·</span>
        <a href="https://claude.com/claude-code" target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">
          Built with Claude Code
        </a>
      </p>
      <p className="mt-1 text-xs">Unofficial community project. Not affiliated with Figma.</p>
    </footer>
  );
}
