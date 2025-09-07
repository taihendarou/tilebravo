# TileBravo (Beta)

Version: v0.3.1-beta.1 [Changelog](./CHANGELOG.md)

TileBravo is a tile editor created for ROM hacking and translation of classic tile‑based games — an alternative/complement to editors like Tile Molester and YY‑CHR.

## Public Version

- Live: https://tilebravo.hextinkers.org/
- GitHub: https://github.com/taihendarou/tilebravo

## Usage (quick tour)

- Open a ROM/asset file, pick a codec/stride and start exploring tiles.
- Use selection/pencil/line/bucket to edit; copy/paste regions.
- Manage palettes (new, duplicate, import/export).
- Use the status bar to inspect offsets and change theme.

## Planned for Next Release

- New codecs
- Byte stepping (navigate by byte offset)
- Palette import in additional emulator formats
- Performance updates
- New themes
- Full user and features documentation
- Undo feature (Ctrl/CMD + Z)

## Future Work (TBD)

- Select colors from the palette by clicking on them in the toolbar
- Support for primary and secondary colors in editing (use right-click to apply tools with the secondary color)
- Improve copy/paste functionality (paste and move)
- Copy/paste between different tabs
- Import BIN and PNG blocks (without replacing the entire file)
- Sketching area: Free drawing and experimenting area. Rearrange or draw tiles without affecting the original. Copy tiles back to the main editor when ready.
- Hexadecimal visualization with real-time editing
- Tilemap editing
- Mirror Window: Open a secondary window to rearrange tiles visually, while edits remain synced with the original tiles.

## Credits

- Author: Taihen — https://hextinkers.org
- Stack: Next.js, React, Tailwind, lucide-react

## How to build (to run on your own)

1. Install: `npm install`
2. Dev: `npm run dev`
3. Build: `npm run build` then `npm start`

## License

MIT — permissive use and redistribution allowed with attribution (retain copyright notice).