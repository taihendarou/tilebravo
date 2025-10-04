/**
 * TileBravo codec: 2bpp chunky (zip16)
 *
 * Contexto: variação 2bpp do formato chunky com embaralhamento zip16 visto no
 * jogo Yu Yu Hakusho Final (SNES). Cada tile 8x8 ocupa 16 bytes onde cada byte
 * armazena quatro pixels consecutivos (2 bits por pixel).
 *
 * Antes de enviar a tile para a VRAM, o jogo executa uncompress_and_move
 * aplicando um embaralhamento zip16 em blocos de 16 bytes:
 * entrada: [00 01 02 03 04 05 06 07 | 08 09 0A 0B 0C 0D 0E 0F]
 * saída:   [00 08 01 09 02 0A 03 0B 04 0C 05 0D 06 0E 07 0F]
 *
 * Com isso, os dados passam a ter o mesmo layout que o codec planar usa. Este
 * wrapper aplica zip16 durante o decode para reaproveitar codec2bppPlanar e o
 * inverso (unzip16) no encode, garantindo roundtrip fiel ao arquivo original.
 */

// src/lib/codecs/codec-2bpp-chunky-zip16.ts
import type { TileCodec } from "../types";
import { codec2bppPlanar } from "./codec-2bpp-planar";

/** 16 bytes: [0..7 | 8..15] -> [0,8,1,9,...,7,15] */
function zip16(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(16);
  for (let k = 0; k < 8; k++) {
    out[2 * k] = b[k];
    out[2 * k + 1] = b[8 + k];
  }
  return out;
}

// inverso: [0,8,1,9,...,7,15] -> [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]
function unzip16(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(16);
  for (let k = 0; k < 8; k++) {
    out[k] = b[2 * k];
    out[8 + k] = b[2 * k + 1];
  }
  return out;
}

const bytesPerTile = 16;

function decodeTile(tileBytes: Uint8Array): Uint8Array {
  // Converte chunky -> planar aplicando zip16 e delega a codec2bppPlanar.
  const zipped = zip16(tileBytes);
  return codec2bppPlanar.decodeTile(zipped);
}

function encodeTile(tile: Uint8Array): Uint8Array {
  // Gera bytes 2bpp planar e reverte para chunky via unzip16.
  const planar = codec2bppPlanar.encodeTile(tile);
  return unzip16(planar);
}

/** Byte-base no formato original chunky: 4 px por byte, 2 bytes por linha. */
function getPixelByteOffset(px: number, py: number): number {
  return py * 2 + Math.floor(px / 4);
}

export const codec2bppChunkyZip16: TileCodec = {
  id: "2bpp_chunky_zip16",
  name: "2bpp chunky (zip16)",
  bpp: 2,
  pixelMode: "indexed",
  bytesPerTile,
  colors: 4,
  decodeTile,
  encodeTile,
  getPixelByteOffset,
};
