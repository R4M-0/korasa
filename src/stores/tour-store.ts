"use client";

import { create } from "zustand";
import { useUiStore } from "@/stores/ui-store";

export type TourId = "welcome" | "editor";

interface TourState {
  active: TourId | null;
  step: number;
  /** Start a tour (replays it even if seen). */
  start: (id: TourId) => void;
  /** Start a tour only if the user hasn't finished or skipped it yet. */
  startIfNew: (id: TourId) => void;
  go: (step: number) => void;
  /**
   * End the tour; it won't auto-start again either way. Skipping the welcome
   * tour means "no tours", so the editor tour is marked seen too.
   */
  end: (opts?: { skipped?: boolean }) => void;
}

export const useTourStore = create<TourState>()((set, get) => ({
  active: null,
  step: 0,
  start: (id) => set({ active: id, step: 0 }),
  startIfNew: (id) => {
    if (get().active || useUiStore.getState().toursSeen[id]) return;
    set({ active: id, step: 0 });
  },
  go: (step) => set({ step }),
  end: (opts) => {
    const id = get().active;
    const ui = useUiStore.getState();
    if (id) ui.setTourSeen(id, true);
    if (id === "welcome" && opts?.skipped) ui.setTourSeen("editor", true);
    set({ active: null, step: 0 });
  },
}));
