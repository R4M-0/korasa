import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "code", "pre", "mark", "span",
  "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "hr", "a",
];

const cache = new Map<string, string>();

/**
 * Sanitise rich-text HTML before rendering it outside the editor. Content
 * normally comes from Tiptap, but imported project files are untrusted.
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  const hit = cache.get(html);
  if (hit !== undefined) return hit;
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["style", "href", "target", "rel", "data-color", "class"],
    ALLOWED_URI_REGEXP: /^(https?:|mailto:)/i,
  });
  if (cache.size > 2000) cache.clear();
  cache.set(html, clean);
  return clean;
}
