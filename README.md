# Korasa

A personal digital workspace: organise courses and projects, then think on
virtual **A4 sheets** — write rich text anywhere, sketch, draw diagrams with
connectors, and paste screenshots. Everything stays editable and autosaves.

## Getting started

```bash
npm install          # also generates the Prisma client
npm run dev          # applies migrations, then starts http://localhost:3000
```

On first launch Korasa creates a local workspace with sample courses and notes.
Data lives in `./data/` (SQLite database + image attachments). Set
`KORASA_DATA_DIR` to store it elsewhere, or `KORASA_SKIP_SAMPLE=1` to start
with an empty workspace.

| Script               | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Migrate + dev server                          |
| `npm run build`      | Production build                              |
| `npm start`          | Migrate + production server                   |
| `npm run lint`       | ESLint                                        |
| `npm run typecheck`  | TypeScript                                    |
| `npm run db:migrate` | Create a migration after editing the schema   |
| `npm run db:studio`  | Browse the database                           |

## Desktop app (Windows, macOS, Linux)

Korasa ships as a local-first desktop app built with Electron. The app starts
a bundled Next.js server on `127.0.0.1` (protected by a per-launch token) and
keeps everything in the OS app-data folder:

| OS      | Data folder                               |
| ------- | ----------------------------------------- |
| Windows | `%APPDATA%\Korasa\data`                   |
| macOS   | `~/Library/Application Support/Korasa/data` |
| Linux   | `~/.config/Korasa/data`                   |

Build installers locally with `npm run desktop:dist -- --linux` (or `--win`,
which needs Wine on Linux, or `--mac` on a Mac). Output lands in
`dist-desktop/`.

**Releasing.** Push a version tag and GitHub Actions builds every installer on
native runners and attaches them to a **draft** release:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

Download and try the installers from the draft, then publish it. The landing
page's download links (`releases/latest/download/...`) go live at that point.

## Landing page

`landing/` is a static site (no build step) with OS-detecting download
buttons. `.github/workflows/pages.yml` deploys it to GitHub Pages on every push
to `main` that touches it — enable Pages once under *Settings → Pages → Source:
GitHub Actions*. It can also be hosted on any static host as-is.

## Using the editor

Open a project to get a stack of A4 pages. Tools (bottom dock):
**V** select · **H**/Space pan · **T** text · **P** pen · **M** highlighter ·
**E** eraser · **R/O/D** rectangle/ellipse/diamond · **A** arrow · **L** line ·
**I** image.

- Click a page with the text tool (or double-click empty paper) to write.
  Click a selected text box again to edit it in place.
- Drag arrows from one shape to another to create **connectors** that follow
  the shapes when moved. Double-click a shape to label it.
- Paste screenshots (Ctrl/⌘+V), drop image files, or press **I** to upload.
- Ctrl/⌘ + scroll zooms; Shift+1 fits all pages, Shift+2 fits the page.
- Three layouts: stacked pages, free workspace (drag page titles), single page.
- Press **?** for the full shortcut list; Ctrl/⌘+K opens the command menu.

Export from the editor's **Export** menu: vector PDF via the print dialog
(selectable text, sharp shapes, correct A4 sizes and mixed orientations), a
direct high-resolution PDF download, PNG of a page, or a portable
`.korasa.json` project file (with embedded images) that can be re-imported.

## Architecture

```
src/
  app/(app)/          app shell routes: dashboard, /c/[id], /p/[id] editor, lists, trash
  app/print/          print-to-PDF route (A4 sheets, named @page orientations)
  app/api/            route handlers (JSON, Zod-validated)
  components/editor/  canvas, page view, selection, text editor, toolbars, panels
  components/editor/render/  pure renderers shared by editor, thumbnails, export
  components/layout/  sidebar, command palette, dialogs (+ dashboard/courses/projects)
  lib/editor/         scene format, geometry, object ops, clipboard, images
  lib/db/             Prisma client, repository, attachments, sample content
  lib/export/         print, PDF/PNG rasterisation, JSON download
  stores/             Zustand: workspace tree, editor (history + autosave), UI prefs
prisma/               schema + migrations
```

**Canvas engine.** Excalidraw and tldraw were evaluated, but neither hosts
real rich-text documents inside fixed A4 sheets well (and Konva renders text
to a bitmap). Korasa uses a small DOM + SVG engine instead: text is real HTML
edited in place with Tiptap, shapes/arrows/ink are SVG, images are `<img>`
elements. This keeps text selectable and crisp, and makes vector PDF export
possible through the browser's print engine. Engine-specific code is confined
to `components/editor/`; the persisted format (`lib/editor/scene.ts`) is
engine-neutral.

**Scene format.** Each page stores a versioned JSON scene (`version: 1`) of
z-ordered objects in page units (1 unit = 1 CSS px of A4 at 96 dpi,
794 × 1123). Objects carry id, type, x/y/w/h, rotation, opacity, group and
lock state plus type-specific fields. Images reference attachment ids; binaries
live on disk, never in the JSON. Scenes are validated with Zod on write, and
invalid objects are dropped individually on read.

**Persistence.** Edits mark pages dirty and save after a 700 ms debounce;
each page tracks a local version so a save that races a newer edit doesn't
clear the dirty flag. Failed saves show *Save failed* and retry with backoff.
Unsaved scenes are mirrored to `localStorage` drafts keyed by server revision
and flushed with `keepalive` requests on tab close; on reopen a draft is
re-applied only if the server hasn't moved on. Undo/redo stores page
snapshots (structurally shared), one step per gesture or text-editing session.

The data model is single-user today but every row hangs off a `Workspace`,
leaving room for authentication, sync, and multiple workspaces.
