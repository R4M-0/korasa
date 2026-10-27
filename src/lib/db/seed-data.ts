import { nanoid } from "nanoid";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  extractSceneText,
  SCENE_VERSION,
  type LinearObject,
  type Scene,
  type SceneObject,
  type ShapeObject,
  type TextObject,
} from "@/lib/editor/scene";

/*
 * Sample content shown on first launch so a new workspace demonstrates the
 * real experience: courses, nested folders, independent projects, and pages
 * mixing rich text, shapes and connectors.
 */

const INK = "#1f1d1a";
const BLUE = "#2f4fb0";
const RED = "#c2410c";

const base = { rotation: 0, opacity: 1, groupId: null, locked: false };

function text(x: number, y: number, w: number, html: string, opts: Partial<TextObject> = {}): TextObject {
  return {
    ...base,
    id: nanoid(10),
    type: "text",
    x,
    y,
    w,
    h: opts.h ?? 40,
    html,
    fontSize: 17,
    fontFamily: "sans",
    color: INK,
    align: "left",
    background: "transparent",
    autoHeight: true,
    ...opts,
  };
}

function shape(
  type: ShapeObject["type"],
  x: number,
  y: number,
  w: number,
  h: number,
  label = "",
  style: Partial<ShapeObject["style"]> = {},
  extra: Partial<ShapeObject> = {},
): ShapeObject {
  return {
    ...base,
    id: nanoid(10),
    type,
    x,
    y,
    w,
    h,
    radius: 8,
    label,
    labelColor: INK,
    labelSize: 16,
    style: { stroke: INK, fill: "transparent", strokeWidth: 2, dash: "solid", ...style },
    ...extra,
  };
}

/** Straight connector between two shapes' centres, clipped later by the editor. */
function connect(
  a: ShapeObject,
  b: ShapeObject,
  arrow = true,
  style: Partial<LinearObject["style"]> = {},
): LinearObject {
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  // Approximate boundary points so stored geometry is already sensible.
  const clip = (s: ShapeObject, fx: number, fy: number, tx: number, ty: number): [number, number] => {
    const dx = tx - fx;
    const dy = ty - fy;
    const len = Math.hypot(dx, dy) || 1;
    const rx = s.w / 2;
    const ry = s.h / 2;
    const t =
      s.type === "ellipse"
        ? 1 / Math.sqrt((dx / len / rx) ** 2 + (dy / len / ry) ** 2)
        : Math.min(Math.abs(rx / (dx / len || 1e-9)), Math.abs(ry / (dy / len || 1e-9)));
    return [fx + (dx / len) * (t + 4), fy + (dy / len) * (t + 4)];
  };
  const [sx, sy] = clip(a, ax, ay, bx, by);
  const [ex, ey] = clip(b, bx, by, ax, ay);
  const x = Math.min(sx, ex);
  const y = Math.min(sy, ey);
  return {
    ...base,
    id: nanoid(10),
    type: arrow ? "arrow" : "line",
    x,
    y,
    w: Math.abs(ex - sx),
    h: Math.abs(ey - sy),
    points: [
      [sx - x, sy - y],
      [ex - x, ey - y],
    ],
    style: { stroke: INK, fill: "transparent", strokeWidth: 2, dash: "solid", ...style },
    startArrow: "none",
    endArrow: arrow ? "arrow" : "none",
    startBinding: { objectId: a.id },
    endBinding: { objectId: b.id },
  };
}

function scene(objects: SceneObject[]): Scene {
  return { version: SCENE_VERSION, objects };
}

function binaryTreePage(): Scene {
  const node = (x: number, y: number, v: string, hl = false) =>
    shape("ellipse", x, y, 56, 56, v, {
      fill: hl ? "#dbe4ff" : "#ffffff",
      stroke: hl ? BLUE : INK,
    });
  const n8 = node(369, 420, "8", true);
  const n3 = node(229, 520, "3");
  const n10 = node(509, 520, "10");
  const n1 = node(159, 620, "1");
  const n6 = node(299, 620, "6");
  const n14 = node(579, 620, "14");
  const n13 = node(509, 720, "13");
  const edges = [
    connect(n8, n3, false),
    connect(n8, n10, false),
    connect(n3, n1, false),
    connect(n3, n6, false),
    connect(n10, n14, false),
    connect(n14, n13, false),
  ];
  return scene([
    text(72, 64, 650, "<h1>Binary search trees</h1>", { fontFamily: "serif", fontSize: 18 }),
    text(
      72,
      132,
      650,
      "<p>A <strong>binary search tree</strong> keeps keys ordered: for every node, keys in the left subtree are <em>smaller</em> and keys in the right subtree are <em>larger</em>.</p><p></p><ul><li><p>Search, insert and delete run in <code>O(h)</code> where <code>h</code> is the height.</p></li><li><p>Balanced trees keep <code>h = O(log n)</code>; a degenerate tree is a linked list.</p></li><li><p>In-order traversal visits keys in <mark data-color=\"#fde68a\" style=\"background-color: #fde68a; color: inherit\">sorted order</mark>.</p></li></ul>",
    ),
    text(560, 400, 180, "<p>root</p>", { fontFamily: "hand", fontSize: 26, color: BLUE }),
    n8,
    n3,
    n10,
    n1,
    n6,
    n14,
    n13,
    ...edges,
    text(
      72,
      840,
      650,
      "<h3>Insert 7</h3><ol><li><p>7 &lt; 8 → go left to 3.</p></li><li><p>7 &gt; 3 → go right to 6.</p></li><li><p>7 &gt; 6 and 6 has no right child → attach 7 there.</p></li></ol>",
    ),
  ]);
}

function traversalsPage(): Scene {
  const boxes = ["8", "3", "1", "6", "10", "14", "13"].map((v, i) =>
    shape("rect", 80 + i * 90, 300, 64, 44, v, { fill: i < 4 ? "#e8f5e9" : "#ffffff" }),
  );
  const arrows = boxes.slice(1).map((b, i) => connect(boxes[i], b, true, { stroke: "#57534e" }));
  return scene([
    text(72, 64, 650, "<h1>Tree traversals</h1>", { fontFamily: "serif" }),
    text(
      72,
      132,
      650,
      "<p>Three depth-first orders, differing only in <em>when</em> the node itself is visited:</p><ul><li><p><strong>Pre-order</strong> — node, left, right (copying a tree)</p></li><li><p><strong>In-order</strong> — left, node, right (sorted output)</p></li><li><p><strong>Post-order</strong> — left, right, node (freeing memory)</p></li></ul>",
    ),
    text(72, 262, 400, "<p><strong>Pre-order of the example tree</strong></p>", { fontSize: 15 }),
    ...boxes,
    ...arrows,
    text(
      72,
      400,
      650,
      "<pre><code>void inorder(Node* n) {\n  if (!n) return;\n  inorder(n-&gt;left);\n  visit(n);\n  inorder(n-&gt;right);\n}</code></pre>",
      { fontSize: 15 },
    ),
    text(470, 560, 250, "<p>Recursion depth = tree height → stack overflow risk on degenerate trees!</p>", {
      fontFamily: "hand",
      fontSize: 22,
      color: RED,
      rotation: -3,
    }),
  ]);
}

function heapPage(): Scene {
  return scene([
    text(72, 64, 650, "<h1>Exercise sheet — Heaps</h1>", { fontFamily: "serif" }),
    text(
      72,
      140,
      650,
      "<ol><li><p>Show the array after inserting 5, 3, 17, 10, 84, 19, 6, 22, 9 into an empty min-heap.</p></li><li><p>Prove that building a heap bottom-up is <code>O(n)</code>.</p></li><li><p>Implement <code>decreaseKey</code> and state its complexity.</p></li></ol>",
    ),
    shape("rect", 72, 360, 650, 260, "", { stroke: "#a8a29e", dash: "dashed" }),
    text(92, 376, 300, "<p>Working space</p>", { fontFamily: "hand", fontSize: 22, color: "#78716c" }),
  ]);
}

function dnsPage(): Scene {
  const client = shape("rect", 80, 330, 120, 56, "Laptop", { fill: "#ffffff" });
  const resolver = shape("rect", 320, 330, 150, 56, "Recursive resolver", { fill: "#dbe4ff", stroke: BLUE });
  const root = shape("diamond", 580, 200, 130, 80, "Root (.)", { fill: "#fff7ed" });
  const tld = shape("diamond", 580, 318, 130, 80, ".edu TLD", { fill: "#fff7ed" });
  const auth = shape("diamond", 580, 436, 130, 80, "Authoritative", { fill: "#fff7ed" });
  return scene([
    text(72, 64, 650, "<h1>DNS resolution</h1>", { fontFamily: "serif" }),
    text(
      72,
      132,
      650,
      "<p>Resolving <code>www.cs.example.edu</code> — the resolver walks the hierarchy iteratively and caches every answer for its <strong>TTL</strong>.</p>",
    ),
    client,
    resolver,
    root,
    tld,
    auth,
    connect(client, resolver),
    connect(resolver, root),
    connect(resolver, tld),
    connect(resolver, auth),
    text(206, 300, 110, "<p>1. query</p>", { fontFamily: "hand", fontSize: 20, color: BLUE }),
    text(
      72,
      580,
      650,
      "<h3>Record types</h3><ul><li><p><code>A</code> / <code>AAAA</code> — IPv4 / IPv6 address</p></li><li><p><code>CNAME</code> — alias to another name</p></li><li><p><code>MX</code> — mail exchanger</p></li><li><p><code>NS</code> — delegates a zone to name servers</p></li></ul>",
    ),
  ]);
}

function dhcpPage(): Scene {
  const steps = [
    ["Discover", "broadcast: anyone serving addresses?"],
    ["Offer", "server proposes 192.168.1.42"],
    ["Request", "client accepts the offer"],
    ["Acknowledge", "lease confirmed (e.g. 24h)"],
  ];
  const objs: SceneObject[] = [
    text(72, 64, 650, "<h1>DHCP — the DORA exchange</h1>", { fontFamily: "serif" }),
  ];
  const c = shape("rect", 100, 150, 140, 50, "Client", { fill: "#ffffff" });
  const s = shape("rect", 554, 150, 140, 50, "DHCP server", { fill: "#dbe4ff", stroke: BLUE });
  objs.push(c, s);
  steps.forEach(([title, note], i) => {
    const y = 250 + i * 90;
    const fromClient = i % 2 === 0;
    const x1 = fromClient ? 170 : 624;
    const x2 = fromClient ? 624 : 170;
    objs.push({
      ...base,
      id: nanoid(10),
      type: "arrow",
      x: Math.min(x1, x2),
      y,
      w: Math.abs(x2 - x1),
      h: 0,
      points: fromClient
        ? [
            [0, 0],
            [454, 0],
          ]
        : [
            [454, 0],
            [0, 0],
          ],
      style: { stroke: i === 3 ? BLUE : INK, fill: "transparent", strokeWidth: 2, dash: i === 0 ? "dashed" : "solid" },
      startArrow: "none",
      endArrow: "triangle",
      startBinding: null,
      endBinding: null,
    });
    objs.push(text(250, y - 34, 300, `<p><strong>${i + 1}. ${title}</strong> — ${note}</p>`, { fontSize: 14, align: "center" }));
  });
  objs.push(
    text(72, 640, 650, "<p>Ports: client <code>68/udp</code>, server <code>67/udp</code>. Renewal starts at <strong>T1 = 50%</strong> of the lease.</p>"),
  );
  return scene(objs);
}

function algoPage(): Scene {
  return scene([
    text(72, 64, 650, "<h1>Two pointers &amp; sliding window</h1>", { fontFamily: "serif" }),
    text(
      72,
      140,
      650,
      "<p>Use when the answer is a <strong>contiguous range</strong> and moving a boundary changes the cost monotonically.</p><pre><code>int best = 0;\nfor (int l = 0, r = 0; r &lt; n; r++) {\n  add(a[r]);\n  while (!valid()) remove(a[l++]);\n  best = max(best, r - l + 1);\n}</code></pre><p>Each index enters and leaves the window once → <code>O(n)</code>.</p>",
      { fontSize: 16 },
    ),
    text(72, 520, 650, "<h3>Practice</h3><ul><li><p>Longest substring without repeating characters</p></li><li><p>Minimum window substring</p></li><li><p>Count subarrays with sum ≤ k (non-negative values)</p></li></ul>"),
  ]);
}

function ideasPage(): Scene {
  const sticky = (x: number, y: number, html: string, bg: string, rot: number) =>
    text(x, y, 220, html, { fontFamily: "hand", fontSize: 24, background: bg, rotation: rot, h: 150 });
  const a = shape("ellipse", 300, 520, 190, 90, "Korasa", { fill: "#dbe4ff", stroke: BLUE });
  const b = shape("rect", 90, 700, 170, 60, "Flashcards", { dash: "dashed" });
  const c = shape("rect", 520, 700, 170, 60, "Study timer", { dash: "dashed" });
  return scene([
    text(72, 64, 650, "<h1>Scratchpad</h1>", { fontFamily: "serif" }),
    sticky(80, 160, "<p>Summarise each lecture on one A4 page.</p>", "#fef3c7", -2),
    sticky(330, 180, "<p>Draw every algorithm before coding it.</p>", "#dcfce7", 1.5),
    sticky(560, 150, "<p>Review notes on Sunday evenings.</p>", "#fce7f3", 3),
    a,
    b,
    c,
    connect(a, b, true, { dash: "dotted" }),
    connect(a, c, true, { dash: "dotted" }),
  ]);
}

export async function seedWorkspace(db: PrismaClient, workspaceId: string) {
  const day = 24 * 3600 * 1000;
  const now = Date.now();

  const page = (
    projectId: string,
    title: string,
    position: number,
    background: string,
    s: Scene,
    openedAgo?: number,
  ) =>
    db.page.create({
      data: {
        projectId,
        title,
        position,
        background,
        scene: JSON.stringify(s),
        textContent: extractSceneText(s),
        lastOpenedAt: openedAgo !== undefined ? new Date(now - openedAgo) : null,
      },
    });

  const ds = await db.collection.create({
    data: {
      workspaceId,
      kind: "course",
      name: "Data Structures",
      description: "Trees, heaps, hashing and graphs — lecture notes, exercise sheets and revision.",
      icon: "binary",
      color: "#2f4fb0",
      term: "Fall 2026",
      position: 1,
      favoritedAt: new Date(now - day),
    },
  });
  const lectures = await db.collection.create({
    data: { workspaceId, kind: "folder", name: "Lectures", parentId: ds.id, position: 1, icon: "folder" },
  });
  const trees = await db.project.create({
    data: {
      workspaceId,
      collectionId: lectures.id,
      name: "Trees",
      description: "Lecture 5–6: binary search trees and traversals.",
      icon: "network",
      color: "#2f4fb0",
      position: 1,
      lastOpenedAt: new Date(now - 3600 * 1000),
      favoritedAt: new Date(now - day),
    },
  });
  await page(trees.id, "Binary search trees", 1, "ruled", binaryTreePage(), 3600 * 1000);
  await page(trees.id, "Traversals", 2, "grid", traversalsPage());

  const heaps = await db.project.create({
    data: {
      workspaceId,
      collectionId: ds.id,
      name: "Exercises — Heaps",
      icon: "pencil",
      color: "#b45309",
      position: 2,
      lastOpenedAt: new Date(now - 2 * day),
    },
  });
  await page(heaps.id, "Sheet 4", 1, "dotted", heapPage());

  const net = await db.collection.create({
    data: {
      workspaceId,
      kind: "course",
      name: "Computer Networks",
      description: "Application to link layer. Focus on DNS, DHCP, TCP congestion control.",
      icon: "globe",
      color: "#0f766e",
      term: "Fall 2026",
      position: 2,
    },
  });
  const dns = await db.project.create({
    data: {
      workspaceId,
      collectionId: net.id,
      name: "DNS and DHCP",
      description: "Name resolution and address assignment.",
      icon: "globe",
      color: "#0f766e",
      position: 1,
      lastOpenedAt: new Date(now - 5 * 3600 * 1000),
    },
  });
  await page(dns.id, "DNS resolution", 1, "plain", dnsPage(), 5 * 3600 * 1000);
  await page(dns.id, "DHCP", 2, "ruled", dhcpPage());

  const cp = await db.project.create({
    data: {
      workspaceId,
      name: "Competitive Programming",
      description: "Patterns and templates I keep coming back to.",
      icon: "code",
      color: "#7c3aed",
      position: 1,
      lastOpenedAt: new Date(now - 3 * day),
    },
  });
  await page(cp.id, "Two pointers", 1, "grid", algoPage());

  const personal = await db.collection.create({
    data: { workspaceId, kind: "folder", name: "Personal", icon: "folder", position: 3 },
  });
  const ideas = await db.project.create({
    data: {
      workspaceId,
      collectionId: personal.id,
      name: "Ideas",
      icon: "lightbulb",
      color: "#ca8a04",
      position: 1,
      lastOpenedAt: new Date(now - 6 * day),
    },
  });
  await page(ideas.id, "Scratchpad", 1, "dotted", ideasPage());
}
