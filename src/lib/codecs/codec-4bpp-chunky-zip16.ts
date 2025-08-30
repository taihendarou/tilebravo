/**
 * TileBravo codec: 4bpp chunky (zip16)
 *
 * Contexto: necessidade do jogo Yu Yu Hakusho Final no SNES.
 * O PPU trabalha com tiles 4bpp em layout planar. Cada tile 8x8 ocupa 32 bytes.
 * Na VRAM o arranjo é 4 planos separados por linha. O codec 4bpp_planar já cobre isso.
 *
 * Problema: quando extraímos gráficos diretamente da ROM após descompressão do jogo,
 * os dados não estão em planar. Estão em formato "chunky" de 4bpp: cada byte armazena
 * dois pixels (nibble baixo e nibble alto). O tamanho por tile continua 32 bytes,
 * porém o layout é pares de pixels em sequência e não planos separados.
 *
 * Rotina do jogo: antes de enviar à VRAM, o jogo executa uncompress_and_move.
 * Essa rotina aplica um embaralhamento por blocos de 16 bytes:
 *
 *   entrada: [00 01 02 03 04 05 06 07 | 08 09 0A 0B 0C 0D 0E 0F]
 *   saída:   [00 08 01 09 02 0A 03 0B 04 0C 05 0D 06 0E 07 0F]
 *
 * Ou seja, intercala a primeira metade com a segunda metade do bloco.
 * Esse "zip16" é aplicado bloco a bloco. Quando você faz zip16 nos 32 bytes do tile
 * em duas metades de 16 bytes, o resultado passa a ter o mesmo layout que a VRAM espera,
 * então o mesmo decodificador planar funciona e a imagem aparece correta.
 *
 * Linha de raciocínio do codec:
 * 1) Precisamos ler direto o arquivo extraído sem pré-processar fora do editor.
 * 2) O jogo transforma chunky em planar fazendo zip16 em cada metade de 16 bytes.
 * 3) Em vez de reimplementar toda a lógica de bits do planar, reutilizamos o codec existente:
 *    no decode: aplicamos zip16 em [0..15] e [16..31], concatenamos e chamamos
 *    codec4bppPlanar.decodeTile(...) para obter os 64 índices 0..15.
 *    no encode: geramos os 32 bytes em planar com codec4bppPlanar.encodeTile(...),
 *    depois aplicamos o inverso do zip16 em cada metade para voltar ao layout chunky,
 *    garantindo roundtrip fiel ao arquivo de origem.
 *
 * Benefícios:
 * - O editor passa a visualizar imediatamente dumps extraídos da ROM de YYH Final.
 * - Encode salva no mesmo formato que entrou, útil para edições e reinserção.
 * - Reuso do codec planar mantém consistência e reduz chance de bugs.
 *
 * Detalhes de implementação:
 * - bytesPerTile = 32 continua igual.
 * - zip16(b): [0,8,1,9,2,10,3,11,4,12,5,13,6,14,7,15].
 * - unzip16 é o inverso, espelha a mesma regra. Ambos espelham o script Python usado no projeto.
 * - getPixelByteOffset retorna o deslocamento no formato original chunky
 *   cálculo: 2 pixels por byte, 4 bytes por linha, offset = py * 4 + floor(px / 2).
 *   Isso ajuda a StatusBar a exibir endereços coerentes com o arquivo de entrada.
 *
 * Uso:
 * - Selecione "4bpp chunky (zip16)" no painel Decode.
 * - Stride mínimo de 32 bytes por tile. Ajuste stride se o arquivo tiver padding ou interleaves.
 *
 * Verificação recomendada:
 * - Roundtrip: encodeTile(decodeTile(bytes)) deve reproduzir os 32 bytes originais.
 * - Visual: o mesmo tile, após process_file(..., "to_vram") do script Python, deve ser idêntico
 *   quando aberto como 4bpp planar. Abrindo o arquivo bruto com este codec também deve bater.
 *
 * Limitações conhecidas:
 * - O codec assume que o dump está alinhado por tiles de 32 bytes com o embaralhamento zip16 padrão.
 * - Se houver headers, padding ou blocos de compressão residuais, ajuste baseOffset e stride na UI.
 */


// src/lib/codecs/codec-4bpp-chunky-zip16.ts
import type { TileCodec } from "../types";
import { codec4bppPlanar } from "./codec-4bpp-planar";

/** 16 bytes: [0..7 | 8..15] -> [0,8,1,9,...,7,15] */
// [0..7 | 8..15] -> [0,8,1,9,2,10,3,11,4,12,5,13,6,14,7,15]
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

const bytesPerTile = 32;

function decodeTile(tileBytes: Uint8Array): Uint8Array {
    // Converte chunky -> "planar layout" via zip16 em cada metade, depois decodifica como 4bpp planar.
    const z = new Uint8Array(32);
    z.set(zip16(tileBytes.subarray(0, 16)), 0);
    z.set(zip16(tileBytes.subarray(16, 32)), 16);
    return codec4bppPlanar.decodeTile(z);
}

function encodeTile(tile: Uint8Array): Uint8Array {
    // Primeiro gera bytes 4bpp planar. Depois aplica unzip16 em cada metade para voltar ao formato chunky.
    const planar = codec4bppPlanar.encodeTile(tile);
    const out = new Uint8Array(32);
    out.set(unzip16(planar.subarray(0, 16)), 0);
    out.set(unzip16(planar.subarray(16, 32)), 16);
    return out;
}

/** Byte-base no formato original chunky: 2 px por byte, 4 bytes por linha. */
function getPixelByteOffset(px: number, py: number): number {
    return py * 4 + Math.floor(px / 2);
}

export const codec4bppChunkyZip16: TileCodec = {
    id: "4bpp_chunky_zip16",
    name: "4bpp chunky (zip16)",
    bpp: 4,
    pixelMode: "indexed",
    bytesPerTile,
    colors: 16,
    decodeTile,
    encodeTile,
    getPixelByteOffset,
};
