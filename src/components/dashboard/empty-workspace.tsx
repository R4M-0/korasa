"use client";

import { FilePlus2, GraduationCap, Upload } from "lucide-react";
import { useDialogs } from "@/hooks/use-dialogs";

/** First-run state: no courses or projects yet. */
export function EmptyWorkspace() {
  const open = useDialogs((s) => s.open);
  const requestImport = useDialogs((s) => s.requestImport);
  const options = [
    {
      icon: GraduationCap,
      title: "Start a course",
      body: "Group lectures, exercises and revision notes for a class.",
      run: () => open({ kind: "create-collection", collectionKind: "course", parentId: null }),
    },
    {
      icon: FilePlus2,
      title: "Open a blank project",
      body: "Get straight to an A4 sheet — write, sketch, paste screenshots.",
      run: () => open({ kind: "create-project", collectionId: null }),
    },
    {
      icon: Upload,
      title: "Import a project",
      body: "Bring in a .korasa.json file exported from another workspace.",
      run: () => requestImport(null),
    },
  ];
  return (
    <div className="desk-surface relative overflow-hidden rounded-2xl border border-border px-6 py-14 text-center md:py-20">
      <div aria-hidden className="relative mx-auto mb-8 h-32 w-24">
        <div className="absolute inset-0 -rotate-6 rounded-[3px] border border-stone-300/70 bg-[#fffefb] shadow-[var(--paper-shadow)]" />
        <div className="absolute inset-0 rotate-3 rounded-[3px] border border-stone-300/70 bg-[#fffefb] shadow-[var(--paper-shadow)]">
          <div className="space-y-2 p-3 pt-6">
            {[70, 90, 60, 80].map((w, i) => (
              <div key={i} className="h-px bg-[#9db4d6]" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      </div>
      <h2 className="font-display text-4xl tracking-tight">Your desk is clear</h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-muted-foreground">
        Korasa keeps your courses, projects and A4 notes in one place. Pick a starting point.
      </p>
      <div className="mx-auto mt-10 grid max-w-3xl gap-3 text-left md:grid-cols-3">
        {options.map(({ icon: Icon, title, body, run }) => (
          <button
            key={title}
            type="button"
            onClick={run}
            className="group rounded-xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_10px_30px_-14px_rgba(60,40,10,.35)] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Icon className="size-5 text-primary" />
            <div className="mt-3 font-medium">{title}</div>
            <div className="mt-1 text-[13px] text-muted-foreground">{body}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
