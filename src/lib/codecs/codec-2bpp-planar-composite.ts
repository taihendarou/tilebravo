// src/lib/codecs/codec-nes-2bpp.ts
import { TILE_W, TILE_H } from "../constants";
import type { TileCodec } from "../types";

const bytesPerTile = 16;

function decodeTile(tileBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(TILE_W * TILE_H);
  for (let y = 0; y < TILE_H; y++) {
    const lo = tileBytes[y];      // plano 0 da linha y
    const hi = tileBytes[y + 8];  // plano 1 da linha y
    for (let x = 0; x < TILE_W; x++) {
      const bit = 7 - x;
      const b0 = (lo >> bit) & 1;
      const b1 = (hi >> bit) & 1;
      out[y * TILE_W + x] = (b1 << 1) | b0; // 0..3
    }
  }
  return out;
}

function encodeTile(tile: Uint8Array): Uint8Array {
  // tile.length deve ser 64
  const out = new Uint8Array(bytesPerTile); // zera 16 bytes
  for (let y = 0; y < TILE_H; y++) {
    let lo = 0;
    let hi = 0;
    for (let x = 0; x < TILE_W; x++) {
      const v = tile[y * TILE_W + x] & 0b11;
      const bit = 7 - x;
      lo |= (v & 0b01) << bit;       // plano 0
      hi |= ((v >> 1) & 0b01) << bit; // plano 1
    }
    out[y] = lo;        // bytes 0..7
    out[y + 8] = hi;    // bytes 8..15
  }
  return out;
}

/**
 * Para inspeção: retorna o byte-base (plano 0) da linha do pixel.
 * Observação: o segundo byte da mesma linha fica em y+8 (plano 1).
 */
function getPixelByteOffset(_px: number, py: number): number {
  return py; // plano 0; o par correspondente está em py+8
}

export const codec2bppPlanarComposite: TileCodec = {
  id: "2bpp_planar_composite",
  name: "2bpp planar composite",
  bpp: 2,
  pixelMode: "indexed",
  bytesPerTile,
  colors: 4,
  // você pode definir uma paleta default se quiser:
  // defaultPalette: ["#000000", "#555555", "#AAAAAA", "#FFFFFF"],
  decodeTile,
  encodeTile,
  getPixelByteOffset,
};
