// src/lib/codecs/codec-2bpp-linear.ts
import { TILE_W, TILE_H } from "../constants";
import type { TileCodec } from "../types";

const bytesPerTile = 16; // 8x8 pixels * 2 bits/pixel = 128 bits = 16 bytes

function decodeTile(tileBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(TILE_W * TILE_H);

  let byteIndex = 0;
  for (let row = 0; row < TILE_H; row++) {
    for (let col = 0; col < TILE_W; col++) {
      const byte = tileBytes[byteIndex >> 2]; // 4 pixels por byte
      const shift = (3 - (byteIndex & 3)) * 2; // pixel 0 → bits 6-7, pixel 3 → bits 0-1
      const v = (byte >> shift) & 0x03;
      out[row * TILE_W + col] = v;
      byteIndex++;
    }
  }

  return out;
}

function encodeTile(tile: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytesPerTile);

  let byteIndex = 0;
  for (let row = 0; row < TILE_H; row++) {
    for (let col = 0; col < TILE_W; col++) {
      const v = tile[row * TILE_W + col] & 0x03; // 2bpp
      const outByteIndex = byteIndex >> 2;
      const shift = (3 - (byteIndex & 3)) * 2;
      out[outByteIndex] |= v << shift;
      byteIndex++;
    }
  }

  return out;
}

function getPixelByteOffset(px: number, py: number): number {
  // cada linha = TILE_W pixels = 8 pixels = 16 bits = 2 bytes
  // offset = py * 2 + floor(px / 4)
  return py * 2 + (px >> 2);
}

export const codec2bppLinear: TileCodec = {
  id: "2bpp_linear",
  name: "2bpp linear",
  bpp: 2,
  pixelMode: "indexed",
  bytesPerTile,
  colors: 4,

  decodeTile,
  encodeTile,
  getPixelByteOffset,
};
