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
  const [isDirty, setIsDirty] = useState(false); // Dirty state (indica alterações não salvas)
 


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
      // selecionar cor 1..9
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 0 && num <= 9 && num < palette.length) {
        setCurrentColor(num); // cor 0 = primeira, 1 = segunda, etc.
      }

      // copiar/colar seleção
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "c") {
        if (!selection) return;
        const { x, y, w, h } = selection;
        const copied: Uint8Array[] = [];
        for (let ty = 0; ty < h; ty++) {
          for (let tx = 0; tx < w; tx++) {
            const srcIndex = getTileIndex(x + tx, y + ty, tilesPerRow);
            if (srcIndex >= 0 && srcIndex < tiles.length) {
              copied.push(new Uint8Array(tiles[srcIndex]));
            }
          }
        }
        clipboardRef.current = { tiles: copied, w, h };
        e.preventDefault();
      }

      if (meta && e.key.toLowerCase() === "v") {
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
            const dstIndex = getTileIndex(dstX, dstY, tilesPerRow);
            if (dstIndex >= 0 && dstIndex < next.length) {
              const srcIndex = ty * clip.w + tx;
              next[dstIndex] = new Uint8Array(clip.tiles[srcIndex]);
            }
          }
        }
        return next;
      });
      setIsDirty(true); // <— aqui
      e.preventDefault();

      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tiles, palette.length, tilesPerRow, pixelSize, showTileGrid, showPixelGrid, selection]);

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

  // DnD
  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }
  async function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) await handleFile(f);
  }

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
    <main className="w-screen h-screen flex flex-col pb-1">
      {/* Top bar */}
      <header className="h-12 flex items-center gap-3 px-4 border-b bg-white">
        <strong className="text-sm">Tile Editor</strong>

        {/* Input escondido */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={onInputChange}
          style={{ display: "none" }}
        />

        {/* Botões */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="border rounded px-3 py-1 text-sm bg-gray-50 hover:bg-gray-100"
        >
          Open
        </button>
        <button
          onClick={() => {
            if (window.confirm("Are you sure you want to clear the file? All unsaved changes will be lost.")) {
              clearAll();
            }
          }}
          className="border rounded px-3 py-1 text-sm bg-gray-50 hover:bg-gray-100"
        >
          Clear / New File
        </button>
        <button
          onClick={downloadBin}
          className="border rounded px-3 py-1 text-sm bg-gray-50 hover:bg-gray-100"
        >
          Export BIN {selection ? "(selection)" : ""}
        </button>
        <button
          onClick={() => alert("Export PNG function not implemented yet. Sorry bro.")}
          className="border rounded px-3 py-1 text-sm bg-gray-50 hover:bg-gray-100"
        >
          Export PNG {selection ? "(selection)" : ""}
        </button>
        

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
      <div className="flex-1 grid" style={{ gridTemplateColumns: "64px 1fr 320px" }}>

        {/* Toolbar esquerda */}
        <Toolbox
          tool={tool}
          onSelectTool={setTool}
          onZoomIn={() => setPixelSize((p) => Math.max(2, Math.min(64, (p || 2) + 1)))}
          onZoomOut={() => setPixelSize((p) => Math.max(2, Math.min(64, (p || 2) - 1)))}
        />

        {/* Área do canvas */}
        <section className="p-3">
          <div
            className="border rounded"
            onDragOver={onDragOver}
            onDrop={onDrop}
            style={{
              width: viewportTilesX * TILE_W * pixelSize,
              height: viewportTilesY * TILE_H * pixelSize,
              overflow: "auto",
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
            />
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
      />
    </div>     
    </main>
  );
}
