import { TILE_W, TILE_H } from "../constants";

/** Retângulo de seleção em unidades de TILE (não pixels). */
export type SelectionRect = { x: number; y: number; w: number; h: number };

/**
 * Desenha os tiles e retorna dimensões calculadas.
 * - Ajusta o tamanho do canvas.
 * - Limpa fundo.
 * - Desenha cada pixel usando a paleta.
 */
export function drawTiles(
  ctx: CanvasRenderingContext2D,
  tiles: Uint8Array[],
  palette: string[],
  tilesPerRow: number,
  pixelSize: number,
  columnShift: number = 0
): { width: number; height: number; rows: number } {
  const totalTiles = tiles.length;
  const rows = Math.max(1, Math.ceil(totalTiles / Math.max(1, tilesPerRow)));

  const width = tilesPerRow * TILE_W * pixelSize;
  const height = rows * TILE_H * pixelSize;

  // Ajusta tamanho e limpa (evita resize desnecessário)
  if (ctx.canvas.width !== width) ctx.canvas.width = width;
  if (ctx.canvas.height !== height) ctx.canvas.height = height;
  ctx.clearRect(0, 0, width, height);

  // Pixels
  for (let i = 0; i < totalTiles; i++) {
    const tile = tiles[i];
    const tileX = i % tilesPerRow;
    const tileY = Math.floor(i / tilesPerRow);
    const visX = ((tileX - (columnShift % Math.max(1, tilesPerRow))) + tilesPerRow) % tilesPerRow;

    for (let py = 0; py < TILE_H; py++) {
      let runColor = -1;
      let runStart = 0;
      for (let px = 0; px < TILE_W; px++) {
        const val = tile[py * TILE_W + px] | 0;
        if (px === 0) { runColor = val; runStart = 0; continue; }
        if (val !== runColor) {
          // desenha run anterior
          ctx.fillStyle = palette[runColor] || "#FF00FF";
          const rx = (visX * TILE_W + runStart) * pixelSize;
          const ry = (tileY * TILE_H + py) * pixelSize;
          const rw = (px - runStart) * pixelSize;
          ctx.fillRect(rx, ry, rw, pixelSize);
          // inicia novo run
          runColor = val;
          runStart = px;
        }
      }
      // flush último run até final da linha
      ctx.fillStyle = palette[runColor] || "#FF00FF";
      const rx = (visX * TILE_W + runStart) * pixelSize;
      const ry = (tileY * TILE_H + py) * pixelSize;
      const rw = (TILE_W - runStart) * pixelSize;
      ctx.fillRect(rx, ry, rw, pixelSize);
    }
  }

  return { width, height, rows };
}

/**
 * Desenha grid.
 * - kind = "tile": grade nas fronteiras de tiles (traço duplo preto/branco).
 * - kind = "pixel": grade em cada pixel (linhas sutis e finas).
 */
  export function drawGrid(
    ctx: CanvasRenderingContext2D,
    tilesPerRow: number,
    rows: number,
    pixelSize: number,
    kind: "tile" | "pixel" = "tile"
  ): void {
    const canvasW = ctx.canvas.width;
    const canvasH = ctx.canvas.height;

    ctx.save();

    if (kind === "tile") {
      const thick = Math.max(2, Math.floor(pixelSize / 4)); // preto base
      const thin = Math.max(1, Math.floor(thick / 2));      // branco por cima

      const pass = (color: string, lw: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.setLineDash([]);
        // desenha todas as linhas em um único path para reduzir chamadas
        ctx.beginPath();
        // horizontais
        for (let y = 0; y <= rows; y++) {
          const ypx = y * TILE_H * pixelSize;
          ctx.moveTo(0, ypx);
          ctx.lineTo(canvasW, ypx);
        }
        // verticais
        for (let x = 0; x <= tilesPerRow; x++) {
          const xpx = x * TILE_W * pixelSize;
          ctx.moveTo(xpx, 0);
          ctx.lineTo(xpx, canvasH);
        }
        ctx.stroke();
      };

      // Passe 1 preto
      pass("rgba(0,0,0,0.9)", thick);
      // Passe 2 branco
      pass("rgba(255,255,255,0.9)", thin);
    }

    if (kind === "pixel") {
      ctx.lineWidth = 1;

      const drawPass = (stroke: string) => {
        ctx.strokeStyle = stroke;
        ctx.beginPath();
        // horizontais
        for (let y = 0; y <= canvasH; y += pixelSize) {
          const ypx = Math.round(y) + 0.5;
          ctx.moveTo(0, ypx);
          ctx.lineTo(canvasW, ypx);
        }
        // verticais
        for (let x = 0; x <= canvasW; x += pixelSize) {
          const xpx = Math.round(x) + 0.5;
          ctx.moveTo(xpx, 0);
          ctx.lineTo(xpx, canvasH);
        }
        ctx.stroke();
      };

      // 1ª passada (preto suave)
      drawPass("rgba(0,0,0,0.22)");
      // 2ª passada (branco suave)
      drawPass("rgba(255,255,255,0.12)");
    }

    ctx.restore();
  }


/**
 * Desenha o overlay de seleção de tiles.
 * A seleção é fornecida em unidades de TILE. dx/dy opcionais também em tiles.
 */
export function drawSelection(
  ctx: CanvasRenderingContext2D,
  sel: SelectionRect,
  pixelSize: number,
  dx: number = 0,
  dy: number = 0
): void {
  const xpx = (sel.x + dx) * TILE_W * pixelSize;
  const ypx = (sel.y + dy) * TILE_H * pixelSize;
  const wpx = sel.w * TILE_W * pixelSize;
  const hpx = sel.h * TILE_H * pixelSize;

  ctx.save();

  // Fundo translúcido
  ctx.fillStyle = "rgba(80,160,255,0.15)";
  ctx.fillRect(xpx, ypx, wpx, hpx);

  // Borda dupla para contraste
  const black = Math.max(2, Math.floor(pixelSize / 4));
  const white = Math.max(1, Math.floor(black / 2));

  ctx.lineWidth = black;
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  ctx.strokeRect(xpx + 0.5, ypx + 0.5, wpx - 1, hpx - 1);

  ctx.lineWidth = white;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.strokeRect(xpx + 0.5, ypx + 0.5, wpx - 1, hpx - 1);

  ctx.restore();
}

/**
 * Conveniência. Faz o pipeline completo de render:
 * tiles -> grids opcionais -> ghost da seleção (se arrastando) -> borda da seleção.
 */
export function renderCanvas(
  ctx: CanvasRenderingContext2D,
  params: {
    tiles: Uint8Array[];
    palette: string[];
    tilesPerRow: number;
    pixelSize: number;
    columnShift?: number;
    showTileGrid?: boolean;
    showPixelGrid?: boolean;
    selection?: SelectionRect | null;
    selectionPreview?: { dx: number; dy: number } | null; // em tiles
    linePreview?: { ax1: number; ay1: number; ax2: number; ay2: number; colorIndex: number } | null; // em pixels absolutos
  }
): void {
  const { rows } = drawTiles(
    ctx,
    params.tiles,
    params.palette,
    Math.max(1, params.tilesPerRow),
    Math.max(1, params.pixelSize),
    params.columnShift ?? 0
  );

  // Grids (independentes)
  if (params.showTileGrid) {
    drawGrid(
      ctx,
      Math.max(1, params.tilesPerRow),
      rows,
      Math.max(1, params.pixelSize),
      "tile"
    );
  }
  if (params.showPixelGrid) {
    drawGrid(
      ctx,
      Math.max(1, params.tilesPerRow),
      rows,
      Math.max(1, params.pixelSize),
      "pixel"
    );
  }

  // Ghost da seleção durante o drag
  if (params.selection && params.selectionPreview) {
    const { x, y, w, h } = params.selection;
    const { dx, dy } = params.selectionPreview;

    ctx.save();
    ctx.globalAlpha = 0.5; // meio transparente

    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const srcIndex = (y + j) * params.tilesPerRow + (x + i);
        if (srcIndex < 0 || srcIndex >= params.tiles.length) continue;

        const tile = params.tiles[srcIndex];
        if (!tile) continue;

        const dstX = (x + i + dx) * TILE_W * params.pixelSize;
        const dstY = (y + j + dy) * TILE_H * params.pixelSize;

        for (let py = 0; py < TILE_H; py++) {
          for (let px = 0; px < TILE_W; px++) {
            const v = tile[py * TILE_W + px];
            ctx.fillStyle = params.palette[v] || "#FF00FF";
            ctx.fillRect(
              dstX + px * params.pixelSize,
              dstY + py * params.pixelSize,
              params.pixelSize,
              params.pixelSize
            );
          }
        }
      }
    }

    ctx.restore();
  }

  // Preview de linha (Bresenham) em alpha alto
  if (params.linePreview) {
    const { ax1, ay1, ax2, ay2, colorIndex } = params.linePreview;
    const color = params.palette[colorIndex] || "#FF00FF";
    const ps = Math.max(1, params.pixelSize);
    const maxAX = params.tilesPerRow * TILE_W - 1;

    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = color;

    let x1 = Math.max(0, Math.min(ax1, maxAX));
    let y1 = Math.max(0, Math.min(ay1, (ctx.canvas.height / ps) - 1));
    const x2 = Math.max(0, Math.min(ax2, maxAX));
    const y2 = Math.max(0, Math.min(ay2, (ctx.canvas.height / ps) - 1));
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    for (;;) {
      ctx.fillRect(x1 * ps, y1 * ps, ps, ps);
      if (x1 === x2 && y1 === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x1 += sx; }
      if (e2 < dx) { err += dx; y1 += sy; }
    }

    ctx.restore();
  }

  // Borda da seleção (sempre visível)
  if (params.selection) {
    drawSelection(
      ctx,
      params.selection,
      Math.max(1, params.pixelSize),
      params.selectionPreview?.dx ?? 0,
      params.selectionPreview?.dy ?? 0
    );
  }
}
