import type { ReactNode } from "react";
import type { TourId } from "@/stores/tour-store";

export interface TourStep {
  /** CSS selector of the element to spotlight; omitted = centred card. */
  target?: string;
  title: string;
  body: ReactNode;
  /** Runs when the step is shown (e.g. reveal the element it points at). */
  onEnter?: () => void;
}

const Key = ({ children }: { children: ReactNode }) => (
  <kbd className="rounded border border-border bg-muted px-1.5 py-px font-sans text-[11px] text-foreground">{children}</kbd>
);

export function tourSteps(id: TourId, mod: string, actions: { revealSidebar: () => void }): TourStep[] {
  if (id === "welcome") {
    return [
      {
        title: "Welcome to Korasa",
        body: (
          <>
            A notebook for your courses and projects — real A4 pages you can write on, sketch on and paste screenshots
            into. Here’s a one-minute look around.
          </>
        ),
      },
      {
        target: '[data-tour="create"]',
        onEnter: actions.revealSidebar,
        title: "Create anything",
        body: (
          <>
            Start a <b>course</b> for a class, a <b>folder</b> for anything else, or a <b>project</b> — a stack of A4
            pages. You can also import a project file here.
          </>
        ),
      },
      {
        target: '[data-tour="search"]',
        onEnter: actions.revealSidebar,
        title: "Find it again",
        body: (
          <>
            Search names and the text inside every page, or jump anywhere — press <Key>{mod}K</Key> from any screen.
          </>
        ),
      },
      {
        target: '[data-tour="library"]',
        onEnter: actions.revealSidebar,
        title: "Your library",
        body: (
          <>
            Courses, projects and folders live here. Drag items to reorganise them, and right-click for rename, move,
            favourite and delete.
          </>
        ),
      },
      {
        target: '[data-tour="start"]',
        title: "Start here",
        body: <>These shortcuts create your first project or course in one click.</>,
      },
      {
        title: "Everything stays on this computer",
        body: (
          <>
            No account, no cloud. Your notes save automatically as you work and live only on this machine. Export any
            page or project as a PDF — or as a project file to move it elsewhere.
          </>
        ),
      },
    ];
  }
  return [
    {
      target: '[data-tour="paper"]',
      title: "This is your paper",
      body: (
        <>
          Double-click anywhere on the page to start writing, or pick the <b>Text</b> tool. Select text to format it,
          and paste screenshots straight in with <Key>{mod}V</Key>.
        </>
      ),
    },
    {
      target: '[data-tour="tools"]',
      title: "Tools",
      body: (
        <>
          Pen, highlighter, shapes and arrows. Draw an arrow from one shape to another and it stays connected. Each
          tool has a key — <Key>T</Key> text, <Key>P</Key> pen, <Key>A</Key> arrow, <Key>V</Key> select.
        </>
      ),
    },
    {
      target: '[data-tour="pages"]',
      title: "Pages",
      body: <>Add, reorder and rename pages here. Right-click a page for its paper style, orientation and export.</>,
    },
    {
      target: '[data-tour="layouts"]',
      title: "Three ways to view",
      body: <>Stack your pages, lay them out freely on the desk, or focus on a single sheet.</>,
    },
    {
      target: '[data-tour="export"]',
      title: "Export",
      body: <>Save a page or the whole project as an A4 PDF or PNG, or as a Korasa project file.</>,
    },
    {
      target: '[data-tour="save"]',
      title: "Saved as you go",
      body: (
        <>
          Every change is saved automatically. Press <Key>?</Key> any time to see all keyboard shortcuts.
        </>
      ),
    },
  ];
}
