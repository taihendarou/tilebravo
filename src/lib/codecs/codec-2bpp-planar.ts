// src/lib/codecs/codec-2bpp-planar.ts
import { TILE_W, TILE_H } from "../constants";
import type { TileCodec } from "../types";

const bytesPerTile = 16;

function decodeTile(tileBytes: Uint8Array): Uint8Array {
  // tileBytes.length deve ser 16
  const out = new Uint8Array(TILE_W * TILE_H);
  for (let row = 0; row < TILE_H; row++) {
    const lo = tileBytes[row * 2 + 0];
    const hi = tileBytes[row * 2 + 1];
    for (let x = 0; x < TILE_W; x++) {
      const bit = 7 - x;
      const b0 = (lo >> bit) & 1;
      const b1 = (hi >> bit) & 1;
      out[row * TILE_W + x] = (b1 << 1) | b0; // 0..3
    }
  }
  return out;
}

function encodeTile(tile: Uint8Array): Uint8Array {
  // tile.length deve ser 64
  const out = new Uint8Array(bytesPerTile);
  for (let row = 0; row < TILE_H; row++) {
    let lo = 0;
    let hi = 0;
    for (let x = 0; x < TILE_W; x++) {
      const v = tile[row * TILE_W + x] & 0b11; // 2bpp
      const bit = 7 - x;
      lo |= (v & 0b01) << bit;
      hi |= ((v >> 1) & 0b01) << bit;
    }
    out[row * 2 + 0] = lo;
    out[row * 2 + 1] = hi;
  }
  return out;
}

function getPixelByteOffset(_px: number, py: number): number {
  return py * 2; // cada linha ocupa 2 bytes (lo/hi)
}

export const codec2bppPlanar: TileCodec = {
  id: "2bpp_planar",
  name: "2bpp planar",
  bpp: 2,
  pixelMode: "indexed",
  bytesPerTile,
  colors: 4, // <- use este campo (antes você chamou de paletteSize)
  // Opcional: pode sugerir uma paleta padrão
  // defaultPalette: ["#000000", "#555555", "#AAAAAA", "#FFFFFF"],

  decodeTile,
  encodeTile,
  getPixelByteOffset,
};
