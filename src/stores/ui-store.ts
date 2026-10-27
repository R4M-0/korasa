"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Per-device UI preferences (persisted to localStorage). */
interface UiState {
  sidebarCollapsed: boolean;
  /** Ids of expanded collections/projects in the sidebar tree. */
  expanded: Record<string, boolean>;
  commandOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setExpanded: (id: string, v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      expanded: {},
      commandOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setExpanded: (id, v) => set((s) => ({ expanded: { ...s.expanded, [id]: v } })),
      setCommandOpen: (v) => set({ commandOpen: v }),
    }),
    {
      name: "korasa.ui",
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, expanded: s.expanded }),
    },
  ),
);
