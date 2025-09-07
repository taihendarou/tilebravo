## v0.3.1-beta.1

### Export
- BIN keeps the exact input filename; PNG uses the base name with `.png`.  
- When a selection is active, a prompt asks whether to export only selected tiles.  
- Shortcut: Cmd/Ctrl+S exports to BIN.  

### Editor
- Delete/Backspace clears the current selection (fills with color 0).  
- Escape cancels active tools (line, pencil, selection) and clears previews.  
- Line tool preview is always straight; now cancels when the cursor leaves the viewport.  

### UI
- Removed the redundant color scheme dropdown.  
- Added **Rename** button: themed modal, preselects the filename (without extension), validates extensions, preserves the current one if omitted.  
- Fixes: selection outline no longer lingers after moving tiles; toolbar buttons no longer keep stray focus highlights when switching tools.  

### Codecs
- Default codec on first launch is now **4bpp planar**.  
- Added: **1bpp**, **2bpp linear**, **4bpp linear**, **4bpp linear (reverse-order)**, **8bpp linear**.  

### Palettes
- **8bpp**: added 256-color presets (Grayscale, Rainbow, Cool→Warm, Warm←Dark, RGB332, Vivid Random A/B/C, Checker Vivid, XOR Scramble).  
- **2bpp/4bpp**: added high-contrast presets (Vivid, Checker, XOR) to make shapes easier to spot when browsing tiles.  

## v0.3.0-beta.1 (public beta)

Features in this release:

- Multiple codecs (2bpp planar, 4bpp planar, 2bpp planar composite, 4bpp chunky zip16)
- Palette editing (create, duplicate, import/export) and color picking
- Tools: selection, pencil, eyedropper, line, bucket
- Linear tile stepping (view-only), zoom, tile/pixel grid overlays
- PNG import (images with width/height multiple of 8), BIN export, PNG export for previews
- "Empty tiles" visualization at the beginning and end of the view
- About modal with version, links (Website, GitHub, Public Version) and contact

Notes:

- This is a public beta; APIs and UI can change.
