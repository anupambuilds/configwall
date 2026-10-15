"use client";

import { useSyncExternalStore } from "react";
import { normalizeHandle } from "./util";

const HANDLE_KEY = "cbw:handle";
const DEVICE_KEY = "cbw:device";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function getMyHandle(): string | null {
  return normalizeHandle(safeGet(HANDLE_KEY));
}

export function setMyHandle(handle: string | null) {
  if (!handle) return;
  safeSet(HANDLE_KEY, handle);
  window.dispatchEvent(new Event(HANDLE_EVENT));
}

export function getDeviceId(): string {
  let id = safeGet(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    safeSet(DEVICE_KEY, id);
  }
  return id;
}

const HANDLE_EVENT = "cbw:handle-change";


function subscribeHandle(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(HANDLE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(HANDLE_EVENT, cb);
  };
}

/** The handle saved on this device; null during prerender and until set. */
export function useMyHandle(): string | null {
  return useSyncExternalStore(subscribeHandle, getMyHandle, () => null);
}

// ---------------------------------------------------------------------------
// Posts created on this device. With no logins, "the person who posted" =
// "the device they posted from". Only those posts show Delete; the server
// re-checks the device id against the post's private device_id.
// ---------------------------------------------------------------------------
export const MINE_KEY = "cbw:mine";
const MINE_EVENT = "cbw:mine-change";
let mineCache: { raw: string | null; ids: Set<string> } = { raw: null, ids: new Set() };

export function readMyPostIds(): Set<string> {
  const raw = safeGet(MINE_KEY);
  if (raw !== mineCache.raw) {
    let ids: string[] = [];
    try {
      ids = raw ? (JSON.parse(raw) as string[]) : [];
    } catch {}
    mineCache = { raw, ids: new Set(ids) };
  }
  return mineCache.ids;
}

function writeMine(ids: Set<string>) {
  safeSet(MINE_KEY, JSON.stringify([...ids]));
  window.dispatchEvent(new Event(MINE_EVENT));
}

export function rememberMyPost(id: string) {
  writeMine(new Set(readMyPostIds()).add(id));
}

export function forgetMyPost(id: string) {
  const next = new Set(readMyPostIds());
  next.delete(id);
  writeMine(next);
}

function subscribeMine(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(MINE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(MINE_EVENT, cb);
  };
}

const NO_POSTS = new Set<string>();

/** Ids of posts created on this device (empty during prerender). */
export function useMyPostIds(): Set<string> {
  return useSyncExternalStore(subscribeMine, readMyPostIds, () => NO_POSTS);
}

// ---------------------------------------------------------------------------
// Admin secret, entered once per device on /admin and sent with every admin
// action (the server checks it each time). "Lock" forgets it.
// ---------------------------------------------------------------------------
const ADMIN_SECRET_KEY = "cbw:admin-secret";

export function getAdminSecret(): string | null {
  return safeGet(ADMIN_SECRET_KEY);
}

export function setAdminSecret(secret: string) {
  safeSet(ADMIN_SECRET_KEY, secret);
}

export function clearAdminSecret() {
  try {
    localStorage.removeItem(ADMIN_SECRET_KEY);
  } catch {}
}

const noopSubscribe = () => () => {};

/** False during prerender/hydration, true once running in the browser. */
export function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
