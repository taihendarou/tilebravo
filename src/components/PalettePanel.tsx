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
};

export default function PalettePanel({
  palette,
  currentColor,
  setPalette,
  setCurrentColor,
}: Props) {
  // Refs para disparar o <input type="color" /> ao dar duplo clique no swatch
  const paletteInputRefs = useRef<HTMLInputElement[]>([]);

  return (
    <details open className="mb-4">
      <summary className="cursor-pointer select-none text-sm font-semibold mb-2">
        Palette
      </summary>

      {/* Swatches em grid 4 colunas. Clique seleciona. Duplo clique abre picker. */}
      <div className="grid grid-cols-4 gap-3 mb-2">
        {palette.map((c, i) => (
          <div key={`sw-${i}`} className="flex flex-col items-center">
            <div
              role="button"
              aria-label={`Color ${i}`}
              title={`Color ${i}`}
              onClick={() => setCurrentColor(i)}
              onDoubleClick={() => paletteInputRefs.current[i]?.click()}
              style={{
                width: 48,
                height: 48,
                background: c,
                border: "2px solid",
                borderColor: i === currentColor ? "#111" : "#ccc",
                borderRadius: 6,
                cursor: "pointer",
              }}
            />
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
    </details>
  );
}
