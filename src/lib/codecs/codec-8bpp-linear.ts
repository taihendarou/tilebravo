// src/lib/codecs/codec-8bpp-linear.ts
import { TILE_W, TILE_H } from "../constants";
import type { TileCodec } from "../types";

const bytesPerTile = 64; // 8x8 pixels * 8 bits/pixel = 64 bytes

function decodeTile(tileBytes: Uint8Array): Uint8Array {
  // Cada byte já é um pixel (0..255)
  return new Uint8Array(tileBytes);
}

function encodeTile(tile: Uint8Array): Uint8Array {
  // Simplesmente copia de volta
  return new Uint8Array(tile);
}

function getPixelByteOffset(px: number, py: number): number {
  // Cada linha = 8 pixels = 8 bytes
  // offset = py * 8 + px
  return py * TILE_W + px;
}

export const codec8bppLinear: TileCodec = {
  id: "8bpp_linear",
  name: "8bpp linear",
  bpp: 8,
  pixelMode: "indexed",
  bytesPerTile,
  colors: 256,

  decodeTile,
  encodeTile,
  getPixelByteOffset,
};
