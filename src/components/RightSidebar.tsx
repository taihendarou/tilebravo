// src/components/RightSidebar.tsx
"use client";
import React, { useRef } from "react";
import PalettePanel from "./PalettePanel";
import { CODECS } from "../lib/codecs";
import type { CodecId } from "../lib/codecs";
import { ChevronLeft, ChevronRight, Download, Plus, Copy, Upload, Trash, RotateCcw, ChevronDown } from "lucide-react";

interface Props {
  codec: CodecId;
  setCodec: React.Dispatch<React.SetStateAction<CodecId>>;
  baseOffsetHex: string;
  setBaseOffsetHex: React.Dispatch<React.SetStateAction<string>>;
  tileStrideBytes: number;
  setTileStrideBytes: React.Dispatch<React.SetStateAction<number>>;
  tilesCount: number;
  onResizeTiles: (n: number) => void;
  tilesPerRow: number;
  setTilesPerRow: React.Dispatch<React.SetStateAction<number>>;
  viewportTilesX: number;
  setViewportTilesX: React.Dispatch<React.SetStateAction<number>>;
  viewportTilesY: number;
  setViewportTilesY: React.Dispatch<React.SetStateAction<number>>;
  showTileGrid: boolean;
  setShowTileGrid: React.Dispatch<React.SetStateAction<boolean>>;
  showPixelGrid: boolean;
  setShowPixelGrid: React.Dispatch<React.SetStateAction<boolean>>;
  palette: string[];
  currentColor: number;
  setPalette: React.Dispatch<React.SetStateAction<string[]>>;
  setCurrentColor: (index: number) => void;
  onReDecode: () => void;
  // layout
  rowInterleaved?: boolean;
  setRowInterleaved?: (v: boolean) => void;
  // palette manager
  paletteName?: string;
  setPaletteName?: (name: string) => void;
  paletteIndex?: number;
  paletteTotal?: number;
  onPrevPalette?: () => void;
  onNextPalette?: () => void;
  onExportPalette?: () => void;
  onNewPalette?: () => void;
  onDuplicatePalette?: () => void;
  onDeletePalette?: () => void;
  onImportPalette?: (data: { name?: string; colors: string[] }) => void;
  onResetPalettes?: () => void;
  // navigation
  onTileBack?: () => void;
  onTileForward?: () => void;
  onGoToOffset?: (offsetBytes: number) => void;
  setGoToOpener?: (fn: () => void) => void;
}

export default function RightSidebar(props: Props) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const gotoInputRef = useRef<HTMLInputElement | null>(null);
  const docDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const navDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const palDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const [gotoValue, setGotoValue] = React.useState("0x0");
  const { setGoToOpener } = props;

  // Expose opener for Cmd/Ctrl+G: focus the inline input
  React.useEffect(() => {
    if (setGoToOpener) {
      setGoToOpener(() => {
        if (navDetailsRef.current) {
          navDetailsRef.current.open = true;
        }
        gotoInputRef.current?.focus();
        gotoInputRef.current?.select();
      });
    }
  }, [setGoToOpener]);
  const {
    codec,
    setCodec,
    tileStrideBytes,
    setTileStrideBytes,
    tilesPerRow,
    setTilesPerRow,
    viewportTilesX,
    setViewportTilesX,
    viewportTilesY,
    setViewportTilesY,
    showTileGrid,
    setShowTileGrid,
    showPixelGrid,
    setShowPixelGrid,
    rowInterleaved,
    setRowInterleaved,
    palette,
    currentColor,
    setPalette,
    setCurrentColor,
    onReDecode,
  } = props;

  // Helper for preset palettes removed with the Color scheme dropdown

  const smallBtn = "h-8 px-2 border border-border rounded bg-surface hover:bg-muted inline-flex items-center justify-center";
  const inputBase = "border border-border rounded bg-surface text-foreground px-2 py-1";

  // Minimal toggle only (no DnD, no persistence)

  function renderDocument() {
    return (
      <details ref={docDetailsRef} open className="group rounded-lg border border-border bg-background shadow-sm">
        <summary className="px-3 py-2 cursor-pointer select-none flex items-center justify-between">
          <h3 className="text-base font-semibold">Document</h3>
          <ChevronDown size={16} className="opacity-70 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-3 pb-3 space-y-3">
          <div className="flex items-center gap-2 min-w-0">
            <label className="text-xs w-28">Format</label>
            <select
              value={codec}
              onChange={e => {
                const cid = e.target.value as CodecId;
                const c = CODECS[cid];
                if (!c) {
                  console.warn("Unknown codec id selected:", cid);
                  return;
                }
                setCodec(cid);
                setTileStrideBytes(prev => Math.max(c.bytesPerTile, prev | 0));
                if (c.pixelMode === "indexed") {
                  const colors = c.colors ?? (1 << c.bpp);
                  const fallback = Array.from({ length: colors }, (_, i) => {
                    const t = colors === 1 ? 0 : i / (colors - 1);
                    const v = Math.round(255 * t);
                    const hex = v.toString(16).padStart(2, "0");
                    return `#${hex}${hex}${hex}`.toUpperCase();
                  });
                  setPalette(c.defaultPalette ?? fallback);
                } else {
                  setPalette([]);
                }
              }}
              className={`${inputBase} flex-1 min-w-0 max-w-full truncate`}
              title="Choose how bytes map to pixels."
            >
              <option value="1bpp_linear">1bpp</option>

              <option value="2bpp_planar">2bpp planar (NES, GB)</option>
              <option value="2bpp_planar_composite">2bpp planar composite (NES variants)</option>
              <option value="2bpp_linear">2bpp linear (NG Pocket)</option>
              <option value="2bpp_chunky_zip16">2bpp chunky Zip16</option>

              <option value="4bpp_planar">4bpp planar (SNES, MD, SMS, GG)</option>
              <option value="4bpp_linear">4bpp linear (MD, X68000)</option>
              <option value="4bpp_linear_reverse">4bpp linear reverse (GBA, Virtual Boy)</option>
              <option value="4bpp_chunky_zip16">4bpp chunky Zip16</option>

              <option value="8bpp_planar">8bpp planar (SNES Mode 3/4)</option>
              <option value="8bpp_linear">8bpp linear (GBA, NDS)</option>


            </select>
          </div>
          <div className="text-xs opacity-70">Choose how bytes map to pixels.</div>

          <div className="flex items-center gap-2">
            <label className="text-xs w-28">Stride (bytes)</label>
            <input
              className={`${inputBase} font-mono w-28`}
              type="number"
              min={CODECS[codec].bytesPerTile}
              step={1}
              value={tileStrideBytes}
              onChange={e => setTileStrideBytes(parseInt(e.target.value || String(CODECS[codec].bytesPerTile)))}
              onBlur={onReDecode}
              onKeyDown={(e) => e.key === "Enter" && onReDecode()}
              title="Advance between consecutive tiles. Increase when the file has padding."
            />
          </div>
          <div className="text-xs opacity-70">Advance between consecutive tiles; larger when file has padding.</div>

          <div className="flex items-center gap-2">
            <label className="text-xs w-28">Total tiles</label>
            <input
              className={`${inputBase} w-28 opacity-70`}
              value={props.tilesCount}
              readOnly
              title="Total number of tiles in the document"
            />
          </div>
        </div>
      </details>
    );
  }

  function renderNavigation() {
    return (
      <details ref={navDetailsRef} open className="group rounded-lg border border-border bg-background shadow-sm">
        <summary className="px-3 py-2 cursor-pointer select-none flex items-center justify-between">
          <h3 className="text-base font-semibold">Navigation</h3>
          <ChevronDown size={16} className="opacity-70 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-3 pb-3 space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs w-28">Go to</label>
            <input
              ref={gotoInputRef}
              className={`${inputBase} font-mono h-8 w-32`}
              value={gotoValue}
              onChange={(e) => {
                const v = e.target.value || "";
                const cleaned = v.replace(/^0x/i, "").replace(/[^0-9a-fA-F]/g, "").toUpperCase();
                setGotoValue("0x" + (cleaned || "0"));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const cleaned = gotoValue.replace(/^0x/i, "");
                  const num = parseInt(cleaned || "0", 16);
                  if (!Number.isNaN(num)) props.onGoToOffset?.(num);
                }
              }}
              placeholder="0x0"
              title="Enter a hex address to jump to."
            />
            <button
              className={smallBtn}
              onClick={() => {
                const cleaned = gotoValue.replace(/^0x/i, "");
                const num = parseInt(cleaned || "0", 16);
                if (!Number.isNaN(num)) props.onGoToOffset?.(num);
              }}
              title="Align view so the target tile becomes the first in the row."
            >
              Go
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs w-28">Tile stepping</label>
            <div className="flex items-center gap-2">
              <button
                className={smallBtn}
                title="Move one tile backward"
                aria-label="Tile Back"
                onClick={() => props.onTileBack?.()}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className={smallBtn}
                title="Move one tile forward"
                aria-label="Tile Forward"
                onClick={() => props.onTileForward?.()}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs w-28">Columns</label>
            <input
              className={`${inputBase} w-24`}
              type="number"
              min={1}
              max={256}
              value={tilesPerRow}
              onChange={e => setTilesPerRow(parseInt(e.target.value || "16"))}
              title="Grid width in tiles"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs w-28">Viewport</label>
            <input
              className={`${inputBase} w-20`}
              type="number"
              min={1}
              max={256}
              value={viewportTilesX}
              onChange={e => setViewportTilesX(parseInt(e.target.value || "16"))}
              title="Viewport width (tiles)"
            />
            <span className="text-xs opacity-60">x</span>
            <input
              className={`${inputBase} w-20`}
              type="number"
              min={1}
              max={256}
              value={viewportTilesY}
              onChange={e => setViewportTilesY(parseInt(e.target.value || "16"))}
              title="Viewport height (tiles)"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs w-28">Grid options</label>
            <div className="flex items-center gap-4">
              <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={showTileGrid} onChange={e => setShowTileGrid(e.target.checked)} /> Show tile grid</label>
              <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={showPixelGrid} onChange={e => setShowPixelGrid(e.target.checked)} /> Show pixel grid</label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!rowInterleaved}
                onChange={e => setRowInterleaved?.(e.target.checked)}
              />
              8×16 mode (row-interleaved)
            </label>
          </div>
        </div>
      </details>
    );
  }

  function renderPalette() {
    return (
      <details ref={palDetailsRef} open className="group rounded-lg border border-border bg-background shadow-sm">
        <summary className="px-3 py-2 cursor-pointer select-none flex items-center justify-between">
          <h3 className="text-base font-semibold">Palette</h3>
          <ChevronDown size={16} className="opacity-70 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-3 pb-3 space-y-3">
          {/* Name + navigation */}
          <div className="flex items-center gap-2">
            <button
              className={smallBtn}
              onClick={() => props.onPrevPalette?.()}
              title="Previous palette"
              aria-label="Previous palette"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              className={`${inputBase} flex-1`}
              placeholder="Palette name"
              value={props.paletteName ?? ""}
              onChange={(e) => props.setPaletteName?.(e.target.value)}
              title="Palette name"
            />
            <button
              className={smallBtn}
              onClick={() => props.onNextPalette?.()}
              title="Next palette"
              aria-label="Next palette"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {typeof props.paletteIndex === "number" && typeof props.paletteTotal === "number" && (
            <div className="text-xs opacity-70">{props.paletteIndex + 1} / {props.paletteTotal}</div>
          )}

          {/* Color scheme dropdown removed to avoid redundancy */}

          {/* Actions toolbar */}
          <div className="flex items-center gap-2">
            <button className={smallBtn} onClick={() => props.onNewPalette?.()} title="Create new palette"><Plus size={14} /></button>
            <button className={smallBtn} onClick={() => props.onDuplicatePalette?.()} title="Duplicate current palette"><Copy size={14} /></button>
            <button className={smallBtn} onClick={() => importInputRef.current?.click()} title="Import palette (TileBravo JSON)"><Upload size={14} /></button>
            <button className={`${smallBtn} text-danger border-danger`} onClick={() => { if (window.confirm("Delete current palette? This cannot be undone.")) props.onDeletePalette?.(); }} title="Delete current palette"><Trash size={14} /></button>
            <button className={smallBtn} onClick={() => { if (window.confirm("Reset all palettes to TileBravo defaults? Unsaved custom palettes will be lost.")) props.onResetPalettes?.(); }} title="Restore default palette"><RotateCcw size={14} /></button>
            <button className={smallBtn} onClick={() => props.onExportPalette?.()} title="Export palette to file"><Download size={14} /></button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const txt = await f.text();
                  const data = JSON.parse(txt);
                  props.onImportPalette?.(data);
                } catch {
                  alert("Failed to import palette. Make sure it's TileBravo JSON format: { name: string, colors: string[] }.");
                } finally {
                  if (importInputRef.current) importInputRef.current.value = "";
                }
              }}
              title="Import palette in TileBravo JSON format"
            />
          </div>

          {/* Swatches */}
          <PalettePanel
            palette={palette}
            currentColor={currentColor}
            setPalette={setPalette}
            setCurrentColor={setCurrentColor}
            embedded
          />
          <div className="text-xs opacity-70">Click to select. Double-click to edit color.</div>
        </div>
      </details>
    );
  }

  return (
    <aside className="border-l border-border p-3 pb-10 overflow-y-auto scroll-area bg-background text-foreground space-y-4">
      {renderDocument()}
      {renderNavigation()}
      {renderPalette()}
    </aside>
  );
}
