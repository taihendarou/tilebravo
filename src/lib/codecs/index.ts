// src/lib/codecs/index.ts
import type { TileCodec } from "../types";
import { codec2bppPlanar } from "./codec-2bpp-planar";
import { codec4bppPlanar } from "./codec-4bpp-planar";
import { codec2bppPlanarComposite } from "./codec-2bpp-planar-composite";
import { codec4bppChunkyZip16 } from "./codec-4bpp-chunky-zip16"; // <-- novo

export const CODECS: Record<string, TileCodec> = {
  [codec2bppPlanar.id]: codec2bppPlanar,
  [codec4bppPlanar.id]: codec4bppPlanar,
  [codec2bppPlanarComposite.id]: codec2bppPlanarComposite,
  [codec4bppChunkyZip16.id]: codec4bppChunkyZip16, // <-- novo
};

export const AVAILABLE_CODECS: TileCodec[] = Object.values(CODECS);
export type CodecId = keyof typeof CODECS;
