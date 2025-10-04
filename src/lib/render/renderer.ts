import { TILE_W, TILE_H } from "../constants";

function mapOrigToDisplay(x: number, y: number): { dx: number; dy: number } {
  const xOdd = (x & 1) === 1;
  const yOdd = (y & 1) === 1;
  if (xOdd && !yOdd) return { dx: x - 1, dy: y + 1 };
  if (!xOdd && yOdd) return { dx: x + 1, dy: y - 1 };
  return { dx: x, dy: y };
}

function mapDisplayToOrig(tx: number, ty: number): { ox: number; oy: number } {
  const xOdd = (tx & 1) === 1;
  const yOdd = (ty & 1) === 1;
  if (xOdd && !yOdd) return { ox: tx - 1, oy: ty + 1 };
  if (!xOdd && yOdd) return { ox: tx + 1, oy: ty - 1 };
  return { ox: tx, oy: ty };
}

function computeRowsOut(totalTiles: number, colsIn: number, rowInterleaved: boolean): number {
  const rowsIn = Math.max(1, Math.ceil(totalTiles / colsIn));
  if (!rowInterleaved) return rowsIn;
  const rem = totalTiles % colsIn;
  const lastRowEven = ((rowsIn - 1) & 1) === 0;
  return rowsIn + (rem >= 2 && lastRowEven ? 1 : 0);
}

function drawEmptyMarker(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, pixelSize: number) {
  ctx.save();
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const size = Math.max(6, Math.min(w, h) * 0.35);
  const half = size / 2;
  ctx.strokeStyle = "rgba(220, 60, 60, 0.55)";
  ctx.lineWidth = Math.max(1, Math.floor(pixelSize));
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - half, cy - half);
  ctx.lineTo(cx + half, cy + half);
  ctx.moveTo(cx + half, cy - half);
  ctx.lineTo(cx - half, cy + half);
  ctx.stroke();
  ctx.restore();
}

/** Retângulo de seleção em unidades de TILE (não pixels). */
export type SelectionRect = { x: number; y: number; w: number; h: number };

export function drawTiles(
  ctx: CanvasRenderingContext2D,
  tiles: Uint8Array[],
  palette: string[],
  tilesPerRow: number,
  pixelSize: number,
  columnShift: number = 0,
  rowInterleaved: boolean = false,
  overlayTiles?: Map<number, Uint8Array>,
  emptyTiles?: Set<number>
): { width: number; height: number; rows: number } {
  const totalTiles = tiles.length;
  const colsIn = Math.max(1, tilesPerRow | 0);
  const rowsOut = computeRowsOut(totalTiles, colsIn, rowInterleaved);

  const width = colsIn * TILE_W * pixelSize;
  const height = rowsOut * TILE_H * pixelSize;

  if (ctx.canvas.width !== width) ctx.canvas.width = width;
  if (ctx.canvas.height !== height) ctx.canvas.height = height;
  ctx.clearRect(0, 0, width, height);

  for (let i = 0; i < totalTiles; i++) {
    const tile = overlayTiles?.get(i) || tiles[i];
    const ox = i % colsIn;
    const oy = Math.floor(i / colsIn);
    let dx = ox;
    let dy = oy;
    if (rowInterleaved) {
      const mapped = mapOrigToDisplay(ox, oy);
      dx = mapped.dx;
      dy = mapped.dy;
    }
    const visX = ((dx - (columnShift % colsIn)) + colsIn) % colsIn;

    for (let py = 0; py < TILE_H; py++) {
      let runColor = -1;
      let runStart = 0;
      for (let px = 0; px < TILE_W; px++) {
        const val = tile[py * TILE_W + px] | 0;
        if (px === 0) { runColor = val; runStart = 0; continue; }
        if (val !== runColor) {
          ctx.fillStyle = palette[runColor] || "#FF00FF";
          const rx = (visX * TILE_W + runStart) * pixelSize;
          const ry = (dy * TILE_H + py) * pixelSize;
          const rw = (px - runStart) * pixelSize;
          ctx.fillRect(rx, ry, rw, pixelSize);
          runColor = val;
          runStart = px;
        }
      }
      ctx.fillStyle = palette[runColor] || "#FF00FF";
      const rx = (visX * TILE_W + runStart) * pixelSize;
      const ry = (dy * TILE_H + py) * pixelSize;
      const rw = (TILE_W - runStart) * pixelSize;
      ctx.fillRect(rx, ry, rw, pixelSize);
    }

    if (emptyTiles && emptyTiles.has(i)) {
      const x0 = visX * TILE_W * pixelSize;
      const y0 = dy * TILE_H * pixelSize;
      const w = TILE_W * pixelSize;
      const h = TILE_H * pixelSize;
      drawEmptyMarker(ctx, x0, y0, w, h, pixelSize);
    }
  }

  return { width, height, rows: rowsOut };
}

export function drawTilesRegion(
  ctx: CanvasRenderingContext2D,
  tiles: Uint8Array[],
  palette: string[],
  tilesPerRow: number,
  pixelSize: number,
  columnShift: number,
  rowInterleaved: boolean,
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  overlayTiles?: Map<number, Uint8Array>,
  emptyTiles?: Set<number>
): void {
  const totalTiles = tiles.length;
  if (totalTiles === 0 || aw <= 0 || ah <= 0) return;

  const colsIn = Math.max(1, tilesPerRow | 0);
  const rowsOut = computeRowsOut(totalTiles, colsIn, rowInterleaved);

  const xpx = Math.max(0, Math.floor(ax * pixelSize));
  const ypx = Math.max(0, Math.floor(ay * pixelSize));
  const wpx = Math.ceil(aw * pixelSize);
  const hpx = Math.ceil(ah * pixelSize);

  ctx.save();
  ctx.beginPath();
  ctx.rect(xpx, ypx, wpx, hpx);
  ctx.clip();
  ctx.clearRect(xpx, ypx, wpx, hpx);

  const colShift = columnShift % Math.max(1, colsIn);

  const minTX = Math.max(0, Math.floor(ax / TILE_W));
  const maxTX = Math.min(colsIn - 1, Math.floor((ax + aw - 1) / TILE_W));
  const minTY = Math.max(0, Math.floor(ay / TILE_H));
  const maxTY = Math.min(rowsOut - 1, Math.floor((ay + ah - 1) / TILE_H));

  for (let ty = minTY; ty <= maxTY; ty++) {
    for (let tx = minTX; tx <= maxTX; tx++) {
      let qx = tx;
      let qy = ty;
      if (rowInterleaved) {
        const mapped = mapDisplayToOrig(tx, ty);
        qx = mapped.ox;
        qy = mapped.oy;
      }
      const i = qy * colsIn + qx;
      if (i < 0 || i >= totalTiles) continue;
      const tile = overlayTiles?.get(i) || tiles[i];
      if (!tile) continue;

      const visX = ((tx - colShift) + colsIn) % colsIn;
      const tileAx = visX * TILE_W;
      const tileAy = ty * TILE_H;

      const x1 = Math.max(ax, tileAx);
      const y1 = Math.max(ay, tileAy);
      const x2 = Math.min(ax + aw, tileAx + TILE_W);
      const y2 = Math.min(ay + ah, tileAy + TILE_H);
      if (x2 <= x1 || y2 <= y1) continue;

      const pxStart = x1 - tileAx;
      const pxEnd = x2 - tileAx;
      const pyStart = y1 - tileAy;
      const pyEnd = y2 - tileAy;

      for (let py = pyStart; py < pyEnd; py++) {
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
        ctx.fillStyle = palette[runColor] || "#FF00FF";
        const rx = (tileAx + runBeg) * pixelSize;
        const ry = (tileAy + py) * pixelSize;
        const rw = (pxEnd - runBeg) * pixelSize;
        ctx.fillRect(rx, ry, rw, pixelSize);
      }

      if (emptyTiles && emptyTiles.has(i)) {
        const x0 = tileAx * pixelSize;
        const y0 = tileAy * pixelSize;
        const w = TILE_W * pixelSize;
        const h = TILE_H * pixelSize;
        drawEmptyMarker(ctx, x0, y0, w, h, pixelSize);
      }
    }
  }

  ctx.restore();
}

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
    const thick = Math.max(2, Math.floor(pixelSize / 4));
    const thin = Math.max(1, Math.floor(thick / 2));

    const pass = (color: string, lw: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.setLineDash([]);
      ctx.beginPath();
      for (let y = 0; y <= rows; y++) {
        const ypx = y * TILE_H * pixelSize;
        ctx.moveTo(0, ypx);
        ctx.lineTo(canvasW, ypx);
      }
      for (let x = 0; x <= tilesPerRow; x++) {
        const xpx = x * TILE_W * pixelSize;
        ctx.moveTo(xpx, 0);
        ctx.lineTo(xpx, canvasH);
      }
      ctx.stroke();
    };

    pass("rgba(0,0,0,0.9)", thick);
    pass("rgba(255,255,255,0.9)", thin);
  }

  if (kind === "pixel") {
    ctx.lineWidth = 1;

    const drawPass = (stroke: string) => {
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      for (let y = 0; y <= canvasH; y += pixelSize) {
        const ypx = Math.round(y) + 0.5;
        ctx.moveTo(0, ypx);
        ctx.lineTo(canvasW, ypx);
      }
      for (let x = 0; x <= canvasW; x += pixelSize) {
        const xpx = Math.round(x) + 0.5;
        ctx.moveTo(xpx, 0);
        ctx.lineTo(xpx, canvasH);
      }
      ctx.stroke();
    };

    drawPass("rgba(0,0,0,0.22)");
    drawPass("rgba(255,255,255,0.12)");
  }

  ctx.restore();
}

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

  ctx.fillStyle = "rgba(80,160,255,0.15)";
  ctx.fillRect(xpx, ypx, wpx, hpx);

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

export function renderCanvas(
  ctx: CanvasRenderingContext2D,
  params: {
    tiles: Uint8Array[];
    palette: string[];
    tilesPerRow: number;
    pixelSize: number;
    columnShift?: number;
    rowInterleaved?: boolean;
    showTileGrid?: boolean;
    showPixelGrid?: boolean;
    selection?: SelectionRect | null;
    selectionPreview?: { dx: number; dy: number } | null;
    linePreview?: { ax1: number; ay1: number; ax2: number; ay2: number; colorIndex: number } | null;
    overlayTiles?: Map<number, Uint8Array> | null;
    emptyTiles?: Set<number> | null;
  }
): void {
  const colsIn = Math.max(1, params.tilesPerRow);
  const { rows } = drawTiles(
    ctx,
    params.tiles,
    params.palette,
    colsIn,
    Math.max(1, params.pixelSize),
    params.columnShift ?? 0,
    !!params.rowInterleaved,
    params.overlayTiles ?? undefined,
    params.emptyTiles ?? undefined
  );

  if (params.showTileGrid) {
    drawGrid(ctx, colsIn, rows, Math.max(1, params.pixelSize), "tile");
  }
  if (params.showPixelGrid) {
    drawGrid(ctx, colsIn, rows, Math.max(1, params.pixelSize), "pixel");
  }

  if (params.selection && params.selectionPreview) {
    const { x, y, w, h } = params.selection;
    const { dx, dy } = params.selectionPreview;

    ctx.save();
    ctx.globalAlpha = 0.5;

    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let srcIndex: number;
        if (params.rowInterleaved) {
          const src = mapDisplayToOrig(x + i, y + j);
          srcIndex = src.oy * colsIn + src.ox;
        } else {
          srcIndex = (y + j) * colsIn + (x + i);
        }
        if (srcIndex < 0 || srcIndex >= params.tiles.length) continue;
        const tile = params.tiles[srcIndex];
        if (!tile) continue;

        const dstX = (x + i + dx) * TILE_W * params.pixelSize;
        const dstY = (y + j + dy) * TILE_H * params.pixelSize;

        for (let py = 0; py < TILE_H; py++) {
          for (let px = 0; px < TILE_W; px++) {
            const v = tile[py * TILE_W + px];
            ctx.fillStyle = params.palette[v] || "#FF00FF";
            ctx.fillRect(dstX + px * params.pixelSize, dstY + py * params.pixelSize, params.pixelSize, params.pixelSize);
          }
        }
      }
    }

    ctx.restore();
  }

  if (params.linePreview) {
    const { ax1, ay1, ax2, ay2, colorIndex } = params.linePreview;
    const color = params.palette[colorIndex] || "#FF00FF";
    const ps = Math.max(1, params.pixelSize);
    const maxAX = colsIn * TILE_W - 1;

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

export function renderCanvasRegion(
  ctx: CanvasRenderingContext2D,
  params: {
    tiles: Uint8Array[];
    palette: string[];
    tilesPerRow: number;
    pixelSize: number;
    columnShift?: number;
    rowInterleaved?: boolean;
    showTileGrid?: boolean;
    showPixelGrid?: boolean;
    selection?: SelectionRect | null;
    selectionPreview?: { dx: number; dy: number } | null;
    linePreview?: { ax1: number; ay1: number; ax2: number; ay2: number; colorIndex: number } | null;
    overlayTiles?: Map<number, Uint8Array> | null;
    emptyTiles?: Set<number> | null;
  },
  rect: { ax: number; ay: number; aw: number; ah: number }
): void {
  const colsIn = Math.max(1, params.tilesPerRow);
  const rowsOut = computeRowsOut(params.tiles.length, colsIn, !!params.rowInterleaved);

  const ps = Math.max(1, params.pixelSize);

  drawTilesRegion(
    ctx,
    params.tiles,
    params.palette,
    colsIn,
    ps,
    params.columnShift ?? 0,
    !!params.rowInterleaved,
    rect.ax,
    rect.ay,
    rect.aw,
    rect.ah,
    params.overlayTiles ?? undefined,
    params.emptyTiles ?? undefined
  );

  if (params.showTileGrid || params.showPixelGrid) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.ax * ps, rect.ay * ps, rect.aw * ps, rect.ah * ps);
    ctx.clip();
    if (params.showTileGrid) drawGrid(ctx, colsIn, rowsOut, ps, "tile");
    if (params.showPixelGrid) drawGrid(ctx, colsIn, rowsOut, ps, "pixel");
    ctx.restore();
  }

  if (params.selection && params.selectionPreview) {
    const { x, y, w, h } = params.selection;
    const { dx, dy } = params.selectionPreview;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.rect(rect.ax * ps, rect.ay * ps, rect.aw * ps, rect.ah * ps);
    ctx.clip();

    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let srcIndex: number;
        if (params.rowInterleaved) {
          const src = mapDisplayToOrig(x + i, y + j);
          srcIndex = src.oy * colsIn + src.ox;
        } else {
          srcIndex = (y + j) * colsIn + (x + i);
        }
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

  if (params.selection) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.ax * ps, rect.ay * ps, rect.aw * ps, rect.ah * ps);
    ctx.clip();
    drawSelection(ctx, params.selection, ps, params.selectionPreview?.dx ?? 0, params.selectionPreview?.dy ?? 0);
    ctx.restore();
  }

  if (params.linePreview) {
    const { ax1, ay1, ax2, ay2, colorIndex } = params.linePreview;
    const color = params.palette[colorIndex] || "#FF00FF";
    const maxAX = colsIn * TILE_W - 1;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.ax * ps, rect.ay * ps, rect.aw * ps, rect.ah * ps);
    ctx.clip();
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
}
