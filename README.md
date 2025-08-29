# TileBravo

**Version 0.9**

TileBravo is a modern **8x8 tile editor** created for ROM hackers.  
It is a powerful alternative to the classic **Tile Molester**, offering support for multiple codecs, dynamic palettes, advanced editing tools, and direct export to BIN files.

## Public Access

- Public version: [https://tilebravo.vercel.app/](https://tilebravo.vercel.app/)  
- Last deploy: always available at the same link.

## Features

- Plug-in **codecs** (2bpp, 4bpp, and more in development).  
- **Dynamic palette editor** with direct color picking.  
- Editing tools: **selection, pencil, eyedropper**.  
- **Copy & paste** support for tiles.  
- Adjustable **zoom** and **tile/pixel grid overlays**.  
- **BIN export** and planned PNG export.  
- “Dirty state” indicator to track unsaved changes.  

## Roadmap

This is the planned roadmap for future versions of TileBravo.

### 1. Export and Import
- PNG export of selected or full tileset  
- PNG import (convert image to tiles using active codec and palette)  
- Palette import from custom files or formats  
- Standard palette sets for each codec (easily switchable)  

### 2. Codecs
- Add more well-known codecs (NES composite, linear formats, etc.)  
- Optimize the codec system to make it simpler to create and register new codecs  

### 3. Editing Features
- Copy/paste between different tabs  
- Undo/redo system (Ctrl+Z / Ctrl+Shift+Z)  
- Line drawing tool (Draw Line)  

### 4. Visualization and Navigation
- “Go to” function (jump to a specific tile offset)  
- Hex view mode (inspect tile data directly in hexadecimal)  
- Visual/UI improvements (themes, configs, credits screen)  

### 5. Polish and Extras
- Theming support (light/dark/custom)  
- Configurations for grid, default palettes, and shortcuts  
- Credits screen for contributors and acknowledgments  

## Developer

Developed by **Taihen**.  
Learn more at [https://hextinkers.org](https://hextinkers.org)

## License

MIT License.