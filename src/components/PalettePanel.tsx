// src/components/PalettePanel.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";

type Props = {
  /** Lista de cores em hex (#RRGGBB). */
  palette: string[];
  /** Índice da cor atualmente selecionada (0-based). */
  currentColor: number;
  /** Setter do estado da paleta vindo do Page (useState). */
  setPalette: React.Dispatch<React.SetStateAction<string[]>>;
  /** Troca a cor selecionada (índice). */
  setCurrentColor: (index: number) => void;
  /** Se true, renderiza embutido (sem <details>/<summary>). */
  embedded?: boolean;
};

export default function PalettePanel({
  palette,
  currentColor,
  setPalette,
  setCurrentColor,
  embedded = false,
}: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [hexDraft, setHexDraft] = useState<string>("#000000");
  const hexInputRef = useRef<HTMLInputElement | null>(null);
  const colorPickerRef = useRef<HTMLInputElement | null>(null);

  function normalizeHex(input: string): string | null {
    const trimmed = input.trim().replace(/^#/u, "");
    if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
      const expanded = trimmed
        .split("")
        .map((c) => c + c)
        .join("");
      return `#${expanded.toUpperCase()}`;
    }
    if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toUpperCase()}`;
    return null;
  }

  function startEditing(index: number) {
    const current = normalizeHex(palette[index]) ?? "#000000";
    setHexDraft(current);
    setEditingIndex(index);
  }

  function closeEditor() {
    setEditingIndex(null);
  }

  const parsedHex = normalizeHex(hexDraft);
  const isValidHex = parsedHex !== null;

  useEffect(() => {
    if (editingIndex !== null && hexInputRef.current) {
      hexInputRef.current.focus();
      hexInputRef.current.select();
    }
  }, [editingIndex]);

  const content = (
    <>
      {/* Swatches em grid 4 colunas. Clique seleciona. Duplo clique abre picker. */}
      <div className="grid grid-cols-8 gap-2 mb-2">
        {palette.map((c, i) => (
          <div key={`sw-${i}`} className="flex flex-col items-center">
            <div
              role="button"
              aria-label={`Color ${i}`}
              title={`Color ${i}`}
              onClick={() => setCurrentColor(i)}
              onDoubleClick={() => startEditing(i)}
              style={{
                width: 32,
                height: 32,
                background: c,
                border: "2px solid",
                borderColor: i === currentColor ? "var(--border-strong)" : "var(--border)",
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: (() => {
                  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(c).toUpperCase());
                  const hex = m ? m[1] : "000000";
                  const r = parseInt(hex.slice(0, 2), 16);
                  const g = parseInt(hex.slice(2, 4), 16);
                  const b = parseInt(hex.slice(4, 6), 16);
                  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                  return lum > 140 ? "#000" : "#fff";
                })(),
              }}
            >
              <span style={{ fontSize: 9, lineHeight: 1, fontWeight: 600, userSelect: "none" }}>{i}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs opacity-70 mt-2">
        Click to select. Double-click to edit the color. Shortcuts 0–9 select
        colors when available.
      </div>

      {editingIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
          onClick={closeEditor}
        >
          <div
            className="rounded-lg border border-border bg-popover p-4 shadow-lg w-80 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <div className="text-base font-semibold">Edit Color</div>
              <div className="text-xs text-muted-foreground">Color #{editingIndex}</div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div>
                  <button
                    type="button"
                    className="h-12 w-12 rounded border border-border transition-colors group-hover:border-[#555] focus:outline-none focus:ring-2 focus:ring-primary"
                    style={{ background: parsedHex ?? "#000000" }}
                    aria-label="Current color preview. Click to select a new color."
                    onClick={() => colorPickerRef.current?.click()}
                  />
                </div>
                <span className="text-sm text-muted-foreground">
                  Click the color preview to choose a new color
                </span>
              </div>
              <input
                ref={colorPickerRef}
                type="color"
                value={parsedHex ?? "#000000"}
                onChange={(e) => setHexDraft(e.target.value.toUpperCase())}
                style={{ display: "none" }}
              />
              <div className="space-y-1">
                <label className="text-xs uppercase opacity-70" htmlFor="palette-hex-input">
                  HEX Code
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    #
                  </span>
                  <input
                    id="palette-hex-input"
                    ref={hexInputRef}
                    className="w-full rounded border bg-background py-2 pl-5 pr-3 text-sm transition-colors"
                    style={{
                      borderColor:
                        hexDraft.length > 0
                          ? isValidHex
                            ? "#4caf50"
                            : "#f44336"
                          : "var(--border)",
                    }}
                    placeholder="rrggbb"
                    aria-label="Enter HEX code for color"
                    value={hexDraft.replace(/^#/u, "")}
                    onChange={(e) => {
                      let next = e.target.value;
                      next = next.replace(/[^0-9a-fA-F#]/g, "");
                      if (next.startsWith("#")) next = next.slice(1);
                      next = next.slice(0, 6);
                      const normalized = next.length ? `#${next.toUpperCase()}` : "#";
                      setHexDraft(normalized);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && isValidHex) {
                        if (editingIndex === null || !parsedHex) return;
                        setPalette((prev) => {
                          const next = prev.slice();
                          next[editingIndex] = parsedHex;
                          return next;
                        });
                        setEditingIndex(null);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        closeEditor();
                      }
                    }}
                  />
                </div>
                {!isValidHex && (
                  <div className="text-xs text-danger">Use #RRGGBB or #RGB.</div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                className="rounded border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
                type="button"
                onClick={closeEditor}
              >
                Cancel
              </button>
              <button
                className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground shadow-sm transition-opacity disabled:opacity-50"
                type="button"
                disabled={!isValidHex}
                onClick={() => {
                  if (editingIndex === null || !isValidHex) return;
                  const nextHex = parsedHex!;
                  setPalette((prev) => {
                    const next = prev.slice();
                    next[editingIndex] = nextHex;
                    return next;
                  });
                  setEditingIndex(null);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) return <>{content}</>;

  return (
    <details open className="mb-4">
      <summary className="cursor-pointer select-none text-sm font-semibold mb-2">Palette</summary>
      {content}
    </details>
  );
}
