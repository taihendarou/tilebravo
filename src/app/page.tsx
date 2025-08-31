"use client";

// React
import { useEffect, useMemo, useRef, useState } from "react";

// Components
import StatusBar from "../components/StatusBar";
import Toolbox from "../components/Toolbox";
import RightSidebar from "../components/RightSidebar";

// Libs
import { TILE_W, TILE_H } from "../lib/constants";
import type { CodecId } from "../lib/codecs";
import { CODECS } from "../lib/codecs";
import { computeOffsets } from "../lib/offsets";
import { toHex } from "../lib/utils/hex";
import { renderCanvas } from "../lib/render";

type ToolId = "select" | "pencil" | "eyedropper" | "line" | "bucket";
type PaletteDef = { name: string; colors: string[] };
type Selection = { x: number; y: number; w: number; h: number } | null;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function normRect(a: { x: number; y: number }, b: { x: number; y: number }) {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x, b.x);
  const y2 = Math.max(a.y, b.y);
  return { x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 };
}
function getTileIndex(tx: number, ty: number, tilesPerRow: number) {
  return ty * tilesPerRow + tx;
}

/** Decode genérico com stride usando o codec selecionado. */
function decodeWithStride(
  bytes: Uint8Array,
  baseOffset: number,
  stride: number,
  codecId: CodecId
): Uint8Array[] {
  const codec = CODECS[codecId];
  const tiles: Uint8Array[] = [];
  const end = bytes.length;
  const step = Math.max(codec.bytesPerTile, stride | 0);
  let base = Math.max(0, baseOffset | 0);

  while (base + codec.bytesPerTile <= end) {
    const slice = bytes.subarray(base, base + codec.bytesPerTile);
    tiles.push(codec.decodeTile(slice));
    base += step;
  }
  return tiles;
}

function createBlankFile(tileCount: number, codecId: CodecId): Uint8Array {
  const codec = CODECS[codecId];
  const tile = new Uint8Array(TILE_W * TILE_H); // todos = 0
  const encoded = codec.encodeTile(tile);

  const out = new Uint8Array(tileCount * codec.bytesPerTile);
  for (let i = 0; i < tileCount; i++) {
    out.set(encoded, i * codec.bytesPerTile);
  }
  return out;
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const innerViewportRef = useRef<HTMLDivElement | null>(null);
  const openGoToRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pngInputRef = useRef<HTMLInputElement | null>(null);
  const [isViewportFocused, setIsViewportFocused] = useState(false);

  // Ferramenta
  const [tool, setTool] = useState<ToolId>("pencil");

  // Codec
  const [codec, setCodec] = useState<CodecId>("2bpp_planar");

  // Paletas (múltiplas) e edição
  const [palettes, setPalettes] = useState<PaletteDef[]>([]);
  const [currentPaletteIndex, setCurrentPaletteIndex] = useState<number>(0);
  const palette: string[] = useMemo(
    () => palettes[currentPaletteIndex]?.colors ?? [],
    [palettes, currentPaletteIndex]
  );

  const [currentColor, setCurrentColor] = useState<number>(0); // índice 0..3

  const [tiles, setTiles] = useState<Uint8Array[]>([]);

  // Arquivo carregado bruto e nome
  const [rawBytes, setRawBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>("");

  // Decode
  const [baseOffsetHex, setBaseOffsetHex] = useState("0");
  const [tileStrideBytes, setTileStrideBytes] = useState<number>(CODECS["2bpp_planar"].bytesPerTile);

  // View
  const [tilesPerRow, setTilesPerRow] = useState<number>(16);
  const [pixelSize, setPixelSize] = useState<number>(4);
  const [viewportTilesX, setViewportTilesX] = useState<number>(16);
  const [viewportTilesY, setViewportTilesY] = useState<number>(16);
  const [showTileGrid, setShowTileGrid] = useState<boolean>(true);
  const [showPixelGrid, setShowPixelGrid] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [linePreviewEnd, setLinePreviewEnd] = useState<{ ax: number; ay: number } | null>(null);
  const [columnShift, setColumnShift] = useState<number>(0);
  // Loading overlay ao abrir arquivo grande
  const [isLoading, setIsLoading] = useState(false);
  const loadingMinEndAtRef = useRef<number | null>(null);


  // Seleção e clipboard
  const [selection, setSelection] = useState<Selection>(null);
  const selectionDragRef = useRef<{
    mode: "none" | "new" | "move";
    startTX: number;
    startTY: number;
    startSel: Selection;
    previewDX: number;
    previewDY: number;
  }>({ mode: "none", startTX: 0, startTY: 0, startSel: null, previewDX: 0, previewDY: 0 });
  // Throttle de seleção: aplica setSelection no máximo 1x por frame
  const selectionRafPendingRef = useRef(false);
  const selectionDraftRef = useRef<Selection>(null);

  // Status bar
  const [hoverInfo, setHoverInfo] = useState<{
    tileOffsetHex: string | null;
    pixelOffsetHex: string | null;
    pixelColorHex: string | null;
    pixelColorIndex: number | null;
  }>({ tileOffsetHex: null, pixelOffsetHex: null, pixelColorHex: null, pixelColorIndex: null });

  const clipboardRef = useRef<{
    tiles: Uint8Array[];
    w: number;
    h: number;
  } | null>(null);

  // desenho/pencil arraste
  const pencilRef = useRef<{
    drawing: boolean;
    lastPX: number;
    lastPY: number;
  }>({ drawing: false, lastPX: -1, lastPY: -1 });

  // line tool: guarda início em pixels absolutos (na grade inteira)
  const lineRef = useRef<{ drawing: boolean; startAX: number; startAY: number }>({ drawing: false, startAX: 0, startAY: 0 });
  // Throttle para preview da ferramenta de linha (1x por frame)
  const lineRafPendingRef = useRef(false);
  const lineDraftRef = useRef<{ ax: number; ay: number } | null>(null);

  // Inicializar arquivo em branco se nenhum estiver aberto
  useEffect(() => {
    if (!rawBytes) {
      const blank = createBlankFile(16 * 16, codec); // 256 tiles
      setRawBytes(blank);
      setFileName("untitled.bin");
    }
  }, [rawBytes, codec]);

  // mantém currentColor dentro do range caso a paleta mude
  useEffect(() => {
    const maxIndex = Math.max(0, palette.length - 1);
    if (currentColor > maxIndex) setCurrentColor(maxIndex);
    if (currentColor < 0) setCurrentColor(0);
  }, [palette, currentColor]);


  // Desenho
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (tiles.length > 0) {
      renderCanvas(ctx, {
        tiles,
        palette,
        tilesPerRow,
        pixelSize,
        columnShift,
        showTileGrid,
        showPixelGrid,
        selection: selection ?? undefined,
        selectionPreview:
          selection && selectionDragRef.current.mode === "move"
            ? { dx: selectionDragRef.current.previewDX, dy: selectionDragRef.current.previewDY }
            : null,
        linePreview:
          tool === "line" && lineRef.current.drawing && linePreviewEnd
            ? { ax1: lineRef.current.startAX, ay1: lineRef.current.startAY, ax2: linePreviewEnd.ax, ay2: linePreviewEnd.ay, colorIndex: clamp(currentColor, 0, Math.max(0, palette.length - 1)) }
            : null,
      });
    } else {
      ctx.canvas.width = viewportTilesX * TILE_W * pixelSize;
      ctx.canvas.height = viewportTilesY * TILE_H * pixelSize;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  }, [tiles, palette, tilesPerRow, pixelSize, showTileGrid, showPixelGrid, viewportTilesX, viewportTilesY, selection, linePreviewEnd, tool, columnShift, currentColor]);

  // Re-decode ao mudar arquivo ou parâmetros
  useEffect(() => {
    if (!rawBytes) return;
    if (!codec) {
      setTiles([]);
      return;
    }
    reDecode();
  }, [rawBytes, codec]);

  // Helpers de paleta
  function makeGrayscale(n: number): string[] {
    return Array.from({ length: n }, (_, i) => {
      const t = n === 1 ? 0 : i / (n - 1);
      const v = Math.round(255 * t).toString(16).padStart(2, "0");
      return `#${v}${v}${v}`.toUpperCase();
    });
  }
  function gradient(n: number, from: [number, number, number], to: [number, number, number]): string[] {
    return Array.from({ length: n }, (_, i) => {
      const t = n === 1 ? 0 : i / (n - 1);
      const r = Math.round(from[0] + (to[0] - from[0]) * t);
      const g = Math.round(from[1] + (to[1] - from[1]) * t);
      const b = Math.round(from[2] + (to[2] - from[2]) * t);
      const hx = (x: number) => x.toString(16).padStart(2, "0");
      return `#${hx(r)}${hx(g)}${hx(b)}`.toUpperCase();
    });
  }
  function defaultPalettesFor(n: number): PaletteDef[] {
    // helpers
    const reverse = (arr: string[]) => arr.slice().reverse();
    const clampN = (arr: string[]) => arr.slice(0, n);

    if (n <= 4) {
      const gray = makeGrayscale(4);
      return [
        { name: "Grayscale", colors: clampN(gray) },
        { name: "Grayscale Inverted", colors: clampN(reverse(gray)) },
        { name: "GameBoy", colors: clampN(["#0F380F", "#306230", "#8BAC0F", "#9BBC0F"]) },
        { name: "Primary Contrast", colors: clampN(["#000000", "#FF0000", "#00FF00", "#0000FF"]) },
        { name: "Blue/Orange", colors: clampN(["#0B1E3B", "#E76F51", "#2A9D8F", "#FFFFFF"]) },
      ];
    }
    // 16 cores
    if (n <= 16) {
      const gray16 = makeGrayscale(16);
      const cool = gradient(16, [10, 20, 60], [180, 220, 255]);
      const warm = gradient(16, [60, 20, 10], [255, 220, 180]);
      const rainbow = Array.from({ length: 16 }, (_, i) => {
        const h = (i / 16) * 360;
        const s = 90, v = 95;
        const c = (v / 100) * (s / 100);
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = (v / 100) - c;
        let r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        const toHex = (f: number) => Math.round((f + m) * 255).toString(16).padStart(2, "0");
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
      });
      return [
        { name: "Grayscale", colors: gray16.slice(0, n) },
        { name: "Grayscale Inverted", colors: reverse(gray16).slice(0, n) },
        { name: "Rainbow", colors: rainbow.slice(0, n) },
        { name: "Cool → Light", colors: cool.slice(0, n) },
        { name: "Warm ← Dark", colors: reverse(warm).slice(0, n) },
      ];
    }
    // fallback generic
    return [{ name: "Grayscale", colors: makeGrayscale(n) }];
  }

  // Inicializar paletas a partir do codec/prefs
  useEffect(() => {
    // tentar carregar do storage
    try {
      const raw = localStorage.getItem("tilebravo:palettes");
      const rawIdx = localStorage.getItem("tilebravo:palettes:index");
      const c = CODECS[codec];
      const n = c.pixelMode === "indexed" ? (c.colors ?? (1 << c.bpp)) : 0;
      if (raw) {
        const parsed = JSON.parse(raw) as PaletteDef[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // se tamanho não bate, regen defaults
          if (parsed[0].colors.length !== n && n > 0) {
            const defs = defaultPalettesFor(n);
            setPalettes(defs);
            setCurrentPaletteIndex(0);
          } else {
            setPalettes(parsed);
            setCurrentPaletteIndex(Math.max(0, Math.min(parsed.length - 1, parseInt(rawIdx || "0", 10) || 0)));
          }
          return;
        }
      }
      // sem storage: defaults
      if (n > 0) {
        const defs = defaultPalettesFor(n);
        setPalettes(defs);
        setCurrentPaletteIndex(0);
      }
    } catch {
      // noop
    }
  }, [codec]);

  // atalhos. Cmd/Ctrl+C/V já existem abaixo. Aqui 1..4 e B, V, I.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // não capturar quando o foco estiver em inputs
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }

      // 0..9 escolhe cor
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 0 && num <= 9 && num < palette.length) {
        setCurrentColor(num);
      }

      // atalhos de ferramenta sem modificadores
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "b") { setTool("pencil"); e.preventDefault(); return; }
        if (k === "v") { setTool("select"); e.preventDefault(); return; }
        if (k === "i") { setTool("eyedropper"); e.preventDefault(); return; }
        if (k === "l") { setTool("line"); e.preventDefault(); return; }
        if (k === "g") { setTool("bucket"); e.preventDefault(); return; }
      }

      // Zoom in / out
      if (e.key === "=" || e.key === "+") {
        setPixelSize((p) => Math.max(1, Math.min(64, (p || 1) + 1)));
        e.preventDefault();
      }
      if (e.key === "-" || e.key === "_") {
        setPixelSize((p) => Math.max(1, Math.min(64, (p || 1) - 1)));
        e.preventDefault();
      }

      // copiar
      const meta = e.metaKey || e.ctrlKey;
      // Go to dialog
      if (meta && e.key.toLowerCase() === "g") {
        e.preventDefault();
        openGoToRef.current?.();
        return;
      }
      if (meta && e.key.toLowerCase() === "c") {
        if (!selection) return;
        const { x, y, w, h } = selection;
        const copied: Uint8Array[] = [];
        for (let ty = 0; ty < h; ty++) {
          for (let tx = 0; tx < w; tx++) {
            const idx = (y + ty) * tilesPerRow + (x + tx);
            if (idx >= 0 && idx < tiles.length) {
              copied.push(new Uint8Array(tiles[idx]));
            }
          }
        }
        clipboardRef.current = { tiles: copied, w, h };
        e.preventDefault();
      }

      // colar só quando o viewport estiver focado
      if (meta && e.key.toLowerCase() === "v") {
        if (!isViewportFocused) return;
        const clip = clipboardRef.current;
        if (!clip) return;
        const targetX = selection ? selection.x : 0;
        const targetY = selection ? selection.y : 0;
        setTiles(prev => {
          const next = prev.slice();
          for (let ty = 0; ty < clip.h; ty++) {
            for (let tx = 0; tx < clip.w; tx++) {
              const dstX = targetX + tx;
              const dstY = targetY + ty;
              if (dstX < 0 || dstY < 0) continue;
              const dstIndex = dstY * tilesPerRow + dstX;
              if (dstIndex >= 0 && dstIndex < next.length) {
                const srcIndex = ty * clip.w + tx;
                next[dstIndex] = new Uint8Array(clip.tiles[srcIndex]);
              }
            }
          }
          return next;
        });
        setIsDirty(true);
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tiles, palette.length, tilesPerRow, pixelSize, showTileGrid, showPixelGrid, selection, isViewportFocused]);

  function reDecode() {
    if (!rawBytes) return;
    const baseOffset = parseInt(baseOffsetHex || "0", 16);
    const stride = Math.max(CODECS[codec].bytesPerTile, tileStrideBytes | 0);
    // Tentativa com Web Worker para não travar UI
    try {
      const worker = new Worker(new URL("../workers/decodeWorker.ts", import.meta.url), { type: "module" });
      const bytesBuffer = rawBytes.buffer.slice(0); // copia para evitar detachment
      worker.onmessage = (ev: MessageEvent<{ pixelsBuffer: ArrayBuffer; tilesCount: number }>) => {
        const { pixelsBuffer, tilesCount } = ev.data;
        const pixels = new Uint8Array(pixelsBuffer);
        const tileSize = TILE_W * TILE_H; // 64
        const out: Uint8Array[] = new Array(tilesCount);
        for (let i = 0; i < tilesCount; i++) {
          out[i] = pixels.subarray(i * tileSize, (i + 1) * tileSize);
        }
        setTiles(out);
        worker.terminate();
        const endAt = loadingMinEndAtRef.current;
        if (isLoading && endAt) {
          const remain = Math.max(0, endAt - Date.now());
          setTimeout(() => setIsLoading(false), remain);
          loadingMinEndAtRef.current = null;
        }
      };
      worker.onerror = () => {
        worker.terminate();
        // fallback síncrono
        const decoded = decodeWithStride(
          rawBytes,
          isNaN(baseOffset) ? 0 : baseOffset,
          stride,
          codec
        );
        setTiles(decoded);
        const endAt = loadingMinEndAtRef.current;
        if (isLoading && endAt) {
          const remain = Math.max(0, endAt - Date.now());
          setTimeout(() => setIsLoading(false), remain);
          loadingMinEndAtRef.current = null;
        }
      };
      worker.postMessage({ bytesBuffer, baseOffset: isNaN(baseOffset) ? 0 : baseOffset, stride, codec });
    } catch {
      // fallback síncrono
      const decoded = decodeWithStride(
        rawBytes,
        isNaN(baseOffset) ? 0 : baseOffset,
        stride,
        codec
      );
      setTiles(decoded);
      const endAt = loadingMinEndAtRef.current;
      if (isLoading && endAt) {
        const remain = Math.max(0, endAt - Date.now());
        setTimeout(() => setIsLoading(false), remain);
        loadingMinEndAtRef.current = null;
      }
    }
  }

  // Abrir arquivo
  async function handleFile(file: File) {
    // Se arquivo > 256 bytes, mostra overlay por pelo menos 3s
    if (file.size > 256) {
      setIsLoading(true);
      loadingMinEndAtRef.current = Date.now() + 1500;
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    setFileName(file.name);
    setRawBytes(buf);
    setSelection(null);
    setIsDirty(false);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  // Mouse helpers
  function getTileCoordsFromMouse(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / pixelSize);
    const y = Math.floor((e.clientY - rect.top) / pixelSize);
    const tx = Math.floor(x / TILE_W);
    const ty = Math.floor(y / TILE_H);
    return { tx, ty, px: x % TILE_W, py: y % TILE_H };
  }

  function samplePixelValue(tx: number, ty: number, px: number, py: number): number | null {
    const tileIndex = ty * tilesPerRow + tx;
    if (tileIndex < 0 || tileIndex >= tiles.length) return null;
    const idxInTile = py * TILE_W + px;
    return tiles[tileIndex][idxInTile];
  }

  // Paint bucket (flood fill 4-directions) over absolute pixel grid
  function bucketFill(axStart: number, ayStart: number) {
    setTiles(prev => {
      const width = tilesPerRow * TILE_W;
      const rowsTotal = Math.ceil(prev.length / tilesPerRow);
      const height = rowsTotal * TILE_H;
      if (axStart < 0 || ayStart < 0 || axStart >= width || ayStart >= height) return prev;

      // Read target color from original data
      const tx0 = Math.floor(axStart / TILE_W);
      const ty0 = Math.floor(ayStart / TILE_H);
      const idx0 = ty0 * tilesPerRow + tx0;
      if (idx0 < 0 || idx0 >= prev.length) return prev;
      const px0 = axStart % TILE_W;
      const py0 = ayStart % TILE_H;
      const target = prev[idx0][py0 * TILE_W + px0];
      const replacement = clamp(currentColor, 0, Math.max(0, palette.length - 1));
      if (target === replacement) return prev;

      const next = prev.slice();
      const changed = new Map<number, Uint8Array>();

      const visited = new Uint8Array(width * height);
      const q = new Int32Array(width * height);
      let head = 0, tail = 0;
      const start = ayStart * width + axStart;
      visited[start] = 1;
      q[tail++] = start;

      const getOrig = (ax: number, ay: number): number | null => {
        if (ax < 0 || ay < 0 || ax >= width || ay >= height) return null;
        const tx = Math.floor(ax / TILE_W);
        const ty = Math.floor(ay / TILE_H);
        const idx = ty * tilesPerRow + tx;
        if (idx < 0 || idx >= prev.length) return null;
        const px = ax % TILE_W;
        const py = ay % TILE_H;
        return prev[idx][py * TILE_W + px];
      };

      const setNew = (ax: number, ay: number) => {
        const tx = Math.floor(ax / TILE_W);
        const ty = Math.floor(ay / TILE_H);
        const idx = ty * tilesPerRow + tx;
        let tile = changed.get(idx);
        if (!tile) {
          tile = new Uint8Array(next[idx]);
          changed.set(idx, tile);
        }
        const px = ax % TILE_W;
        const py = ay % TILE_H;
        tile[py * TILE_W + px] = replacement;
      };

      while (head < tail) {
        const p = q[head++];
        const ax = p % width;
        const ay = Math.floor(p / width);
        const c = getOrig(ax, ay);
        if (c == null || c !== target) continue;
        setNew(ax, ay);
        // push neighbors 4-dir
        if (ax + 1 < width) {
          const np = ay * width + (ax + 1);
          if (!visited[np]) { visited[np] = 1; q[tail++] = np; }
        }
        if (ax - 1 >= 0) {
          const np = ay * width + (ax - 1);
          if (!visited[np]) { visited[np] = 1; q[tail++] = np; }
        }
        if (ay + 1 < height) {
          const np = (ay + 1) * width + ax;
          if (!visited[np]) { visited[np] = 1; q[tail++] = np; }
        }
        if (ay - 1 >= 0) {
          const np = (ay - 1) * width + ax;
          if (!visited[np]) { visited[np] = 1; q[tail++] = np; }
        }
      }

      for (const [i, t] of changed) next[i] = t;
      return next;
    });
    setIsDirty(true);
  }

  // desenha uma linha entre dois pixels absolutos (Bresenham), respeitando bordas
  function drawLine(ax1: number, ay1: number, ax2: number, ay2: number) {
    setTiles(prev => {
      const next = prev.slice();
      const changed = new Map<number, Uint8Array>();

      let x1 = Math.floor(ax1), y1 = Math.floor(ay1);
      const x2 = Math.floor(ax2), y2 = Math.floor(ay2);
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      const sx = x1 < x2 ? 1 : -1;
      const sy = y1 < y2 ? 1 : -1;
      let err = dx - dy;

      const rowsTotal = Math.ceil(prev.length / tilesPerRow);
      const maxAX = tilesPerRow * TILE_W - 1;
      const maxAY = rowsTotal * TILE_H - 1;
      const color = clamp(currentColor, 0, Math.max(0, palette.length - 1));

      function plot(ax: number, ay: number) {
        if (ax < 0 || ay < 0 || ax > maxAX || ay > maxAY) return;
        const tx = Math.floor(ax / TILE_W);
        const ty = Math.floor(ay / TILE_H);
        const idx = ty * tilesPerRow + tx;
        if (idx < 0 || idx >= next.length) return;
        let tile = changed.get(idx);
        if (!tile) {
          tile = new Uint8Array(next[idx]);
          changed.set(idx, tile);
        }
        const px = ax % TILE_W;
        const py = ay % TILE_H;
        tile[py * TILE_W + px] = color;
      }

      for (; ;) {
        plot(x1, y1);
        if (x1 === x2 && y1 === y2) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x1 += sx; }
        if (e2 < dx) { err += dx; y1 += sy; }
      }

      for (const [i, t] of changed) next[i] = t;
      return next;
    });
    setIsDirty(true);
  }

  // Pencil escreve currentColor
  function pencilApply(px: number, py: number, tx: number, ty: number) {
    const tileIndex = ty * tilesPerRow + tx;
    if (tileIndex < 0 || tileIndex >= tiles.length) return;
    const idxInTile = py * TILE_W + px;
    setTiles(prev => {
      const next = prev.slice();
      const t = new Uint8Array(next[tileIndex]);
      t[idxInTile] = clamp(currentColor, 0, palette.length - 1);
      next[tileIndex] = t;
      return next;
    });
    setIsDirty(true);
  }

  function isAllBlank(arr: Uint8Array[]): boolean {
    for (const t of arr) {
      for (let i = 0; i < t.length; i++) if (t[i] !== 0) return false;
    }
    return true;
  }

  function resizeTiles(total: number) {
    const cur = tiles.length;
    const n = Math.max(1, Math.floor(total || 1));
    if (n === cur) return;

    if (n < cur) {
      if (!isAllBlank(tiles)) {
        const ok = window.confirm("Reducing the number of tiles may discard data. Proceed?");
        if (!ok) return;
      }
      setTiles(prev => prev.slice(0, n));
      setIsDirty(true);
      return;
    }

    // grow: append blank tiles (all zeros)
    setTiles(prev => {
      const next = prev.slice();
      for (let i = prev.length; i < n; i++) next.push(new Uint8Array(TILE_W * TILE_H));
      return next;
    });
    setIsDirty(true);
  }


  // Canvas events
  const onCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tiles.length === 0) return;
    const { tx, ty, px, py } = getTileCoordsFromMouse(e);
    const ax = tx * TILE_W + px;
    const ay = ty * TILE_H + py;

    // Alt+clique funciona como conta-gotas temporário
    if (e.altKey) {
      const v = samplePixelValue(tx, ty, px, py);
      if (v != null) setCurrentColor(v);
      return;
    }

    if (tool === "eyedropper") {
      const v = samplePixelValue(tx, ty, px, py);
      if (v != null) setCurrentColor(v);
      return;
    }

    if (tool === "pencil") {
      pencilRef.current.drawing = true;
      pencilRef.current.lastPX = px;
      pencilRef.current.lastPY = py;
      pencilApply(px, py, tx, ty);
      return;
    }

    if (tool === "line") {
      lineRef.current.drawing = true;
      lineRef.current.startAX = ax;
      lineRef.current.startAY = ay;
      setLinePreviewEnd({ ax, ay });
      return;
    }

    if (tool === "bucket") {
      bucketFill(ax, ay);
      return;
    }

    if (tool === "select") {
      const insideSel =
        selection &&
        tx >= selection.x &&
        ty >= selection.y &&
        tx < selection.x + selection.w &&
        ty < selection.y + selection.h;

      if (insideSel && selection) {
        // iniciar move
        selectionDragRef.current = {
          mode: "move",
          startTX: tx,
          startTY: ty,
          startSel: selection,
          previewDX: 0,
          previewDY: 0,
        };
      } else {
        // se já existia seleção e clicou fora dela → limpar
        if (selection) {
          setSelection(null);
          selectionDragRef.current.mode = "none";
        } else {
          // iniciar nova seleção
          selectionDragRef.current = {
            mode: "new",
            startTX: clamp(tx, 0, tilesPerRow - 1),
            startTY: clamp(ty, 0, Math.ceil(tiles.length / tilesPerRow) - 1),
            startSel: null,
            previewDX: 0,
            previewDY: 0,
          };
          setSelection({ x: tx, y: ty, w: 1, h: 1 });
        }
      }
    }

  };

  const onCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const mode = selectionDragRef.current.mode;

    // 1) Sempre pegar coords do mouse no começo
    const { tx, ty, px, py } = getTileCoordsFromMouse(e);

    // 2) Calcular offsets para a StatusBar em TODO movimento de mouse
    const draggingSelection = tool === "select" && mode !== "none";
    const drawingPencil = tool === "pencil" && pencilRef.current.drawing;
    const drawingLine = tool === "line" && lineRef.current.drawing;

    if (!draggingSelection && !drawingPencil && !drawingLine) {
      if (tx >= 0 && ty >= 0) {
        const baseOffset = parseInt(baseOffsetHex || "0", 16) || 0;
        const stride = Math.max(CODECS[codec].bytesPerTile, tileStrideBytes | 0);

        const { tileOffset, pixelOffset } = computeOffsets({
          tx,
          ty,
          px,
          py,
          tilesPerRow,
          baseOffset,
          stride,
          codec,
        });

        const v = samplePixelValue(tx, ty, px, py);
        const colorHex = v != null && palette[v] ? String(palette[v]).toUpperCase() : null;
        setHoverInfo({
          tileOffsetHex: toHex(tileOffset),
          pixelOffsetHex: toHex(pixelOffset),
          pixelColorHex: colorHex,
          pixelColorIndex: v != null ? v : null,
        });
      } else {
        setHoverInfo({ tileOffsetHex: null, pixelOffsetHex: null, pixelColorHex: null, pixelColorIndex: null });
      }
    }

    // 3) Lógica do lápis enquanto arrasta
    if (tool === "pencil" && pencilRef.current.drawing) {
      // evita redundância de escrita no mesmo pixel
      if (pencilRef.current.lastPX !== px || pencilRef.current.lastPY !== py) {
        pencilApply(px, py, tx, ty);
        pencilRef.current.lastPX = px;
        pencilRef.current.lastPY = py;
      }
      return;
    }

    // 4) Preview da linha enquanto define ponto final
    if (tool === "line" && lineRef.current.drawing) {
      const ax = tx * TILE_W + px;
      const ay = ty * TILE_H + py;
      lineDraftRef.current = { ax, ay };
      if (!lineRafPendingRef.current) {
        lineRafPendingRef.current = true;
        requestAnimationFrame(() => {
          lineRafPendingRef.current = false;
          if (lineDraftRef.current) setLinePreviewEnd(lineDraftRef.current);
        });
      }
      // não retorna; também atualiza status bar abaixo (já condicionado acima)
    }

    // 5) Lógica do seletor (criar/mover seleção)
    if (tool === "select" && mode !== "none") {
      const maxTy = Math.ceil(tiles.length / tilesPerRow) - 1;

      if (mode === "new") {
        const rect = normRect(
          {
            x: clamp(selectionDragRef.current.startTX, 0, tilesPerRow - 1),
            y: clamp(selectionDragRef.current.startTY, 0, maxTy),
          },
          {
            x: clamp(tx, 0, tilesPerRow - 1),
            y: clamp(ty, 0, maxTy),
          }
        );
        selectionDraftRef.current = rect;
        if (!selectionRafPendingRef.current) {
          selectionRafPendingRef.current = true;
          requestAnimationFrame(() => {
            selectionRafPendingRef.current = false;
            const draft = selectionDraftRef.current;
            if (draft) setSelection(draft);
          });
        }
      } else if (mode === "move" && selectionDragRef.current.startSel) {
        const dx = tx - selectionDragRef.current.startTX;
        const dy = ty - selectionDragRef.current.startTY;
        selectionDragRef.current.previewDX = dx;
        selectionDragRef.current.previewDY = dy;
        if (!selectionRafPendingRef.current) {
          selectionRafPendingRef.current = true;
          requestAnimationFrame(() => {
            selectionRafPendingRef.current = false;
            // forçar re-render do overlay de seleção
            setSelection((prev) => (prev ? { ...prev } : prev));
          });
        }
      }
    }
  };


  const onCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "pencil") {
      pencilRef.current.drawing = false;
      return;
    }

    if (tool === "line") {
      if (lineRef.current.drawing) {
        const { tx, ty, px, py } = getTileCoordsFromMouse(e);
        const ax2 = tx * TILE_W + px;
        const ay2 = ty * TILE_H + py;
        drawLine(lineRef.current.startAX, lineRef.current.startAY, ax2, ay2);
      }
      lineRef.current.drawing = false;
      setLinePreviewEnd(null);
      lineRafPendingRef.current = false;
      lineDraftRef.current = null;
      return;
    }

    const st = selectionDragRef.current;
    if (tool === "select" && st.mode === "move" && st.startSel) {
      const dx = st.previewDX;
      const dy = st.previewDY;
      if (dx !== 0 || dy !== 0) {
        const src = st.startSel;
        setTiles(prev => {
          const next = prev.slice();

          const temp: Uint8Array[] = [];
          for (let j = 0; j < src.h; j++) {
            for (let i = 0; i < src.w; i++) {
              const sIdx = getTileIndex(src.x + i, src.y + j, tilesPerRow);
              temp.push(sIdx >= 0 && sIdx < next.length ? new Uint8Array(next[sIdx]) : new Uint8Array(TILE_W * TILE_H));
            }
          }

          for (let j = 0; j < src.h; j++) {
            for (let i = 0; i < src.w; i++) {
              const sIdx = getTileIndex(src.x + i, src.y + j, tilesPerRow);
              if (sIdx >= 0 && sIdx < next.length) {
                next[sIdx] = new Uint8Array(TILE_W * TILE_H);
              }
            }
          }

          const dstX = clamp(src.x + dx, 0, tilesPerRow - src.w);
          const rowsTotal = Math.ceil(next.length / tilesPerRow);
          const dstY = clamp(src.y + dy, 0, rowsTotal - src.h);

          let k = 0;
          for (let j = 0; j < src.h; j++) {
            for (let i = 0; i < src.w; i++) {
              const dIdx = getTileIndex(dstX + i, dstY + j, tilesPerRow);
              if (dIdx >= 0 && dIdx < next.length) {
                next[dIdx] = temp[k++];
              } else {
                k++;
              }
            }
          }

          setSelection({ x: dstX, y: dstY, w: src.w, h: src.h });
          return next;
        });
        setIsDirty(true);
      }
    }

    selectionDragRef.current.mode = "none";
    selectionDragRef.current.previewDX = 0;
    selectionDragRef.current.previewDY = 0;
  };


  const onCanvasMouseLeave = () => {
    setHoverInfo({ tileOffsetHex: null, pixelOffsetHex: null, pixelColorHex: null, pixelColorIndex: null });
    setLinePreviewEnd(null);
    lineRef.current.drawing = false;
  };

  // Exportar .bin usando codec atual
  function downloadBin() {
    const codecDef = CODECS[codec];

    let tilesToExport: Uint8Array[] = [];

    if (selection) {
      // Exportar apenas a seleção
      const { x, y, w, h } = selection;
      for (let ty = 0; ty < h; ty++) {
        for (let tx = 0; tx < w; tx++) {
          const srcIndex = getTileIndex(x + tx, y + ty, tilesPerRow);
          if (srcIndex >= 0 && srcIndex < tiles.length) {
            tilesToExport.push(new Uint8Array(tiles[srcIndex]));
          }
        }
      }
    } else {
      // Exportar todos
      tilesToExport = tiles;
    }

    const out = new Uint8Array(tilesToExport.length * codecDef.bytesPerTile);
    for (let t = 0; t < tilesToExport.length; t++) {
      const encoded = codecDef.encodeTile(tilesToExport[t]);
      out.set(encoded, t * codecDef.bytesPerTile);
    }

    const blob = new Blob([out], { type: "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);

    let baseName = fileName ? fileName.replace(/\.[^/.]+$/, "") : "tiles";
    if (selection) baseName += "_selection";

    a.download = `${baseName}_${codec}.bin`;
    a.click();
    URL.revokeObjectURL(a.href);

    setIsDirty(false);
  }

  function collectTilesForExport(): { tiles: Uint8Array[]; tilesPerRowExp: number } {
    if (!selection) return { tiles, tilesPerRowExp: tilesPerRow };

    const { x, y, w, h } = selection;
    const picked: Uint8Array[] = [];
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const idx = getTileIndex(x + tx, y + ty, tilesPerRow);
        if (idx >= 0 && idx < tiles.length) picked.push(new Uint8Array(tiles[idx]));
      }
    }
    return { tiles: picked, tilesPerRowExp: w };
  }

  function downloadPng() {
    const { tiles: tilesExp, tilesPerRowExp } = collectTilesForExport();
    if (tilesExp.length === 0) return;

    // canvas offscreen
    const off = document.createElement("canvas");
    const ctx = off.getContext("2d");
    if (!ctx) return;

    // render em zoom 1, sem grids, sem seleção
    // importante: desabilitar smoothing
    ctx.imageSmoothingEnabled = false;

    renderCanvas(ctx, {
      tiles: tilesExp,
      palette,
      tilesPerRow: tilesPerRowExp,
      pixelSize: 1,
      showTileGrid: false,
      showPixelGrid: false,
      selection: undefined,
      selectionPreview: null,
    });

    const a = document.createElement("a");
    a.href = off.toDataURL("image/png");
    let baseName = fileName ? fileName.replace(/\.[^/.]+$/, "") : "tiles";
    if (selection) baseName += "_selection";
    a.download = `${baseName}_${codec}.png`;
    a.click();
  }

  async function readPngToImageData(file: File): Promise<ImageData> {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      // importante: blob URL não precisa de CORS, mas vamos cobrir onload/onerror
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (_e) => reject(new Error("Failed to load image"));
      });
      img.src = url;
      // alguns browsers falham no decode(); preferimos onload robusto
      await loaded;

      const off = document.createElement("canvas");
      off.width = img.naturalWidth || img.width;
      off.height = img.naturalHeight || img.height;
      const ctx = off.getContext("2d");
      if (!ctx) throw new Error("No 2D context");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, off.width, off.height);
      return imageData;
    } finally {
      URL.revokeObjectURL(url);
    }
  }


  type RGB = [number, number, number];
  const hexToRgb = (hex: string): RGB => {
    const h = hex.startsWith("#") ? hex.slice(1) : hex;
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const dist2 = (a: RGB, b: RGB) => {
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
  };
  function imageDataToTilesByPalette(img: ImageData, paletteHex: string[]) {
    const w = img.width, h = img.height, data = img.data;
    const pal = paletteHex.map(hexToRgb);
    const pixels = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4, a = data[o + 3];
      if (a < 128) { pixels[i] = 0; continue; }
      const r = data[o], g = data[o + 1], b = data[o + 2];
      let best = 0, bestD = Infinity;
      for (let p = 0; p < pal.length; p++) {
        const d = dist2([r, g, b], pal[p]);
        if (d < bestD) { bestD = d; best = p; if (d === 0) break; }
      }
      pixels[i] = best;
    }
    const tilesX = w / 8, tilesY = h / 8;
    const tiles: Uint8Array[] = [];
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const tile = new Uint8Array(64);
        let k = 0;
        for (let py = 0; py < 8; py++) {
          const row = (ty * 8 + py) * w + (tx * 8);
          for (let px = 0; px < 8; px++) tile[k++] = pixels[row + px];
        }
        tiles.push(tile);
      }
    }
    return { tiles, tilesX, tilesY };
  }



  // DnD
  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  async function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) await handleFile(f);
  }


  // Atualiza o título da aba com estado atual
  useEffect(() => {
    const base = "TileBravo";
    const name = fileName || "untitled.bin";
    const star = isDirty ? "* " : "";
    document.title = `${star}${name} · ${codec} · ${base}`;
  }, [fileName, isDirty, codec]);

  // Aviso de alterações não salvas ao fechar a janela (se houver)
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // Carregar preferências do localStorage ao iniciar
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tilebravo:prefs");
      if (!raw) return;
      const p = JSON.parse(raw);

      if (p.codec) setCodec(p.codec);
      if (typeof p.pixelSize === "number") setPixelSize(clamp(p.pixelSize, 1, 64));
      if (typeof p.tilesPerRow === "number") setTilesPerRow(clamp(p.tilesPerRow, 1, 256));
      if (typeof p.viewportTilesX === "number") setViewportTilesX(clamp(p.viewportTilesX, 1, 256));
      if (typeof p.viewportTilesY === "number") setViewportTilesY(clamp(p.viewportTilesY, 1, 256));
      if (typeof p.showTileGrid === "boolean") setShowTileGrid(p.showTileGrid);
      if (typeof p.showPixelGrid === "boolean") setShowPixelGrid(p.showPixelGrid);
      // Backward compatibility: only apply legacy single palette if
      // there is no multi-palette store present.
      const hasMulti = !!localStorage.getItem("tilebravo:palettes");
      if (!hasMulti && Array.isArray(p.palette)) {
        setPalettes([{ name: "Imported", colors: p.palette }]);
        setCurrentPaletteIndex(0);
      }
    } catch { }
  }, []);

  // Salvar preferências sempre que algo relevante mudar
  useEffect(() => {
    const prefs = {
      codec,
      pixelSize,
      tilesPerRow,
      viewportTilesX,
      viewportTilesY,
      showTileGrid,
      showPixelGrid,
      // keep for backward compat (current palette only)
      palette,
    };
    try {
      localStorage.setItem("tilebravo:prefs", JSON.stringify(prefs));
      localStorage.setItem("tilebravo:palettes", JSON.stringify(palettes));
      localStorage.setItem("tilebravo:palettes:index", String(currentPaletteIndex));
    } catch { }
  }, [
    codec,
    pixelSize,
    tilesPerRow,
    viewportTilesX,
    viewportTilesY,
    showTileGrid,
    showPixelGrid,
    palette,
    palettes,
    currentPaletteIndex,
  ]);


  // Limpar
  function clearAll() {
    setFileName("untitled.bin");
    const blank = createBlankFile(16 * 16, codec);
    setRawBytes(blank);
    setTiles([]);
    setBaseOffsetHex("0");
    // Reset view and decode params per spec
    setTileStrideBytes(16); // stride fixo 16 bytes
    setTilesPerRow(16);
    setViewportTilesX(16);
    setViewportTilesY(16);
    setPixelSize(4); // 400%
    setCurrentColor(0); // cor índice 0
    setColumnShift(0);
    setSelection(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsDirty(false);
  }

  // Palette update helpers for children
  const setCurrentPaletteColors: React.Dispatch<React.SetStateAction<string[]>> = (updater) => {
    setPalettes(prev => {
      if (prev.length === 0) return prev;
      const idx = Math.max(0, Math.min(prev.length - 1, currentPaletteIndex));
      const cur = prev[idx];
      const nextColors = typeof updater === "function"
        ? (updater as (prev: string[]) => string[])(cur.colors)
        : updater;
      const out = prev.slice();
      out[idx] = { ...cur, colors: nextColors };
      return out;
    });
  };
  function setCurrentPaletteName(name: string) {
    setPalettes(prev => {
      if (prev.length === 0) return prev;
      const idx = Math.max(0, Math.min(prev.length - 1, currentPaletteIndex));
      const cur = prev[idx];
      const out = prev.slice();
      out[idx] = { ...cur, name };
      return out;
    });
  }
  function prevPalette() { setCurrentPaletteIndex(i => (palettes.length ? (i - 1 + palettes.length) % palettes.length : 0)); }
  function nextPalette() { setCurrentPaletteIndex(i => (palettes.length ? (i + 1) % palettes.length : 0)); }
  function exportCurrentPalette() {
    const cur = palettes[currentPaletteIndex];
    if (!cur) return;
    const data = { name: cur.name, colors: cur.colors };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${cur.name || "palette"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function newPalette() {
    const size = palette.length || 4;
    const p: PaletteDef = { name: "New Palette", colors: makeGrayscale(size) };
    setPalettes(prev => {
      const out = prev.slice();
      out.splice(currentPaletteIndex + 1, 0, p);
      return out;
    });
    setCurrentPaletteIndex(i => i + 1);
  }

  function duplicatePalette() {
    const cur = palettes[currentPaletteIndex];
    if (!cur) return;
    const dup: PaletteDef = { name: `Copy of ${cur.name || "Palette"}`, colors: cur.colors.slice() };
    setPalettes(prev => {
      const out = prev.slice();
      out.splice(currentPaletteIndex + 1, 0, dup);
      return out;
    });
    setCurrentPaletteIndex(i => i + 1);
  }

  function deletePalette() {
    if (palettes.length <= 1) {
      alert("Cannot delete the last palette.");
      return;
    }
    setPalettes(prev => {
      const out = prev.slice();
      out.splice(currentPaletteIndex, 1);
      return out;
    });
    setCurrentPaletteIndex(i => Math.max(0, Math.min(palettes.length - 2, i)));
  }

  function importPalette(data: { name?: string; colors: string[] }) {
    try {
      if (!data || !Array.isArray(data.colors)) throw new Error("Invalid format");
      const size = palette.length || 0;
      if (size > 0 && data.colors.length !== size) {
        alert(`Imported palette must have exactly ${size} colors (received ${data.colors.length}).`);
        return;
      }
      const norm = data.colors.map(c => String(c).trim().toUpperCase());
      const name = data.name && typeof data.name === "string" ? data.name : "Imported";
      const p: PaletteDef = { name, colors: norm };
      setPalettes(prev => {
        const out = prev.slice();
        out.splice(currentPaletteIndex + 1, 0, p);
        return out;
      });
      setCurrentPaletteIndex(i => i + 1);
    } catch {
      alert("Failed to import palette. Make sure it's TileBravo JSON format: { name: string, colors: string[] }.");
    }
  }

  function resetPalettesToDefaults() {
    const c = CODECS[codec];
    const n = c.pixelMode === "indexed" ? (c.colors ?? (1 << c.bpp)) : (palette.length || 4);
    const defs = defaultPalettesFor(n);
    setPalettes(defs);
    setCurrentPaletteIndex(0);
  }

  return (
    <main className="w-screen h-screen flex flex-col pb-1 overflow-hidden bg-background text-foreground">
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-border border-t-primary rounded-full animate-spin" />
            <div className="text-sm opacity-80">Loading…</div>
          </div>
        </div>
      )}
      {/* Top bar */}
      <header className="h-12 flex items-center gap-3 px-4 border-b border-border bg-background">
        <strong className="text-sm">TileBravo</strong>
        {/* Input escondido */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={onInputChange}
          style={{ display: "none" }}
        />

        {/* Botões (esquerda) */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1 text-sm rounded border border-primary bg-primary text-primary-foreground hover:opacity-90"
          title="Open file"
        >
          Open
        </button>

        <button
          onClick={() => pngInputRef.current?.click()}
          className="px-3 py-1 text-sm rounded border border-border bg-surface hover:bg-muted"
          title="Import PNG"
        >
          Import PNG
        </button>

        <button
          onClick={downloadPng}
          className="px-3 py-1 text-sm rounded border border-border bg-surface hover:bg-muted"
          title="Export PNG"
        >
          Export PNG {selection ? "(selection)" : ""}
        </button>

        <button
          onClick={downloadBin}
          className="px-3 py-1 text-sm rounded border border-border bg-surface hover:bg-muted"
          title="Export BIN"
        >
          Export BIN {selection ? "(selection)" : ""}
        </button>

        {/* divisor sutil */}
        <span className="mx-2 h-6 w-px bg-border inline-block" />

        {/* Clear isolado à direita em vermelho */}
        <button
          onClick={() => {
            if (window.confirm("Are you sure you want to clear the file? All unsaved changes will be lost.")) {
              clearAll();
            }
          }}
          className="ml-2 px-3 py-1 text-sm rounded border border-danger text-danger bg-background hover:opacity-90"
          title="Clear / New File"
        >
          Clear / New File
        </button>



        <input
          ref={pngInputRef}
          type="file"
          accept="image/png"
          style={{ display: "none" }}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) {
              console.log("[PNG] no file selected");
              return;
            }
            console.log("[PNG] selected:", f.name, f.type, f.size, "bytes");
            try {
              const imageData = await readPngToImageData(f);
              const { width, height } = imageData;
              console.log("[PNG] imageData:", width, "x", height);
              if (width % 8 !== 0 || height % 8 !== 0) {
                alert(`Image must be multiple of 8. Got ${width}x${height}.`);
                return;
              }

              const { tiles: newTiles, tilesX, tilesY } = imageDataToTilesByPalette(imageData, palette);
              console.log("[PNG] tiles:", { count: newTiles.length, tilesX, tilesY });

              if (selection && selection.w === tilesX && selection.h === tilesY) {
                setTiles(prev => {
                  const next = prev.slice();
                  let k = 0;
                  for (let j = 0; j < selection.h; j++) {
                    for (let i2 = 0; i2 < selection.w; i2++) {
                      const idx = (selection.y + j) * tilesPerRow + (selection.x + i2);
                      if (idx >= 0 && idx < next.length) next[idx] = new Uint8Array(newTiles[k++]);
                    }
                  }
                  return next;
                });
              } else {
                setTiles(newTiles);
                setTilesPerRow(tilesX);
                setViewportTilesX(Math.max(viewportTilesX, tilesX));
                setViewportTilesY(Math.max(viewportTilesY, tilesY));
                setSelection(null);
              }

              setIsDirty(true);
              alert(`Imported ${tilesX}×${tilesY} tiles from PNG.`);
            } catch (err) {
              console.error("[PNG] import error:", err);
              alert("Failed to import PNG.");
            } finally {
              // reseta para permitir reimportar o mesmo arquivo
              if (pngInputRef.current) pngInputRef.current.value = "";
            }

          }}


        />


        {/* Nome do arquivo */}
        <span
          className={
            "ml-auto text-xs truncate max-w-xs " +
            (isDirty ? "text-danger font-bold italic" : "opacity-70")
          }
        >
          {fileName ? `${isDirty ? "* " : ""}${fileName}` : "Nenhum arquivo"}
        </span>


      </header>

      {/* Conteúdo. toolbar esquerda | viewport | painel direita */}
      <div
        className="flex-1 grid overflow-hidden min-h-0"
        style={{ gridTemplateColumns: "64px minmax(0,1fr) 320px" }}
      >


        {/* Toolbar esquerda */}
        <Toolbox
          tool={tool}
          onSelectTool={setTool}
          onZoomIn={() => setPixelSize((p) => Math.max(1, Math.min(64, (p || 1) + 1)))}
          onZoomOut={() => setPixelSize((p) => Math.max(1, Math.min(64, (p || 1) - 1)))}
          palette={palette}
          currentColor={currentColor}
        />



        {/* Área do canvas */}
        <section
          className="p-3 h-full min-h-0 min-w-0 overflow-scroll scroll-stable scroll-area"
          ref={viewportRef}
        >
          <div
            className="border border-border rounded relative outline-none overflow-scroll scroll-area bg-surface"
            ref={innerViewportRef}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onMouseDown={(e) => {
              // garante foco ao clicar
              e.currentTarget.focus();
            }}
            onFocus={() => setIsViewportFocused(true)}
            onBlur={() => setIsViewportFocused(false)}
            tabIndex={0}
            role="region"
            aria-label="Tiles viewport"
            style={{
              width: viewportTilesX * TILE_W * pixelSize + 14,
              height: viewportTilesY * TILE_H * pixelSize + 14,
              display: "inline-block",
            }}

          >

            <canvas
              ref={canvasRef}
              onMouseDown={onCanvasMouseDown}
              onMouseMove={onCanvasMouseMove}
              onMouseUp={onCanvasMouseUp}
              onMouseLeave={onCanvasMouseLeave}
              onClick={(e) => {
                if (tool === "pencil" && !e.altKey) {
                  const { tx, ty, px, py } = getTileCoordsFromMouse(e);
                  pencilApply(px, py, tx, ty);
                }
              }}
              style={{
                display: "block",
                cursor:
                  tool === "pencil"
                    ? "url(\"data:image/svg+xml;utf8,\
          <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24'>\
          <path d='M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z' fill='black' stroke='white' stroke-width='2'/>\
          <path d='M20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.29a1 1 0 0 0-1.41 0l-1.83 1.83l3.75 3.75 1.83-1.83z' fill='black' stroke='white' stroke-width='2'/>\
          </svg>\") 1 22, auto" :
                    tool === "eyedropper"
                      ? "url(\"data:image/svg+xml;utf8,\
  <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='black' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-pipette-icon lucide-pipette'>\
  <path d='m12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12'/>\
  <path d='m18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z'/>\
  <path d='m2 22 .414-.414'/>\
  </svg>\") 4 15, auto" :
                      tool === "line"
                        ? "url(\"data:image/svg+xml;utf8,\
  <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='black' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-pencil-line'>\
    <path d='M13 21h8' />\
    <path d='m15 5 4 4' />\
    <path d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z' />\
  </svg>\") 4 15, auto" :
                        tool === "bucket"
                          ? "url(\"data:image/svg+xml;utf8,\
  <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='black' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-paint-bucket'>\
    <path d='m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z' />\
    <path d='m5 2 5 5' />\
    <path d='M2 13h15' />\
    <path d='M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z' />\
  </svg>\") 4 15, auto" :
                          tool === "select" ? "cell" :
                            "default",
              }}
            />


            {isDragging && (
              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center text-primary font-semibold text-lg pointer-events-none">
                Drop file to open
              </div>
            )}
          </div>

        </section>

        {/* Sidebar direita */}
        <RightSidebar
          codec={codec}
          setCodec={setCodec}
          baseOffsetHex={baseOffsetHex}
          setBaseOffsetHex={setBaseOffsetHex}
          tileStrideBytes={tileStrideBytes}
          setTileStrideBytes={setTileStrideBytes}
          tilesCount={tiles.length}
          onResizeTiles={resizeTiles}
          tilesPerRow={tilesPerRow}
          setTilesPerRow={setTilesPerRow}
          viewportTilesX={viewportTilesX}
          setViewportTilesX={setViewportTilesX}
          viewportTilesY={viewportTilesY}
          setViewportTilesY={setViewportTilesY}
          showTileGrid={showTileGrid}
          setShowTileGrid={setShowTileGrid}
          showPixelGrid={showPixelGrid}
          setShowPixelGrid={setShowPixelGrid}
          palette={palette}
          currentColor={currentColor}
          setPalette={setCurrentPaletteColors}
          setCurrentColor={setCurrentColor}
          onReDecode={reDecode}
          paletteName={palettes[currentPaletteIndex]?.name ?? ""}
          setPaletteName={setCurrentPaletteName}
          paletteIndex={currentPaletteIndex}
          paletteTotal={palettes.length}
          onPrevPalette={prevPalette}
          onNextPalette={nextPalette}
          onExportPalette={exportCurrentPalette}
          onNewPalette={newPalette}
          onDuplicatePalette={duplicatePalette}
          onDeletePalette={deletePalette}
          onImportPalette={importPalette}
          onResetPalettes={resetPalettesToDefaults}
          onTileBack={() => setColumnShift(s => { const mod = Math.max(1, tilesPerRow); const next = (s + 1) % mod; try { console.log('[TileBravo][Nav] TileBack', { prev: s, next }); } catch { } return next; })}
          onTileForward={() => setColumnShift(s => { const mod = Math.max(1, tilesPerRow); const next = (s - 1 + mod) % mod; try { console.log('[TileBravo][Nav] TileForward', { prev: s, next }); } catch { } return next; })}
          onGoToOffset={(ofs) => {
            const base = parseInt(baseOffsetHex || "0", 16) || 0;
            const stride = Math.max(CODECS[codec].bytesPerTile, tileStrideBytes | 0);
            const idx = Math.max(0, Math.floor((ofs - base) / stride));
            const clamped = Math.min(Math.max(0, idx), Math.max(0, tiles.length - 1));
            const tx = clamped % tilesPerRow;
            const ty = Math.floor(clamped / tilesPerRow);
            setColumnShift(tx % Math.max(1, tilesPerRow));
            setSelection({ x: 0, y: ty, w: 1, h: 1 });
            const ps = Math.max(1, pixelSize);
            const xpx = 0;
            const ypx = ty * TILE_H * ps;
            const vp = innerViewportRef.current || viewportRef.current;
            const outer = viewportRef.current;
            if (vp) {
              const apply = () => {
                vp.scrollLeft = xpx;
                vp.scrollTop = ypx;
                if (outer) {
                  outer.scrollLeft = xpx;
                  outer.scrollTop = ypx;
                }
              };
              apply();
              // in case layout updates after selection, try again next frame
              requestAnimationFrame(apply);
            } else {
              try { console.log('[TileBravo][Nav] No viewport ref available'); } catch { }
            }
          }}
          setGoToOpener={(fn) => { openGoToRef.current = fn; }}
        />
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur px-0 py-0 border-t border-border">
        <StatusBar
          tileOffsetHex={hoverInfo.tileOffsetHex}
          pixelOffsetHex={hoverInfo.pixelOffsetHex}
          pixelColorHex={hoverInfo.pixelColorHex}
          pixelColorIndex={hoverInfo.pixelColorIndex}
          zoomPercent={Math.round((pixelSize || 1) * 100)}
          selectionSize={selection ? `${selection.w}×${selection.h}` : null}
        />
      </div>
    </main>
  );
}
