// src/lib/codecs/codec-8bpp-planar.ts
import { TILE_W, TILE_H } from "../constants";
import type { TileCodec } from "../types";

const bytesPerTile = 64; // 8 bitplanes * 8 linhas * 1 byte/linha = 64

function decodeTile(tileBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(TILE_W * TILE_H);

  for (let row = 0; row < TILE_H; row++) {
    // cada plano tem 8 bytes (um por linha)
    const p0 = tileBytes[row];
    const p1 = tileBytes[8 + row];
    const p2 = tileBytes[16 + row];
    const p3 = tileBytes[24 + row];
    const p4 = tileBytes[32 + row];
    const p5 = tileBytes[40 + row];
    const p6 = tileBytes[48 + row];
    const p7 = tileBytes[56 + row];

    for (let col = 0; col < TILE_W; col++) {
      const bit = 7 - col;
      const b0 = (p0 >> bit) & 1;
      const b1 = (p1 >> bit) & 1;
      const b2 = (p2 >> bit) & 1;
      const b3 = (p3 >> bit) & 1;
      const b4 = (p4 >> bit) & 1;
      const b5 = (p5 >> bit) & 1;
      const b6 = (p6 >> bit) & 1;
      const b7 = (p7 >> bit) & 1;
      out[row * TILE_W + col] =
        (b7 << 7) |
        (b6 << 6) |
        (b5 << 5) |
        (b4 << 4) |
        (b3 << 3) |
        (b2 << 2) |
        (b1 << 1) |
        b0;
    }
  }

  return out;
}

function encodeTile(tile: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytesPerTile);

  for (let row = 0; row < TILE_H; row++) {
    let p0 = 0,
      p1 = 0,
      p2 = 0,
      p3 = 0,
      p4 = 0,
      p5 = 0,
      p6 = 0,
      p7 = 0;

    for (let col = 0; col < TILE_W; col++) {
      const v = tile[row * TILE_W + col] & 0xff; // 8bpp
      const bit = 7 - col;
      p0 |= (v & 0b00000001) << bit;
      p1 |= ((v >> 1) & 0b00000001) << bit;
      p2 |= ((v >> 2) & 0b00000001) << bit;
      p3 |= ((v >> 3) & 0b00000001) << bit;
      p4 |= ((v >> 4) & 0b00000001) << bit;
      p5 |= ((v >> 5) & 0b00000001) << bit;
      p6 |= ((v >> 6) & 0b00000001) << bit;
      p7 |= ((v >> 7) & 0b00000001) << bit;
    }

    out[row] = p0;
    out[8 + row] = p1;
    out[16 + row] = p2;
    out[24 + row] = p3;
    out[32 + row] = p4;
    out[40 + row] = p5;
    out[48 + row] = p6;
    out[56 + row] = p7;
  }

  return out;
}

function getPixelByteOffset(_px: number, py: number): number {
  // cada linha é composta por 8 bytes (um por bitplane)
  return py;
}

export const codec8bppPlanar: TileCodec = {
  id: "8bpp_planar",
  name: "8bpp planar",
  bpp: 8,
  pixelMode: "indexed",
  bytesPerTile,
  colors: 256,

  decodeTile,
  encodeTile,
  getPixelByteOffset,
};
