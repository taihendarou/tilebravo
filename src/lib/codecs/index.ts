// src/lib/codecs/index.ts
import type { TileCodec } from "../types";
import { codec1bppLinear } from "./codec-1bpp-linear";
import { codec2bppPlanar } from "./codec-2bpp-planar";
import { codec2bppLinear } from "./codec-2bpp-linear";
import { codec4bppPlanar } from "./codec-4bpp-planar";
import { codec2bppPlanarComposite } from "./codec-2bpp-planar-composite";
import { codec4bppChunkyZip16 } from "./codec-4bpp-chunky-zip16";
import { codec4bppLinearReverse } from "./codec-4bpp-linear-reverse";
import { codec4bppLinear } from "./codec-4bpp-linear";
import { codec8bppPlanar } from "./codec-8bpp-planar";
import { codec8bppLinear } from "./codec-8bpp-linear";

export const CODECS: Record<string, TileCodec> = {
  [codec1bppLinear.id]: codec1bppLinear,
  [codec2bppPlanar.id]: codec2bppPlanar,
  [codec2bppLinear.id]: codec2bppLinear,
  [codec4bppPlanar.id]: codec4bppPlanar,
  [codec2bppPlanarComposite.id]: codec2bppPlanarComposite,
  [codec4bppChunkyZip16.id]: codec4bppChunkyZip16,
  [codec4bppLinearReverse.id]: codec4bppLinearReverse,
  [codec4bppLinear.id]: codec4bppLinear,
  [codec8bppPlanar.id]: codec8bppPlanar,
  [codec8bppLinear.id]: codec8bppLinear,
};

export const AVAILABLE_CODECS: TileCodec[] = Object.values(CODECS);
export type CodecId = keyof typeof CODECS;
