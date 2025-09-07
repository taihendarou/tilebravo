// src/lib/codecs/codec-1bpp-linear.ts
import { TILE_W, TILE_H } from "../constants";
import type { TileCodec } from "../types";

const bytesPerTile = 8; // 8 linhas * 1 byte cada = 8 bytes

function decodeTile(tileBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(TILE_W * TILE_H);

  for (let row = 0; row < TILE_H; row++) {
    const b = tileBytes[row]; // cada linha é 1 byte
    for (let col = 0; col < TILE_W; col++) {
      // bit mais significativo = pixel mais à esquerda
      const bit = (b >> (7 - col)) & 1;
      out[row * TILE_W + col] = bit;
    }
  }

  return out;
}

function encodeTile(tile: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytesPerTile);

  for (let row = 0; row < TILE_H; row++) {
    let b = 0;
    for (let col = 0; col < TILE_W; col++) {
      const v = tile[row * TILE_W + col] & 1; // 1bpp
      b |= v << (7 - col);
    }
    out[row] = b;
  }

  return out;
}

function getPixelByteOffset(_px: number, py: number): number {
  // cada linha ocupa 1 byte
  return py;
}

export const codec1bppLinear: TileCodec = {
  id: "1bpp_linear",
  name: "1bpp linear",
  bpp: 1,
  pixelMode: "indexed",
  bytesPerTile,
  colors: 2,

  decodeTile,
  encodeTile,
  getPixelByteOffset,
};
