# TileBravo (Beta)

Version: v0.3.0-beta.1

TileBravo is a tile editor created for ROM hacking and translation of classic tile‑based games — an alternative/complement to editors like Tile Molester and YY‑CHR.

## Public Version

- Live: https://tilebravo.hextinkers.org/
- GitHub: https://github.com/taihendarou/tilebravo

## Usage (quick tour)

- Open a ROM/asset file, pick a codec/stride and start exploring tiles.
- Use selection/pencil/line/bucket to edit; copy/paste regions.
- Manage palettes (new, duplicate, import/export).
- Use the status bar to inspect offsets and change theme.

## Last features (v0.3.0-beta.1)

- Multiple codecs (2bpp planar, 4bpp planar, 2bpp planar composite, 4bpp chunky zip16).
- Palette editing (create, duplicate, import/export) and color picking.
- Tools: selection, pencil, eyedropper, line, bucket.
- Linear tile stepping (view-only), zoom, tile/pixel grid overlays.
- Import PNG (multiples of 8 px); export BIN; PNG export for previews.

## Features for next release

- New codecs
- Byte stepping (navigate by byte offset)
- Palette import in additional emulator formats
- Performance updates
- New themes
- Full user and features documentation
- Undo feature (Ctrl/CMD + Z)

## Credits

- Author: Taihen — https://hextinkers.org
- Stack: Next.js, React, Tailwind, lucide-react

## How to build (to run on your own)

1. Install: `npm install`
2. Dev: `npm run dev`
3. Build: `npm run build` then `npm start`

## License

MIT — permissive use and redistribution allowed with attribution (retain copyright notice).

## Future Work (TBD)

- Hexadecimal visualization with real-time editing
- Tilemap editing
