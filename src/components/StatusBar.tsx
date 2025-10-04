"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pkg from "../../package.json";

type Props = {
  tileOffsetHex?: string | null;
  pixelOffsetHex?: string | null;
  pixelColorHex?: string | null;
  pixelColorIndex?: number | null;
  selectionSize?: string | null;
  zoomPercent?: number | null;
  showSelectionHint?: boolean;
};

type Theme = "light" | "dark" | "navy";
const THEMES: Theme[] = ["light", "dark", "navy"];

export default function StatusBar({ tileOffsetHex, pixelOffsetHex, pixelColorHex, pixelColorIndex, selectionSize, zoomPercent, showSelectionHint }: Props) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [showAbout, setShowAbout] = useState(false);
  const version = (pkg as { version?: string })?.version ?? "1.0.0";
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Initialize from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tilebravo:theme");
      const t = (saved === "light" || saved === "dark" || saved === "navy") ? (saved as Theme) : null;
      const current = (t ?? (document.documentElement.dataset.theme as Theme | undefined) ?? "dark");
      document.documentElement.dataset.theme = current;
      setTheme(current);
    } catch {
      // keep default
    }
  }, []);

  function toggleTheme() {
    const idx = THEMES.indexOf(theme);
    const next = THEMES[(idx + 1) % THEMES.length];
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("tilebravo:theme", next); } catch {}
    setTheme(next);
  }

  return (
    <footer className="h-8 border-t border-border px-3 flex items-center gap-6 text-xs bg-background text-foreground relative">
      <div className="min-w-[140px]">Tile offset: {tileOffsetHex ?? "—"}</div>
      <div className="min-w-[140px]">Pixel offset: {pixelOffsetHex ?? "—"}</div>
      <div className="min-w-[80px]">Zoom: {zoomPercent != null ? `${zoomPercent}%` : "—"}</div>
      <div className="min-w-[180px] flex items-center gap-2">
        <span
          className="inline-block w-3 h-3 rounded border border-border"
          style={{ backgroundColor: pixelColorHex ?? "transparent" }}
          aria-hidden
        />
        <span>
          Pixel color: {pixelColorHex ?? "—"}
          {pixelColorIndex != null ? ` (index ${pixelColorIndex})` : ""}
        </span>
      </div>
      {selectionSize && <div>Selection: {selectionSize} tiles</div>}
      {showSelectionHint && (
        <div className="text-[11px] text-foreground/70">
          Press Esc to cancel selection
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => setShowAbout(true)}
          className="h-6 w-6 inline-flex items-center justify-center rounded border border-border bg-surface hover:bg-muted"
          title="About"
          aria-label="About"
        >
          <CircleHelp size={16} />
        </button>
        <button
          onClick={toggleTheme}
          className="h-6 px-2 inline-flex items-center justify-center rounded border border-border bg-surface hover:bg-muted"
          title={`Theme: ${theme} (click to switch)`}
          aria-label="Toggle theme"
        >
          {theme}
        </button>
        {mounted && showAbout && createPortal(
          <div className="fixed inset-0 z-[1000]">
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowAbout(false)} />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <div className="max-w-md w-full rounded-lg border border-border bg-background shadow-lg p-4 text-foreground text-sm" role="dialog" aria-modal="true">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-semibold">About TileBravo</h2>
                  <button className="px-2 py-1 text-xs rounded border border-border bg-surface hover:bg-muted" onClick={() => setShowAbout(false)} aria-label="Close About">Close</button>
                </div>
                <div className="text-xs opacity-70 mb-2">Version: {version}</div>
                <p>TileBravo is a tile editor created for ROM hacking and translation of classic games based on tiles — an alternative/complement to editors like Tile Molester and YY-CHR.</p>
                <div className="mt-3 space-y-1">
                  <div className="font-medium">Author</div>
                  <div>Taihen</div>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="font-medium">Website</div>
                  <a className="underline" href="https://hextinkers.org" target="_blank" rel="noreferrer">https://hextinkers.org</a>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="font-medium">Public Version</div>
                  <a className="underline" href="https://tilebravo.hextinkers.org/" target="_blank" rel="noreferrer">https://tilebravo.hextinkers.org/</a>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="font-medium">GitHub</div>
                  <a className="underline" href="https://github.com/taihendarou/tilebravo" target="_blank" rel="noreferrer">github.com/taihendarou/tilebravo</a>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="font-medium">Community</div>
                  <a className="underline" href="https://discord.gg/5x7KZEqGfC" target="_blank" rel="noreferrer">Join the Discord server</a>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="font-medium">Documentation</div>
                  <a className="underline" href="https://github.com/taihendarou/tilebravo/blob/main/docs/keyboard-shortcuts.md" target="_blank" rel="noreferrer">Keyboard shortcuts & quick actions</a>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="font-medium">Contact</div>
                  <div>taihendarou[a]gmail.com / Discord: taihendarou</div>
                </div>
              </div>
            </div>
          </div>, document.body)
        }
      </div>
    </footer>
  );
}
