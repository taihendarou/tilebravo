# TileBravo

Version: v1.0.0 [Changelog](./CHANGELOG.md)

TileBravo is a tile editor created for ROM hacking and translation of classic tile‑based games as an alternative/complement to editors like Tile Molester and YY‑CHR.

## Public Version

- Live: https://tilebravo.hextinkers.org/
- GitHub: https://github.com/taihendarou/tilebravo
- Discord Server: https://discord.gg/5x7KZEqGfC

## Usage (quick tour)

- Open a ROM/asset file, pick a codec/stride and start exploring tiles.
- Use selection/pencil/line/bucket to edit; copy/paste regions.
- Manage palettes (new, duplicate, import/export).

## Keyboard Shortcuts

- `B` – Pencil tool
- `V` – Selection tool
- `I` – Eyedropper tool
- `L` – Line tool
- `G` – Bucket (flood fill)
- `0`–`9` – Pick palette color by index (first 10 entries)
- `Delete` / `Backspace` – Clear the current selection (fills with color 0)
- `Esc` – Cancel the active tool preview (line/pencil/selection) or clear the selection
- `Cmd/Ctrl + C` – Copy the current selection
- `Cmd/Ctrl + V` – Paste the copied tiles at the current selection origin
- `Cmd/Ctrl + S` – Export to BIN
- `Cmd/Ctrl + G` – Open the “Go to offset” prompt
- `+` / `=` – Zoom in
- `-` / `_` – Zoom out

## Credits

- Author: Taihen — https://hextinkers.org
- Stack: Next.js, React, Tailwind, lucide-react

## How to build (to run on your own)

1. Install: `npm install`
2. Dev: `npm run dev`
3. Build: `npm run build` then `npm start`

## License

MIT — permissive use and redistribution allowed with attribution (retain copyright notice).
