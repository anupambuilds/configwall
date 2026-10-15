"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { APP_ENV } from "@/lib/config";
import { DATA_SOURCE } from "@/lib/store";
import type { PostKind, PostType } from "@/lib/types";
import { cx } from "@/lib/util";
import { AddPostSheet } from "./add-post-sheet";

interface ToastMsg {
  id: number;
  text: string;
  action?: { label: string; href: string };
}

interface Shell {
  openAdd: (type?: PostType, opts?: { talk?: string; kind?: PostKind }) => void;
  toast: (text: string, action?: ToastMsg["action"]) => void;
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

  const toast = useCallback<Shell["toast"]>((text, action) => {
    clearTimeout(timer.current);
    setToastMsg({ id: Date.now(), text, action });
    timer.current = setTimeout(() => setToastMsg(null), action ? 6000 : 2800);
  }, []);

  const openAdd = useCallback<Shell["openAdd"]>((type, opts) => setSheet({ type, talk: opts?.talk, kind: opts?.kind }), []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const isAdmin = pathname?.startsWith("/admin");
  // The feed has its own "Add" cards and People is for browsing; other pages get a nav button.
  const showNavAdd = !isAdmin && pathname !== "/" && !pathname?.startsWith("/people");
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href.replace(/\/$/, "")));

  return (
    <ShellContext.Provider value={{ openAdd, toast }}>
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
          <span className="hidden rounded-full border border-ink/15 px-2 py-0.5 sm:inline text-[10px] font-medium uppercase tracking-wider text-muted">
            Unofficial
          </span>
          <div className="ml-auto flex items-center gap-0.5 text-[13px] sm:gap-1 sm:text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cx(
                  "rounded-full px-2.5 py-1.5 transition-colors sm:px-3",
                  isActive(n.href) ? "bg-ink text-paper" : "text-muted hover:text-ink"
                )}
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
      </nav>

      <div className="flex flex-1 flex-col">{children}</div>

      {toastMsg && (
        <div
          key={toastMsg.id}
          role="status"
          className="animate-sheet-up fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-32px)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-paper shadow-xl"
        >
          <span className="flex-1">{toastMsg.text}</span>
          {toastMsg.action && (
            <Link
              href={toastMsg.action.href}
              onClick={() => setToastMsg(null)}
              className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink"
            >
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
          onPosted={() => {
            setSheet(null);
            toast("Post is being added to the wall");
            // Show the wall: go to the feed (or stay on it) and scroll to the top, where new posts appear.
            if (pathname !== "/") router.push("/");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </ShellContext.Provider>
  );
}
