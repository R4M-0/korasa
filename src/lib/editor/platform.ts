export const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Human-readable shortcut, e.g. kbd("Mod+Shift+Z") → "⌘⇧Z" / "Ctrl+Shift+Z". */
export function kbd(combo: string) {
  if (isMac()) {
    return combo
      .replace(/Mod\+?/g, "⌘")
      .replace(/Shift\+?/g, "⇧")
      .replace(/Alt\+?/g, "⌥")
      .replace(/Delete/g, "⌫");
  }
  return combo.replace(/Mod/g, "Ctrl");
}
