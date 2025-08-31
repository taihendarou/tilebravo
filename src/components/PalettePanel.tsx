// src/components/PalettePanel.tsx
"use client";
import React, { useRef } from "react";

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
  // Refs para disparar o <input type="color" /> ao dar duplo clique no swatch
  const paletteInputRefs = useRef<HTMLInputElement[]>([]);

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
              onDoubleClick={() => paletteInputRefs.current[i]?.click()}
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

      {/* Pickers escondidos. Duplo clique no swatch abre. */}
      <div className="flex items-center gap-2">
        {palette.map((c, i) => (
          <input
            key={`in-${i}`}
            ref={(el) => {
              if (el) paletteInputRefs.current[i] = el;
            }}
            type="color"
            value={c}
            onChange={(e) => {
              const v = e.target.value;
              setPalette((prev) => {
                const next = prev.slice();
                next[i] = v;
                return next;
              });
            }}
            style={{ display: "none" }}
          />
        ))}
      </div>

      <div className="text-xs opacity-70 mt-2">
        Click to select. Double-click to edit the color. Shortcuts 0–9 select
        colors when available.
      </div>
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
