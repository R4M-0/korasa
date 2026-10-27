"use client";

import { useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  Baseline,
  Bold,
  Code,
  CopyPlus,
  Frame,
  Group,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Lock,
  PaintBucket,
  Pencil,
  Quote,
  StickyNote,
  Strikethrough,
  Trash2,
  Underline,
  Ungroup,
  Unlock,
} from "lucide-react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import {
  ColorPicker,
  FILL_COLORS,
  HIGHLIGHT_COLORS,
  IconButton,
  INK_COLORS,
  keepFocus,
  ToolbarDivider,
  ToolbarSurface,
} from "@/components/editor/toolbar/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FONT_LABELS, FONT_STACKS } from "@/lib/editor/fonts";
import { isLinear } from "@/lib/editor/geometry";
import { kbd } from "@/lib/editor/platform";
import { ARROWHEADS, FONT_FAMILIES, type Arrowhead, type SceneObject, type StrokeStyle, type TextObject } from "@/lib/editor/scene";
import { cn } from "@/lib/utils";
import { editor, useEditorStore, useSelectedObjects } from "@/stores/editor-store";

const STROKE_WIDTHS = [1, 2, 4, 8];
const PEN_WIDTHS = [2, 3, 5, 8, 14];
const FONT_SIZES = [12, 14, 16, 18, 22, 28, 36, 48, 64];

const hasStyle = (o: SceneObject): o is SceneObject & { style: StrokeStyle } => "style" in o;

/** Update selected objects and remember the choice as the default for new ones. */
function restyle(patch: Partial<StrokeStyle>) {
  editor.updateSelected((o) => (hasStyle(o) ? ({ ...o, style: { ...o.style, ...patch } } as SceneObject) : o));
  editor.setStyle(patch);
}

function StrokeWidthPicker({ value, onChange, widths = STROKE_WIDTHS, label = "Stroke width" }: { value: number; onChange: (w: number) => void; widths?: number[]; label?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        onMouseDown={keepFocus}
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-foreground/80 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="w-4 rounded-full bg-foreground/80" style={{ height: Math.min(Math.max(value / 1.5, 1), 8) }} />
        <span className="tabular-nums">{value}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-36">
        {widths.map((w) => (
          <DropdownMenuItem key={w} onClick={() => onChange(w)} className={cn(w === value && "bg-accent")}>
            <span className="w-10 rounded-full bg-foreground" style={{ height: Math.min(Math.max(w / 1.5, 1), 8) }} />
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">{w}px</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DashPicker({ value }: { value: StrokeStyle["dash"] }) {
  const opts: StrokeStyle["dash"][] = ["solid", "dashed", "dotted"];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Stroke style"
        onMouseDown={keepFocus}
        className="inline-flex h-8 items-center rounded-md px-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <DashSample dash={value} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-36">
        {opts.map((d) => (
          <DropdownMenuItem key={d} onClick={() => restyle({ dash: d })} className={cn(d === value && "bg-accent")}>
            <DashSample dash={d} /> <span className="ml-auto text-xs capitalize text-muted-foreground">{d}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DashSample({ dash }: { dash: StrokeStyle["dash"] }) {
  return (
    <svg width="28" height="8" aria-hidden>
      <line
        x1="2"
        x2="26"
        y1="4"
        y2="4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={dash === "dashed" ? "6 4" : dash === "dotted" ? "0.1 4" : undefined}
      />
    </svg>
  );
}

const ARROW_LABELS: Record<Arrowhead, string> = { none: "None", arrow: "Arrow", triangle: "Triangle", dot: "Dot" };

function ArrowheadPicker({ which, value }: { which: "start" | "end"; value: Arrowhead }) {
  const icon = (h: Arrowhead) => (
    <svg width="26" height="12" aria-hidden className={which === "start" ? "rotate-180" : undefined}>
      <line x1="2" x2="22" y1="6" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {h === "arrow" && <path d="M16 2 L22 6 L16 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
      {h === "triangle" && <path d="M16 2 L23 6 L16 10 Z" fill="currentColor" />}
      {h === "dot" && <circle cx="21" cy="6" r="3" fill="currentColor" />}
    </svg>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${which === "start" ? "Start" : "End"} arrowhead`}
        onMouseDown={keepFocus}
        className="inline-flex h-8 items-center rounded-md px-1.5 text-foreground/80 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {icon(value)}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-40">
        {ARROWHEADS.map((h) => (
          <DropdownMenuItem
            key={h}
            className={cn(h === value && "bg-accent")}
            onClick={() => {
              editor.updateSelected((o) => (isLinear(o) ? { ...o, [which === "start" ? "startArrow" : "endArrow"]: h } : o));
              editor.setStyle(which === "start" ? { startArrow: h } : { endArrow: h });
            }}
          >
            {icon(h)} <span className="ml-auto text-xs text-muted-foreground">{ARROW_LABELS[h]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// -------------------------------------------------------------------- text

function useTiptapState(ed: TiptapEditor | null) {
  return useEditorState({
    editor: ed,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            code: e.isActive("code"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            heading: ([1, 2, 3] as const).find((l) => e.isActive("heading", { level: l })) ?? 0,
            color: (e.getAttributes("textStyle").color as string | undefined) ?? null,
            empty: e.state.selection.empty,
          }
        : null,
  });
}

const BLOCK_LABELS = ["Paragraph", "Heading 1", "Heading 2", "Heading 3"];

function TextControls({ obj }: { obj: TextObject }) {
  const ed = useEditorStore((s) => (s.editing?.id === obj.id ? s.textEditor : null));
  const st = useTiptapState(ed);
  const setObj = (patch: Partial<TextObject>) => {
    editor.updateSelected((o) => (o.type === "text" ? { ...o, ...patch } : o));
    if (patch.fontFamily) editor.setStyle({ fontFamily: patch.fontFamily });
    if (patch.fontSize) editor.setStyle({ fontSize: patch.fontSize });
    if (patch.color) editor.setStyle({ textColor: patch.color });
  };
  const chain = () => ed!.chain().focus();
  /** Inline marks need an active edit session; start one selecting everything. */
  const withEditor = (fn: (e: TiptapEditor) => void) => {
    if (ed) return fn(ed);
    editor.startEditing(obj.id, "text");
    requestAnimationFrame(() => {
      const live = useEditorStore.getState().textEditor;
      if (live) {
        live.commands.selectAll();
        fn(live);
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          onMouseDown={keepFocus}
          aria-label="Font"
          className="inline-flex h-8 w-[104px] items-center justify-between rounded-md px-2 text-[13px] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
          style={{ fontFamily: FONT_STACKS[obj.fontFamily] }}
        >
          {FONT_LABELS[obj.fontFamily]}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44">
          {FONT_FAMILIES.map((f) => (
            <DropdownMenuItem key={f} onClick={() => setObj({ fontFamily: f })} style={{ fontFamily: FONT_STACKS[f] }} className={cn("text-[15px]", f === obj.fontFamily && "bg-accent")}>
              {FONT_LABELS[f]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          onMouseDown={keepFocus}
          aria-label="Font size"
          className="inline-flex h-8 w-11 items-center justify-center rounded-md text-[13px] tabular-nums outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {Math.round(obj.fontSize)}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-24">
          {FONT_SIZES.map((sz) => (
            <DropdownMenuItem key={sz} onClick={() => setObj({ fontSize: sz })} className={cn("tabular-nums", sz === Math.round(obj.fontSize) && "bg-accent")}>
              {sz}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarDivider />
      <DropdownMenu>
        <DropdownMenuTrigger
          onMouseDown={keepFocus}
          aria-label="Block style"
          className="inline-flex h-8 items-center rounded-md px-2 text-[13px] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {st ? BLOCK_LABELS[st.heading] : "Style"}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-40">
          {BLOCK_LABELS.map((label, level) => (
            <DropdownMenuItem
              key={label}
              onClick={() =>
                withEditor((e) =>
                  level === 0 ? e.chain().focus().setParagraph().run() : e.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run(),
                )
              }
              className={cn(level === 1 && "text-lg font-bold", level === 2 && "font-semibold", level === 3 && "font-medium")}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton label="Bold" shortcut={kbd("Mod+B")} active={st?.bold} onClick={() => withEditor((e) => e.chain().focus().toggleBold().run())}>
        <Bold />
      </IconButton>
      <IconButton label="Italic" shortcut={kbd("Mod+I")} active={st?.italic} onClick={() => withEditor((e) => e.chain().focus().toggleItalic().run())}>
        <Italic />
      </IconButton>
      <IconButton label="Underline" shortcut={kbd("Mod+U")} active={st?.underline} onClick={() => withEditor((e) => e.chain().focus().toggleUnderline().run())}>
        <Underline />
      </IconButton>
      <IconButton label="Strikethrough" active={st?.strike} onClick={() => withEditor((e) => e.chain().focus().toggleStrike().run())}>
        <Strikethrough />
      </IconButton>
      <IconButton label="Inline code" shortcut={kbd("Mod+E")} active={st?.code} onClick={() => withEditor((e) => e.chain().focus().toggleCode().run())}>
        <Code />
      </IconButton>
      <ToolbarDivider />
      <IconButton label="Bulleted list" active={st?.bullet} onClick={() => withEditor((e) => e.chain().focus().toggleBulletList().run())}>
        <List />
      </IconButton>
      <IconButton label="Numbered list" active={st?.ordered} onClick={() => withEditor((e) => e.chain().focus().toggleOrderedList().run())}>
        <ListOrdered />
      </IconButton>
      <IconButton label="Quote" active={st?.quote} onClick={() => withEditor((e) => e.chain().focus().toggleBlockquote().run())}>
        <Quote />
      </IconButton>
      <ToolbarDivider />
      {(["left", "center", "right", "justify"] as const).map((a) => (
        <IconButton key={a} label={`Align ${a}`} active={obj.align === a} onClick={() => setObj({ align: a })} size="sm">
          {a === "left" ? <AlignLeft /> : a === "center" ? <AlignCenter /> : a === "right" ? <AlignRight /> : <AlignJustify />}
        </IconButton>
      ))}
      <ToolbarDivider />
      <ColorPicker
        label={ed && st && !st.empty ? "Text colour (selection)" : "Text colour"}
        icon={<Baseline />}
        value={(ed && st && !st.empty && st.color) || obj.color}
        colors={INK_COLORS}
        onChange={(c) => {
          if (ed && st && !st.empty) chain().setColor(c).run();
          else setObj({ color: c });
        }}
      />
      <ColorPicker
        label="Highlight"
        icon={<Highlighter />}
        value="transparent"
        colors={HIGHLIGHT_COLORS}
        onChange={(c) =>
          withEditor((e) => (c === "transparent" ? e.chain().focus().unsetHighlight().run() : e.chain().focus().setHighlight({ color: c }).run()))
        }
      />
      <ColorPicker label="Note background" icon={<StickyNote />} value={obj.background} colors={["transparent", ...HIGHLIGHT_COLORS.slice(1), "#ffffff", "#f5f5f4"]} onChange={(c) => setObj({ background: c })} />
      {!ed && (
        <IconButton label="Edit text" shortcut="Enter" onClick={() => editor.startEditing(obj.id, "text")}>
          <Pencil />
        </IconButton>
      )}
    </>
  );
}

// -------------------------------------------------------------- per type

function ShapeControls({ objs }: { objs: SceneObject[] }) {
  const first = objs.find(hasStyle)!;
  const style = first.style;
  const linear = objs.every(isLinear);
  const filled = objs.some((o) => o.type === "rect" || o.type === "ellipse" || o.type === "diamond");
  return (
    <>
      <ColorPicker label="Stroke" value={style.stroke} colors={INK_COLORS} onChange={(c) => restyle({ stroke: c })} />
      {filled && <ColorPicker label="Fill" icon={<PaintBucket />} value={style.fill} colors={FILL_COLORS} onChange={(c) => restyle({ fill: c })} />}
      <StrokeWidthPicker value={style.strokeWidth} onChange={(w) => restyle({ strokeWidth: w })} widths={filled ? [0, ...STROKE_WIDTHS] : STROKE_WIDTHS} />
      <DashPicker value={style.dash} />
      {linear && objs.length === 1 && isLinear(objs[0]) && (
        <>
          <ToolbarDivider />
          <ArrowheadPicker which="start" value={objs[0].startArrow} />
          <ArrowheadPicker which="end" value={objs[0].endArrow} />
        </>
      )}
      {filled && objs.length === 1 && (
        <IconButton label="Edit label" shortcut="Enter" onClick={() => editor.startEditing(objs[0].id, "label")}>
          <Pencil />
        </IconButton>
      )}
    </>
  );
}

function DrawControls({ objs }: { objs: SceneObject[] }) {
  const d = objs[0];
  if (d.type !== "draw") return null;
  return (
    <>
      <ColorPicker
        label="Ink"
        value={d.stroke}
        colors={d.highlighter ? HIGHLIGHT_COLORS.slice(1) : INK_COLORS}
        onChange={(c) => {
          editor.updateSelected((o) => (o.type === "draw" ? { ...o, stroke: c } : o));
          editor.setStyle(d.highlighter ? { highlighterColor: c } : { penColor: c });
        }}
      />
      <StrokeWidthPicker
        label="Thickness"
        value={d.strokeWidth}
        widths={PEN_WIDTHS}
        onChange={(w) => {
          editor.updateSelected((o) => (o.type === "draw" ? { ...o, strokeWidth: w } : o));
          editor.setStyle({ penWidth: w });
        }}
      />
    </>
  );
}

function ImageControls({ objs }: { objs: SceneObject[] }) {
  const img = objs[0];
  if (img.type !== "image") return null;
  return (
    <>
      <input
        key={img.id}
        defaultValue={img.caption}
        placeholder="Add a caption…"
        aria-label="Image caption"
        className="h-8 w-52 rounded-md bg-transparent px-2 text-[13px] outline-none placeholder:text-muted-foreground hover:bg-accent focus:bg-accent"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
          e.stopPropagation();
        }}
        onBlur={(e) => {
          const caption = e.target.value.trim();
          if (caption !== img.caption) editor.updateSelected((o) => (o.type === "image" ? { ...o, caption } : o));
        }}
      />
      <IconButton label={img.border ? "Remove border" : "Add border"} active={img.border} onClick={() => editor.updateSelected((o) => (o.type === "image" ? { ...o, border: !o.border } : o))}>
        <Frame />
      </IconButton>
      <IconButton
        label="Reset aspect ratio"
        onClick={() =>
          editor.updateSelected((o) => (o.type === "image" ? { ...o, h: Math.round(o.w * (o.naturalH / o.naturalW)) } : o))
        }
      >
        <span className="text-[11px] font-semibold">1:1</span>
      </IconButton>
    </>
  );
}

function MultiControls({ count, grouped }: { count: number; grouped: boolean }) {
  return (
    <>
      <span className="px-2 text-xs text-muted-foreground tabular-nums">{count} selected</span>
      <ToolbarDivider />
      <IconButton label="Align left" size="sm" onClick={() => editor.alignSelection("left")}><AlignStartVertical /></IconButton>
      <IconButton label="Align centre" size="sm" onClick={() => editor.alignSelection("hcenter")}><AlignCenterVertical /></IconButton>
      <IconButton label="Align right" size="sm" onClick={() => editor.alignSelection("right")}><AlignEndVertical /></IconButton>
      <IconButton label="Align top" size="sm" onClick={() => editor.alignSelection("top")}><AlignStartHorizontal /></IconButton>
      <IconButton label="Align middle" size="sm" onClick={() => editor.alignSelection("vcenter")}><AlignCenterHorizontal /></IconButton>
      <IconButton label="Align bottom" size="sm" onClick={() => editor.alignSelection("bottom")}><AlignEndHorizontal /></IconButton>
      <ToolbarDivider />
      {grouped ? (
        <IconButton label="Ungroup" shortcut={kbd("Mod+Shift+G")} onClick={() => editor.ungroupSelection()}><Ungroup /></IconButton>
      ) : (
        <IconButton label="Group" shortcut={kbd("Mod+G")} onClick={() => editor.groupSelection()}><Group /></IconButton>
      )}
    </>
  );
}

function PenDefaults() {
  const tool = useEditorStore((s) => s.tool);
  const style = useEditorStore((s) => s.style);
  const highlighter = tool === "highlighter";
  return (
    <>
      <span className="px-2 text-xs text-muted-foreground">{highlighter ? "Highlighter" : "Pen"}</span>
      <ColorPicker
        label="Ink"
        value={highlighter ? style.highlighterColor : style.penColor}
        colors={highlighter ? HIGHLIGHT_COLORS.slice(1) : INK_COLORS}
        onChange={(c) => editor.setStyle(highlighter ? { highlighterColor: c } : { penColor: c })}
      />
      <StrokeWidthPicker label="Thickness" value={style.penWidth} widths={PEN_WIDTHS} onChange={(w) => editor.setStyle({ penWidth: w })} />
    </>
  );
}

function ShapeDefaults() {
  const tool = useEditorStore((s) => s.tool);
  const style = useEditorStore((s) => s.style);
  const filled = tool === "rect" || tool === "ellipse" || tool === "diamond";
  return (
    <>
      <ColorPicker label="Stroke" value={style.stroke} colors={INK_COLORS} onChange={(c) => editor.setStyle({ stroke: c })} />
      {filled && <ColorPicker label="Fill" icon={<PaintBucket />} value={style.fill} colors={FILL_COLORS} onChange={(c) => editor.setStyle({ fill: c })} />}
      <StrokeWidthPicker value={style.strokeWidth} onChange={(w) => editor.setStyle({ strokeWidth: w })} />
    </>
  );
}

/**
 * Floating toolbar whose contents follow the current selection or tool.
 */
export function ContextToolbar() {
  const objs = useSelectedObjects();
  const tool = useEditorStore((s) => s.tool);
  const editingText = useEditorStore((s) => s.editing?.kind === "text");

  let body: React.ReactNode = null;
  if (objs.length === 0) {
    if (tool === "pen" || tool === "highlighter") body = <PenDefaults />;
    else if (["rect", "ellipse", "diamond", "arrow", "line"].includes(tool)) body = <ShapeDefaults />;
    else return null;
    return <ToolbarSurface className="pointer-events-auto">{body}</ToolbarSurface>;
  }

  const allLocked = objs.every((o) => o.locked);
  const types = new Set(objs.map((o) => o.type));
  const single = objs.length === 1 ? objs[0] : null;
  const grouped = objs.some((o) => o.groupId);
  if (single?.type === "text" || (types.size === 1 && types.has("text"))) body = <TextControls obj={objs[0] as TextObject} />;
  else if (objs.every(hasStyle)) body = <ShapeControls objs={objs} />;
  else if (single?.type === "draw" || (types.size === 1 && types.has("draw"))) body = <DrawControls objs={objs} />;
  else if (single?.type === "image") body = <ImageControls objs={objs} />;

  return (
    <ToolbarSurface className="pointer-events-auto max-w-[calc(100vw-2rem)] overflow-x-auto" role="toolbar" aria-label="Selection">
      {objs.length > 1 && <MultiControls count={objs.length} grouped={grouped} />}
      {objs.length > 1 && body && <ToolbarDivider />}
      {body}
      {!editingText && (
        <>
          <ToolbarDivider />
          <IconButton label="Bring to front" shortcut={kbd("Mod+Shift+]")} size="sm" onClick={() => editor.reorderSelection("front")}>
            <ArrowUpToLine />
          </IconButton>
          <IconButton label="Send to back" shortcut={kbd("Mod+Shift+[")} size="sm" onClick={() => editor.reorderSelection("back")}>
            <ArrowDownToLine />
          </IconButton>
          <IconButton label={allLocked ? "Unlock" : "Lock position"} size="sm" active={allLocked} onClick={() => editor.updateSelected((o) => ({ ...o, locked: !allLocked }))}>
            {allLocked ? <Lock /> : <Unlock />}
          </IconButton>
          <IconButton label="Duplicate" shortcut={kbd("Mod+D")} size="sm" onClick={() => editor.duplicateSelection()}>
            <CopyPlus />
          </IconButton>
          <IconButton label="Delete" shortcut="Del" size="sm" onClick={() => editor.deleteSelection()} className="hover:text-destructive">
            <Trash2 />
          </IconButton>
        </>
      )}
    </ToolbarSurface>
  );
}
