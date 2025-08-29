// src/lib/codecs/codec-4bpp-planar.ts
import { TILE_W, TILE_H } from "../constants";
import type { TileCodec } from "../types";

const bytesPerTile = 32; // 4 bitplanes * 8 linhas * 2 bytes/linha = 32

function decodeTile(tileBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(TILE_W * TILE_H);
  for (let row = 0; row < TILE_H; row++) {
    const p0 = tileBytes[row * 2 + 0];
    const p1 = tileBytes[row * 2 + 1];
    const p2 = tileBytes[16 + row * 2 + 0];
    const p3 = tileBytes[16 + row * 2 + 1];

    for (let x = 0; x < TILE_W; x++) {
      const bit = 7 - x;
      const b0 = (p0 >> bit) & 1;
      const b1 = (p1 >> bit) & 1;
      const b2 = (p2 >> bit) & 1;
      const b3 = (p3 >> bit) & 1;
      out[row * TILE_W + x] = (b3 << 3) | (b2 << 2) | (b1 << 1) | b0; // 0..15
    }
  }
  return out;
}

function encodeTile(tile: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytesPerTile);
  for (let row = 0; row < TILE_H; row++) {
    let p0 = 0, p1 = 0, p2 = 0, p3 = 0;
    for (let x = 0; x < TILE_W; x++) {
      const v = tile[row * TILE_W + x] & 0x0F; // 4bpp
      const bit = 7 - x;
      p0 |= (v & 0b0001) << bit;
      p1 |= ((v >> 1) & 0b0001) << bit;
      p2 |= ((v >> 2) & 0b0001) << bit;
      p3 |= ((v >> 3) & 0b0001) << bit;
    }
    out[row * 2 + 0] = p0;
    out[row * 2 + 1] = p1;
    out[16 + row * 2 + 0] = p2;
    out[16 + row * 2 + 1] = p3;
  }
  return out;
}

function getPixelByteOffset(_px: number, py: number): number {
  // byte-base do primeiro bitplane da linha; planes 2/3/4 vivem +16 bytes
  return py * 2;
}

export const codec4bppPlanar: TileCodec = {
  id: "4bpp_planar",
  name: "4bpp planar",
  bpp: 4,
  pixelMode: "indexed",
  bytesPerTile,
  colors: 16,
  // defaultPalette opcional (16 entradas):
  // defaultPalette: [...Array(16)].map((_, i) => ...),

  decodeTile,
  encodeTile,
  getPixelByteOffset,
};
