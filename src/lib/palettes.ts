// src/lib/palettes.ts
export type PaletteDef = { name: string; colors: string[] };

// Helpers
const hx = (x: number) => x.toString(16).padStart(2, "0");

function makeGrayscale(k: number): string[] {
  return Array.from({ length: k }, (_, i) => {
    const t = k === 1 ? 0 : i / (k - 1);
    const v = Math.round(255 * t);
    return `#${hx(v)}${hx(v)}${hx(v)}`.toUpperCase();
  });
}

function gradient(k: number, from: [number, number, number], to: [number, number, number]): string[] {
  return Array.from({ length: k }, (_, i) => {
    const t = k === 1 ? 0 : i / (k - 1);
    const r = Math.round(from[0] + (to[0] - from[0]) * t);
    const g = Math.round(from[1] + (to[1] - from[1]) * t);
    const b = Math.round(from[2] + (to[2] - from[2]) * t);
    return `#${hx(r)}${hx(g)}${hx(b)}`.toUpperCase();
  });
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (f: number) => Math.round((f + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rainbowN(k: number): string[] {
  return Array.from({ length: k }, (_, i) => {
    const h = (i / Math.max(1, k)) * 360;
    return hsvToHex(h, 1.0, 1.0);
  });
}

function lcg(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed >>> 0) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function vividRandom(n: number, seed: number): string[] {
  const rnd = lcg(seed);
  const out: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const h = rnd() * 360;
    const s = 0.85 + 0.15 * rnd();
    const v = 0.80 + 0.20 * rnd();
    out[i] = hsvToHex(h, s, v);
  }
  return out.map((_, i) => out[(i * 73) % n]);
}

function checkerVivid(n: number): string[] {
  const out: string[] = new Array(n);
  const cols = Math.min(16, Math.max(1, Math.round(Math.sqrt(n))));
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const base = (row * 37 + col * 61) % 360;
    const h = (base + (row * 19) + (col * 7)) % 360;
    const s = 0.9;
    const v = ((row ^ col) & 1) ? 1.0 : 0.78;
    out[i] = hsvToHex(h, s, v);
  }
  return out;
}

function xorScramble(n: number): string[] {
  const out: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const rot = ((i << 5) | (i >>> 3)) & 0xFF;
    const j = (i ^ rot ^ 0xA5) & 0xFF;
    const h = (j / 256) * 360;
    const s = 0.95;
    const v = ((i & 3) === 0) ? 1.0 : ((i & 3) === 1 ? 0.88 : 0.76);
    out[i] = hsvToHex(h, s, v);
  }
  return out;
}

// 8bpp helper (RGB 332 mapping). For n<256, we still generate n entries by truncation.
function rgb332(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const r3 = (i >> 5) & 0x07;
    const g3 = (i >> 2) & 0x07;
    const b2 = i & 0x03;
    const r = Math.round((r3 / 7) * 255);
    const g = Math.round((g3 / 7) * 255);
    const b = Math.round((b2 / 3) * 255);
    out.push(`#${hx(r)}${hx(g)}${hx(b)}`.toUpperCase());
  }
  return out;
}

export function defaultPalettesFor(n: number): PaletteDef[] {
  const reverse = (arr: string[]) => arr.slice().reverse();
  const clampN = (arr: string[]) => arr.slice(0, n);

  if (n <= 4) {
    const gray = makeGrayscale(4);
    return [
      { name: "Grayscale", colors: clampN(gray) },
      { name: "Grayscale Inverted", colors: clampN(reverse(gray)) },
      { name: "GameBoy", colors: clampN(["#0F380F", "#306230", "#8BAC0F", "#9BBC0F"]) },
      { name: "Primary Contrast", colors: clampN(["#000000", "#FF0000", "#00FF00", "#0000FF"]) },
      { name: "Blue/Orange", colors: clampN(["#0B1E3B", "#E76F51", "#2A9D8F", "#FFFFFF"]) },
      // contrast-rich variants
      { name: "Vivid 4 A", colors: clampN(vividRandom(4, 0xC0FFEE)) },
      { name: "Vivid 4 B", colors: clampN(vividRandom(4, 0xBADC0DE)) },
      { name: "Checker 4", colors: clampN(checkerVivid(4)) },
      { name: "XOR 4", colors: clampN(xorScramble(4)) },
    ];
  }

  if (n <= 16) {
    const gray16 = makeGrayscale(16);
    const cool = gradient(16, [10, 20, 60], [180, 220, 255]);
    const warm = gradient(16, [60, 20, 10], [255, 220, 180]);
    const rainbow = rainbowN(16);
    return [
      { name: "Grayscale", colors: gray16.slice(0, n) },
      { name: "Grayscale Inverted", colors: reverse(gray16).slice(0, n) },
      { name: "Rainbow", colors: rainbow.slice(0, n) },
      { name: "Cool → Light", colors: cool.slice(0, n) },
      { name: "Warm ← Dark", colors: reverse(warm).slice(0, n) },
      // 16-color contrast presets
      { name: "Vivid 16 A", colors: vividRandom(n, 0xC0FFEE) },
      { name: "Vivid 16 B", colors: vividRandom(n, 0xBADC0DE) },
      { name: "Checker 16", colors: checkerVivid(n) },
      { name: "XOR 16", colors: xorScramble(n) },
    ];
  }

  if (n <= 256) {
    const coolToWarm = gradient(n, [10, 20, 60], [255, 220, 180]);
    const warmToDark = gradient(n, [255, 220, 180], [60, 20, 10]).reverse();
    return [
      { name: "Grayscale", colors: makeGrayscale(n) },
      { name: "Grayscale Inverted", colors: makeGrayscale(n).reverse() },
      { name: "Rainbow", colors: rainbowN(n) },
      { name: "Cool → Warm", colors: coolToWarm },
      { name: "Warm ← Dark", colors: warmToDark },
      { name: "RGB 332", colors: rgb332(n) },
      { name: "Vivid Random A", colors: vividRandom(n, 0xC0FFEE) },
      { name: "Vivid Random B", colors: vividRandom(n, 0xBADC0DE) },
      { name: "Vivid Random C", colors: vividRandom(n, 0xDEADBEEF) },
      { name: "Checker Vivid", colors: checkerVivid(n) },
      { name: "XOR Scramble", colors: xorScramble(n) },
    ];
  }

  return [{ name: "Grayscale", colors: makeGrayscale(n) }];
}

