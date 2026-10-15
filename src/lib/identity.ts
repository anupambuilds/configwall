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

const noopSubscribe = () => () => {};

/** False during prerender/hydration, true once running in the browser. */
export function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
