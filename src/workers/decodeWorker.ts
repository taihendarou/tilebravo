/// <reference lib="webworker" />
export {};

import { TILE_W, TILE_H } from "../lib/constants";
import type { CodecId } from "../lib/codecs";
import { CODECS } from "../lib/codecs";

type InMsg = {
  bytesBuffer: ArrayBuffer;
  baseOffset: number;
  stride: number;
  codec: CodecId;
};

type OutMsg = {
  pixelsBuffer: ArrayBuffer;
  tilesCount: number;
};

function decodeWithStride(
  bytes: Uint8Array,
  baseOffset: number,
  stride: number,
  codecId: CodecId
): { pixels: Uint8Array; tilesCount: number } {
  const codec = CODECS[codecId];
  const end = bytes.length;
  const step = Math.max(codec.bytesPerTile, stride | 0);
  let base = Math.max(0, baseOffset | 0);

  // calcula quantidade de tiles para alocar de uma vez
  let count = 0; let p = base;
  while (p + codec.bytesPerTile <= end) { count++; p += step; }

  const out = new Uint8Array(count * (TILE_W * TILE_H));
  let k = 0;
  p = base;
  while (p + codec.bytesPerTile <= end) {
    const slice = bytes.subarray(p, p + codec.bytesPerTile);
    const decoded = codec.decodeTile(slice); // 64 entries
    out.set(decoded, k);
    k += TILE_W * TILE_H;
    p += step;
  }
  return { pixels: out, tilesCount: count };
}

self.onmessage = (e: MessageEvent<InMsg>) => {
  const { bytesBuffer, baseOffset, stride, codec } = e.data;
  const bytes = new Uint8Array(bytesBuffer);
  const { pixels, tilesCount } = decodeWithStride(bytes, baseOffset, stride, codec);
  const msg: OutMsg = { pixelsBuffer: pixels.buffer, tilesCount };
  // transfer buffer para evitar cópia
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - postMessage on WorkerGlobalScope
  self.postMessage(msg, [pixels.buffer]);
};

