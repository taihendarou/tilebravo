import { CODECS } from "./codecs";
import type { CodecId } from "./types";

/**
 * Calcula:
 *  - tileOffset: offset do INÍCIO do tile no arquivo (base + stride*index)
 *  - pixelOffset: tileOffset + deslocamento intra-tile (em bytes) do pixel
 * Para 2bpp planar, o intra é py*2 (byte 'lo' da linha).
 */
export function computeOffsets(params: {
  tx: number; ty: number; px: number; py: number;
  tilesPerRow: number;
  baseOffset: number;
  stride: number;
  codec: CodecId;
}): { tileOffset: number; pixelOffset: number } {
  const { tx, ty, px, py, tilesPerRow, baseOffset, stride, codec } = params;

  if (tx < 0 || ty < 0) {
    return { tileOffset: -1, pixelOffset: -1 };
  }

  const codecDef = CODECS[codec];
  const tileIndex = ty * tilesPerRow + tx;
  const step = Math.max(codecDef.bytesPerTile, stride | 0);

  const tileOffset = baseOffset + tileIndex * step;

  // deslocamento intra-tile em BYTES
  const intra = typeof codecDef.getPixelByteOffset === "function"
    ? codecDef.getPixelByteOffset(px, py)
    : 0;

  const pixelOffset = tileOffset + intra;

  return { tileOffset, pixelOffset };
}
