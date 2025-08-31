"use client";
import { useEffect, useState } from "react";

type Props = {
  tileOffsetHex?: string | null;
  pixelOffsetHex?: string | null;
  pixelColorHex?: string | null;
  pixelColorIndex?: number | null;
  selectionSize?: string | null;
  zoomPercent?: number | null;
};

type Theme = "light" | "dark" | "navy";
const THEMES: Theme[] = ["light", "dark", "navy"];

export default function StatusBar({ tileOffsetHex, pixelOffsetHex, pixelColorHex, pixelColorIndex, selectionSize, zoomPercent }: Props) {
  const [theme, setTheme] = useState<Theme>("dark");

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
    <footer className="h-8 border-t border-border px-3 flex items-center gap-6 text-xs bg-background text-foreground">
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
      <div className="ml-auto flex items-center">
        <button
          onClick={toggleTheme}
          className="h-6 px-2 inline-flex items-center justify-center rounded border border-border bg-surface hover:bg-muted"
          title={`Theme: ${theme} (click to switch)`}
          aria-label="Toggle theme"
        >
          {theme}
        </button>
      </div>
    </footer>
  );
}
