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
    while (base + codecDef.bytesPerTile <= end) {
      const slice = bytes.subarray(base, base + codecDef.bytesPerTile);
      tiles.push(codecDef.decodeTile(slice));
      base += step;
    }

    const out = new Uint8Array(tiles.length * tileSize);
    for (let i = 0; i < tiles.length; i++) {
      out.set(tiles[i], i * tileSize);
    }
    const res: Res = { pixelsBuffer: out.buffer, tilesCount: tiles.length };
    (self as any).postMessage(res, [out.buffer]);
  } catch (err) {
    // Let main thread fallback
    (self as any).postMessage({ pixelsBuffer: new ArrayBuffer(0), tilesCount: 0 });
  }
};

