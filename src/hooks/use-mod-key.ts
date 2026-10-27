"use client";

import { useHydrated } from "@/hooks/use-hydrated";

export function isMacPlatform() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** "⌘" on Apple platforms, "Ctrl+" elsewhere (stable during hydration). */
export function useModKey() {
  const hydrated = useHydrated();
  return hydrated && isMacPlatform() ? "⌘" : "Ctrl+";
}
