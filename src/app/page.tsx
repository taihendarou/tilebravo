"use client";
import StatusBar from "../components/StatusBar";
import PalettePanel from "../components/PalettePanel";
import Toolbox from "../components/Toolbox";

import { useEffect, useRef, useState } from "react";
import { renderCanvas } from "../lib/render";
import { TILE_W, TILE_H } from "../lib/constants";
import type { CodecId } from "../lib/codecs";
import { CODECS } from "../lib/codecs";
import { toHex } from "../lib/utils/hex";
import { computeOffsets } from "../lib/offsets";

type ToolId = "select" | "pencil" | "eyedropper";
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pngInputRef = useRef<HTMLInputElement | null>(null);
  const [isViewportFocused, setIsViewportFocused] = useState(false);

  // Ferramenta
  const [tool, setTool] = useState<ToolId>("pencil");

  // Codec
  const [codec, setCodec] = useState<CodecId>("2bpp_planar");

  // Paleta e edição
  const [palette, setPalette] = useState<string[]>(
    // paleta inicial vem do codec atual (2bpp)
    CODECS["2bpp_planar"].defaultPalette ?? ["#000000", "#555555", "#AAAAAA", "#FFFFFF"]
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

  // Status bar
  const [hoverInfo, setHoverInfo] = useState<{
    tileOffsetHex: string | null;
    pixelOffsetHex: string | null;
  }>({ tileOffsetHex: null, pixelOffsetHex: null });

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

  // Inicializar arquivo em branco se nenhum estiver aberto
  useEffect(() => {
    if (!rawBytes) {
      const blank = createBlankFile(16 * 16, codec); // 256 tiles
      setRawBytes(blank);
      setFileName("untitled.bin");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawBytes, codec]);

  // mantém currentColor dentro do range caso a paleta mude
  useEffect(() => {
    if (currentColor > palette.length - 1) {
      setCurrentColor(palette.length - 1);
    }
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
        showTileGrid,
        showPixelGrid,
        selection: selection ?? undefined,
        selectionPreview:
          selection && selectionDragRef.current.mode === "move"
            ? { dx: selectionDragRef.current.previewDX, dy: selectionDragRef.current.previewDY }
            : null,
      });
    } else {
      ctx.canvas.width = viewportTilesX * TILE_W * pixelSize;
      ctx.canvas.height = viewportTilesY * TILE_H * pixelSize;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  }, [tiles, palette, tilesPerRow, pixelSize, showTileGrid, showPixelGrid, viewportTilesX, viewportTilesY, selection]);

  // Re-decode ao mudar arquivo ou parâmetros
  useEffect(() => {
    if (!rawBytes) return;
    if (!codec) {
      setTiles([]);
      return;
    }
    reDecode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawBytes, codec]);

  // atalhos. Cmd/Ctrl+C/V já existem abaixo. Aqui 1..4 e B, V, I.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // não capturar quando o foco estiver em inputs
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || (t as any).isContentEditable)) {
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
      }

      // Zoom in / out
      if (e.key === "=" || e.key === "+") {
        setPixelSize((p) => Math.max(2, Math.min(64, (p || 2) + 1)));
        e.preventDefault();
      }
      if (e.key === "-" || e.key === "_") {
        setPixelSize((p) => Math.max(2, Math.min(64, (p || 2) - 1)));
        e.preventDefault();
      }

      // copiar
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "c") {
        if (!selection) return;
        const { x, y, w, h } = selection;
        const copied: Uint8Array[] = [];
        for (let ty = 0; ty < h; ty++) {
          for (let tx = 0; tx < w; tx++) {
            const srcIndex = y * tilesPerRow + x + ty * tilesPerRow + tx - y * tilesPerRow;
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
    const decoded = decodeWithStride(
      rawBytes,
      isNaN(baseOffset) ? 0 : baseOffset,
      stride,
      codec
    );
    setTiles(decoded);
  }

  // Abrir arquivo
  async function handleFile(file: File) {
    const buf = new Uint8Array(await file.arrayBuffer());
    setFileName(file.name);
    setRawBytes(buf);
    setSelection(null);
    setIsDirty(false); // <-- novo arquivo começa “limpo”
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
    setIsDirty(true); // <— marca alterações
  }


  // Canvas events
  const onCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tiles.length === 0) return;
    const { tx, ty, px, py } = getTileCoordsFromMouse(e);

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

      setHoverInfo({
        tileOffsetHex: toHex(tileOffset),
        pixelOffsetHex: toHex(pixelOffset),
      });
    } else {
      setHoverInfo({ tileOffsetHex: null, pixelOffsetHex: null });
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

    // 4) Lógica do seletor (criar/mover seleção)
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
        setSelection(rect);
      } else if (mode === "move" && selectionDragRef.current.startSel) {
        const dx = tx - selectionDragRef.current.startTX;
        const dy = ty - selectionDragRef.current.startTY;
        selectionDragRef.current.previewDX = dx;
        selectionDragRef.current.previewDY = dy;
        // forçar re-render do overlay de seleção
        setSelection((prev) => (prev ? { ...prev } : prev));
      }
    }
  };


  const onCanvasMouseUp = () => {
    if (tool === "pencil") {
      pencilRef.current.drawing = false;
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
        setIsDirty(true); // <-- marca como alterado ao concluir o move
      }
    }

    selectionDragRef.current.mode = "none";
    selectionDragRef.current.previewDX = 0;
    selectionDragRef.current.previewDY = 0;
  };


  const onCanvasMouseLeave = () => {
    setHoverInfo({ tileOffsetHex: null, pixelOffsetHex: null });
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

    setIsDirty(false); // <-- consideramos exportar BIN como “salvar”
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
        img.onerror = (e) => reject(new Error("Failed to load image"));
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
      if (typeof p.pixelSize === "number") setPixelSize(clamp(p.pixelSize, 2, 64));
      if (typeof p.tilesPerRow === "number") setTilesPerRow(clamp(p.tilesPerRow, 1, 256));
      if (typeof p.viewportTilesX === "number") setViewportTilesX(clamp(p.viewportTilesX, 1, 256));
      if (typeof p.viewportTilesY === "number") setViewportTilesY(clamp(p.viewportTilesY, 1, 256));
      if (typeof p.showTileGrid === "boolean") setShowTileGrid(p.showTileGrid);
      if (typeof p.showPixelGrid === "boolean") setShowPixelGrid(p.showPixelGrid);
      if (Array.isArray(p.palette)) setPalette(p.palette);
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
      palette,
    };
    try {
      localStorage.setItem("tilebravo:prefs", JSON.stringify(prefs));
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
  ]);


  // Limpar
  function clearAll() {
    setFileName("untitled.bin");
    const blank = createBlankFile(16 * 16, codec);
    setRawBytes(blank);
    setTiles([]);
    setBaseOffsetHex("0");
    setTileStrideBytes(CODECS[codec].bytesPerTile);
    setSelection(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsDirty(false); // <-- novo documento em branco “limpo”
  }

  return (
    <main className="w-screen h-screen flex flex-col pb-1 overflow-hidden">
      {/* Top bar */}
      <header className="h-12 flex items-center gap-3 px-4 border-b bg-white">
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
          className="px-3 py-1 text-sm rounded border border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
          title="Open file"
        >
          Open
        </button>

        <button
          onClick={() => pngInputRef.current?.click()}
          className="px-3 py-1 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50"
          title="Import PNG"
        >
          Import PNG
        </button>

        <button
          onClick={downloadPng}
          className="px-3 py-1 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50"
          title="Export PNG"
        >
          Export PNG {selection ? "(selection)" : ""}
        </button>

        <button
          onClick={downloadBin}
          className="px-3 py-1 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50"
          title="Export BIN"
        >
          Export BIN {selection ? "(selection)" : ""}
        </button>

        {/* divisor sutil */}
        <span className="mx-2 h-6 w-px bg-gray-300 inline-block" />

        {/* Clear isolado à direita em vermelho */}
        <button
          onClick={() => {
            if (window.confirm("Are you sure you want to clear the file? All unsaved changes will be lost.")) {
              clearAll();
            }
          }}
          className="ml-2 px-3 py-1 text-sm rounded border border-red-500 text-red-600 bg-white hover:bg-red-50"
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
            (isDirty ? "text-red-600 font-bold italic" : "opacity-70")
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
          onZoomIn={() => setPixelSize((p) => Math.max(2, Math.min(64, (p || 2) + 1)))}
          onZoomOut={() => setPixelSize((p) => Math.max(2, Math.min(64, (p || 2) - 1)))}
          palette={palette}
          currentColor={currentColor}
        />



        {/* Área do canvas */}
        <section className="p-3 h-full min-h-0 min-w-0 overflow-scroll scroll-stable scroll-area">
          <div
            className="border rounded relative outline-none overflow-scroll scroll-area"
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
                      tool === "select" ? "cell" :
                        "default",
              }}
            />


            {isDragging && (
              <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center text-blue-700 font-semibold text-lg pointer-events-none">
                Drop file to open
              </div>
            )}
          </div>

        </section>

        {/* Sidebar direita */}
        <aside className="border-l p-3 overflow-y-auto">

          {/* Decode */}
          <details open className="mb-4">
            <summary className="cursor-pointer select-none text-sm font-semibold mb-2">Decode</summary>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs">Codec</label>
              <select
                value={codec}
                onChange={e => {
                  const cid = e.target.value as CodecId;
                  setCodec(cid);
                  // stride mínimo vem do codec
                  setTileStrideBytes(prev => Math.max(CODECS[cid].bytesPerTile, prev | 0));
                  // ajuste de paleta: usa a default do codec (se não houver, cria grayscale com 2**bpp)
                  const c = CODECS[cid];
                  if (c.pixelMode === "indexed") {
                    const colors = c.colors ?? (1 << c.bpp);
                    const fallback = Array.from({ length: colors }, (_, i) => {
                      const t = colors === 1 ? 0 : i / (colors - 1);
                      const v = Math.round(255 * t);
                      const hex = v.toString(16).padStart(2, "0");
                      return `#${hex}${hex}${hex}`;
                    });
                    setPalette(c.defaultPalette ?? fallback);
                  } else {
                    // direct color: não há paleta — opcionalmente poderíamos esvaziar ou manter a atual
                    setPalette([]);
                  }
                }}
                className="border rounded px-2 py-1"
                title="Codec de leitura"
              >
                <option value="2bpp_planar">2bpp planar</option>
                <option value="4bpp_planar">4bpp planar</option>
                <option value="2bpp_planar_composite">2bpp planar composite</option>
                <option value="4bpp_chunky_zip16">4bpp chunky (zip16)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs">Offset (hex)</label>
              <input
                className="border rounded px-2 py-1 w-28"
                value={baseOffsetHex}
                onChange={e => setBaseOffsetHex(e.target.value.replace(/[^0-9a-fA-F]/g, ""))}
                onBlur={reDecode}
                onKeyDown={(e) => e.key === "Enter" && reDecode()}
                placeholder="0"
                title="Offset inicial em hexadecimal"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs">Stride bytes</label>
              <input
                className="border rounded px-2 py-1 w-24"
                type="number"
                min={CODECS[codec].bytesPerTile}
                step={1}
                value={tileStrideBytes}
                onChange={e => setTileStrideBytes(parseInt(e.target.value || String(CODECS[codec].bytesPerTile)))}
                onBlur={reDecode}
                onKeyDown={(e) => e.key === "Enter" && reDecode()}
                title="Bytes pulados por tile"
              />
            </div>
          </details>

          {/* View */}
          <details open className="mb-4">
            <summary className="cursor-pointer select-none text-sm font-semibold mb-2">View</summary>

            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs">Zoom</label>
              <input
                className="border rounded px-2 py-1 w-24"
                type="number"
                min={2}
                max={64}
                value={pixelSize}
                onChange={e => setPixelSize(parseInt(e.target.value || "8"))}
                title="Tamanho do pixel em tela"
              />
            </div>

            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs">Columns</label>
              <input
                className="border rounded px-2 py-1 w-24"
                type="number"
                min={1}
                max={256}
                value={tilesPerRow}
                onChange={e => setTilesPerRow(parseInt(e.target.value || "16"))}
                title="Largura em tiles"
              />
            </div>

            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs">Viewport size</label>
              <input
                className="border rounded px-2 py-1 w-20"
                type="number"
                min={1}
                max={256}
                value={viewportTilesX}
                onChange={e => setViewportTilesX(parseInt(e.target.value || "16"))}
                title="Largura do viewport em tiles"
              />
              <span className="text-xs opacity-60">x</span>
              <input
                className="border rounded px-2 py-1 w-20"
                type="number"
                min={1}
                max={256}
                value={viewportTilesY}
                onChange={e => setViewportTilesY(parseInt(e.target.value || "16"))}
                title="Altura do viewport em tiles"
              />
            </div>

            <div className="flex items-center gap-2 mb-2">
              <input
                id="tileGrid"
                type="checkbox"
                checked={showTileGrid}
                onChange={e => setShowTileGrid(e.target.checked)}
              />
              <label htmlFor="tileGrid" className="text-xs">Show tile grid</label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="pixelGrid"
                type="checkbox"
                checked={showPixelGrid}
                onChange={e => setShowPixelGrid(e.target.checked)}
              />
              <label htmlFor="pixelGrid" className="text-xs">Show pixel grid</label>
            </div>

          </details>

          <PalettePanel
            palette={palette}
            currentColor={currentColor}
            setPalette={setPalette}
            setCurrentColor={setCurrentColor}
          />

          {/* Help */}
          <details>
            <summary className="cursor-pointer select-none text-sm font-semibold mb-2">Help</summary>
            <ul className="text-xs opacity-80 list-disc pl-4 space-y-1">
              <li>Pencil (B). Paints with the selected color. Click or drag.</li>
              <li>Eyedropper (I). Picks color from pixel. Use the tool or Alt+click.</li>
              <li>Selector (V). Drag to create tile selection. Click inside to move.</li>
              <li>Copy/Paste. Cmd/Ctrl+C copies. Cmd/Ctrl+V pastes to current selection.</li>
              <li>Colors. 1 to 4 select color. Double click on swatch opens color picker.</li>
            </ul>
          </details>
        </aside>
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur px-0 py-0">
        <StatusBar
          tileOffsetHex={hoverInfo.tileOffsetHex}
          pixelOffsetHex={hoverInfo.pixelOffsetHex}
          selectionSize={selection ? `${selection.w}×${selection.h}` : null}
        />
      </div>
    </main>
  );
}
