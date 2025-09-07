// src/lib/codecs/codec-4bpp-linear-reverse.ts
import { TILE_W, TILE_H } from "../constants";
import type { TileCodec } from "../types";

const bytesPerTile = 32; // 8x8 pixels * 4 bits/pixel = 256 bits = 32 bytes

function decodeTile(tileBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(TILE_W * TILE_H);

  let byteIndex = 0;
  for (let row = 0; row < TILE_H; row++) {
    for (let col = 0; col < TILE_W; col++) {
      // cada pixel ocupa 4 bits (nibble)
      const byte = tileBytes[byteIndex >> 1];
      let v: number;
      if (byteIndex & 1) {
        // pixel ímpar: nibble alto
        v = (byte >> 4) & 0x0F;
      } else {
        // pixel par: nibble baixo
        v = byte & 0x0F;
      }

      // "reverse order": pixel 0 está no nibble baixo, pixel 1 no alto, etc
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
      const v = tile[row * TILE_W + col] & 0x0F; // 4bpp
      const outByteIndex = byteIndex >> 1;
      if (byteIndex & 1) {
        // pixel ímpar → nibble alto
        out[outByteIndex] |= v << 4;
      } else {
        // pixel par → nibble baixo
        out[outByteIndex] = v;
      }
      byteIndex++;
    }
  }

  return out;
}

function getPixelByteOffset(px: number, py: number): number {
  // cada linha = TILE_W pixels = 8 pixels = 8 * 4 bits = 32 bits = 4 bytes
  // offset = py * 4 + floor(px / 2)
  return py * 4 + (px >> 1);
}

export const codec4bppLinearReverse: TileCodec = {
  id: "4bpp_linear_reverse",
  name: "4bpp linear (reverse-order)",
  bpp: 4,
  pixelMode: "indexed",
  bytesPerTile,
  colors: 16,

  decodeTile,
  encodeTile,
  getPixelByteOffset,
};
