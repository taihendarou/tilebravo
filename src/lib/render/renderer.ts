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
 * Desenha somente a região (em pixels absolutos) informada.
 * Não redimensiona o canvas. Assume que o tamanho já está correto.
 */
export function drawTilesRegion(
  ctx: CanvasRenderingContext2D,
  tiles: Uint8Array[],
  palette: string[],
  tilesPerRow: number,
  pixelSize: number,
  columnShift: number,
  ax: number,
  ay: number,
  aw: number,
  ah: number
): void {
  const totalTiles = tiles.length;
  if (totalTiles === 0 || aw <= 0 || ah <= 0) return;

  const rows = Math.max(1, Math.ceil(totalTiles / Math.max(1, tilesPerRow)));

  // Clipping e limpeza apenas da área suja
  const xpx = Math.max(0, Math.floor(ax * pixelSize));
  const ypx = Math.max(0, Math.floor(ay * pixelSize));
  const wpx = Math.ceil(aw * pixelSize);
  const hpx = Math.ceil(ah * pixelSize);

  ctx.save();
  ctx.beginPath();
  ctx.rect(xpx, ypx, wpx, hpx);
  ctx.clip();
  ctx.clearRect(xpx, ypx, wpx, hpx);

  const colShift = columnShift % Math.max(1, tilesPerRow);

  // Tiles que intersectam a região
  const minTX = Math.max(0, Math.floor(ax / TILE_W));
  const maxTX = Math.min(tilesPerRow - 1, Math.floor((ax + aw - 1) / TILE_W));
  const minTY = Math.max(0, Math.floor(ay / TILE_H));
  const maxTY = Math.min(rows - 1, Math.floor((ay + ah - 1) / TILE_H));

  for (let ty = minTY; ty <= maxTY; ty++) {
    for (let tx = minTX; tx <= maxTX; tx++) {
      const i = ty * tilesPerRow + tx;
      if (i < 0 || i >= totalTiles) continue;
      const tile = tiles[i];
      if (!tile) continue;

      // posição visual considerando columnShift
      const visX = ((tx - colShift) + tilesPerRow) % tilesPerRow;
      const tileAx = visX * TILE_W;
      const tileAy = ty * TILE_H;

      // Interseção em pixels (absolutos) dentro da tile
      const x1 = Math.max(ax, tileAx);
      const y1 = Math.max(ay, tileAy);
      const x2 = Math.min(ax + aw, tileAx + TILE_W);
      const y2 = Math.min(ay + ah, tileAy + TILE_H);
      if (x2 <= x1 || y2 <= y1) continue;

      const pxStart = x1 - tileAx;
      const pxEnd = x2 - tileAx; // exclusivo
      const pyStart = y1 - tileAy;
      const pyEnd = y2 - tileAy; // exclusivo

      for (let py = pyStart; py < pyEnd; py++) {
        // run-length dentro da janela pxStart..pxEnd
        let runColor = -1;
        let runBeg = pxStart;
        for (let px = pxStart; px < pxEnd; px++) {
          const val = tile[py * TILE_W + px] | 0;
          if (px === pxStart) { runColor = val; runBeg = pxStart; continue; }
          if (val !== runColor) {
            ctx.fillStyle = palette[runColor] || "#FF00FF";
            const rx = (tileAx + runBeg) * pixelSize;
            const ry = (tileAy + py) * pixelSize;
            const rw = (px - runBeg) * pixelSize;
            ctx.fillRect(rx, ry, rw, pixelSize);
            runColor = val;
            runBeg = px;
          }
        }
        // flush último run
        ctx.fillStyle = palette[runColor] || "#FF00FF";
        const rx = (tileAx + runBeg) * pixelSize;
        const ry = (tileAy + py) * pixelSize;
        const rw = (pxEnd - runBeg) * pixelSize;
        ctx.fillRect(rx, ry, rw, pixelSize);
      }
    }
  }

  ctx.restore();
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

/**
 * Versão recortada do render: redesenha apenas uma região em pixels absolutos.
 */
export function renderCanvasRegion(
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
    selectionPreview?: { dx: number; dy: number } | null;
    linePreview?: { ax1: number; ay1: number; ax2: number; ay2: number; colorIndex: number } | null;
  },
  rect: { ax: number; ay: number; aw: number; ah: number }
): void {
  const rows = Math.max(1, Math.ceil(params.tiles.length / Math.max(1, params.tilesPerRow)));

  // pixels da região
  const ps = Math.max(1, params.pixelSize);
  const xpx = Math.max(0, Math.floor(rect.ax * ps));
  const ypx = Math.max(0, Math.floor(rect.ay * ps));
  const wpx = Math.ceil(rect.aw * ps);
  const hpx = Math.ceil(rect.ah * ps);

  // Clip região e redesenha apenas o necessário
  ctx.save();
  ctx.beginPath();
  ctx.rect(xpx, ypx, wpx, hpx);
  ctx.clip();
  ctx.clearRect(xpx, ypx, wpx, hpx);

  drawTilesRegion(
    ctx,
    params.tiles,
    params.palette,
    Math.max(1, params.tilesPerRow),
    ps,
    params.columnShift ?? 0,
    rect.ax,
    rect.ay,
    rect.aw,
    rect.ah
  );

  // Grids dentro do recorte
  if (params.showTileGrid || params.showPixelGrid) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(xpx, ypx, wpx, hpx);
    ctx.clip();
    if (params.showTileGrid) drawGrid(ctx, Math.max(1, params.tilesPerRow), rows, ps, "tile");
    if (params.showPixelGrid) drawGrid(ctx, Math.max(1, params.tilesPerRow), rows, ps, "pixel");
    ctx.restore();
  }

  // Ghost da seleção e linha — também recortados
  if (params.selection && params.selectionPreview) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(xpx, ypx, wpx, hpx);
    ctx.clip();
    const { x, y, w, h } = params.selection;
    const { dx, dy } = params.selectionPreview;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const srcIndex = (y + j) * params.tilesPerRow + (x + i);
        if (srcIndex < 0 || srcIndex >= params.tiles.length) continue;
        const tile = params.tiles[srcIndex];
        if (!tile) continue;
        const dstX = (x + i + dx) * TILE_W * ps;
        const dstY = (y + j + dy) * TILE_H * ps;
        for (let py = 0; py < TILE_H; py++) {
          for (let px = 0; px < TILE_W; px++) {
            const v = tile[py * TILE_W + px];
            ctx.fillStyle = params.palette[v] || "#FF00FF";
            ctx.fillRect(dstX + px * ps, dstY + py * ps, ps, ps);
          }
        }
      }
    }
    ctx.restore();
  }

  if (params.linePreview) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(xpx, ypx, wpx, hpx);
    ctx.clip();
    const { ax1, ay1, ax2, ay2, colorIndex } = params.linePreview;
    const color = params.palette[colorIndex] || "#FF00FF";
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = color;
    let x1 = ax1, y1 = ay1;
    const x2 = ax2, y2 = ay2;
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

  if (params.selection) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(xpx, ypx, wpx, hpx);
    ctx.clip();
    drawSelection(ctx, params.selection, ps, params.selectionPreview?.dx ?? 0, params.selectionPreview?.dy ?? 0);
    ctx.restore();
  }

  ctx.restore();
}
