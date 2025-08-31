/// <reference lib="webworker" />
export {};

// Worker: decode tiles with stride off the main thread
import { CODECS } from "../../lib/codecs";
import { TILE_W, TILE_H } from "../../lib/constants";

type Req = {
  bytesBuffer: ArrayBuffer;
  baseOffset: number;
  stride: number;
  codec: keyof typeof CODECS;
};

type Res = {
  pixelsBuffer: ArrayBuffer;
  tilesCount: number;
};

self.onmessage = function (ev: MessageEvent<Req>) {
  try {
    const { bytesBuffer, baseOffset, stride, codec } = ev.data;
    const codecDef = CODECS[codec];
    if (!codecDef) throw new Error("Unknown codec: " + String(codec));
    const bytes = new Uint8Array(bytesBuffer);
    const end = bytes.length;
    const step = Math.max(codecDef.bytesPerTile, stride | 0);
    let base = Math.max(0, baseOffset | 0);
    const tileSize = TILE_W * TILE_H; // 64

    const tiles: Uint8Array[] = [];
    // Full tiles by stride
    while (base + codecDef.bytesPerTile <= end) {
      const slice = bytes.subarray(base, base + codecDef.bytesPerTile);
      tiles.push(codecDef.decodeTile(slice));
      base += step;
    }
    // Remainder tile padded
    if (base < end && end - base > 0) {
      const padded = new Uint8Array(codecDef.bytesPerTile);
      const cut = bytes.subarray(base, Math.min(end, base + codecDef.bytesPerTile));
      padded.set(cut, 0);
      tiles.push(codecDef.decodeTile(padded));
    }
    // Never return empty
    if (tiles.length === 0) {
      if (end > 0) {
        const start = Math.min(Math.max(0, baseOffset | 0), end - 1);
        const padded = new Uint8Array(codecDef.bytesPerTile);
        padded.set(bytes.subarray(start, Math.min(end, start + codecDef.bytesPerTile)), 0);
        tiles.push(codecDef.decodeTile(padded));
      } else {
        tiles.push(new Uint8Array(tileSize));
      }
    }

    const out = new Uint8Array(tiles.length * tileSize);
    for (let i = 0; i < tiles.length; i++) {
      out.set(tiles[i], i * tileSize);
    }
    const res: Res = { pixelsBuffer: out.buffer, tilesCount: tiles.length };
    self.postMessage(res, [out.buffer as ArrayBuffer]);
  } catch {
    // Let main thread fallback
    self.postMessage({ pixelsBuffer: new ArrayBuffer(0), tilesCount: 0 });
  }
};
