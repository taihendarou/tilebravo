// src/lib/types.ts
export type PixelMode = "indexed" | "direct";

export interface TileCodec {
  /** ID estável usado na UI e no registro */
  id: string;
  /** Nome amigável pra UI */
  name: string;

  /** Bits por pixel "lógico" do formato */
  bpp: number;

  /** indexed = usa paleta; direct = cor direta (RGBA) */
  pixelMode: PixelMode;

  /** Quantos bytes ocupa um tile (8x8) neste formato */
  bytesPerTile: number;

  /** Número de cores suportadas (apenas p/ indexed). Normalmente 2**bpp. */
  colors?: number;

  /** Paleta padrão sugerida (apenas p/ indexed). Tamanho deve = colors. */
  defaultPalette?: string[];

  /** Decodifica bytes de um tile para 64 valores de pixel (índices 0..colors-1 ou valores brutos se direct) */
  decodeTile(tileBytes: Uint8Array): Uint8Array;

  /** Faz o caminho inverso: 64 valores -> bytes do tile */
  encodeTile(tile: Uint8Array): Uint8Array;

  /** Byte-base dentro do tile onde está a linha do pixel (ajuda p/ status/inspeção) */
  getPixelByteOffset(px: number, py: number): number;

}
