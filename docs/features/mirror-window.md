# Specification Document — Mirror Window (TileBravo)

Status: Not implemented

## 1. Overview
The **Mirror Window** is an optional secondary window in TileBravo that allows users to visually rearrange tiles to build sprites, without altering the actual order of the original tile bank.  
Any graphic edits made to tiles inside the Mirror Window are reflected in the original tiles, while the rearrangement itself is purely visual.

---

## 2. Operating Principles
1. **Optional window**: It only opens when the user clicks the corresponding button.  
   - If it is closed, no mirroring process runs in the background (saves processing).  
2. **Viewport sync**: The Mirror Window always matches the main viewport in size, width, height, and number of columns.  
   - Changing these properties in the main window automatically updates them in the Mirror Window.  
3. **Linked editing**: Any drawing, filling, or erasing action done in the Mirror Window is instantly reflected in the original tile.  
4. **Independent rearrangement**: Moving or reordering tiles inside the Mirror Window does not affect the original bank.

---

## 3. User Flow

### Opening
- The user clicks **“Open Mirror”** in the main interface.  
- The Mirror Window opens blank, without tiles.

### Adding Tiles
Tiles can be added to the Mirror Window in three ways:
1. **Drag and drop** from the main editor.  
2. **Copy and paste** from the main editor.  
3. **Button “Copy all tiles”** inside the Mirror Window: automatically clones all tiles from the original, in order.

### Manipulation
- Tiles inside the Mirror Window can be freely moved.  
- The same tile can appear in multiple positions.  
- Removing a tile in the Mirror Window only removes the reference, not the original.  
- Zoom and pan are supported, but the viewport always respects the main window’s configuration.

### Editing
- Tools such as pencil, line, eraser, fill, and paint bucket work normally in the Mirror Window.  
- Any edits update the original tile in real time.  
- All instances of that tile (main window and Mirror Window) update simultaneously.

---

## 4. Synchronization Rules
- Editing pixels in the Mirror Window → updates the original tile.  
- Moving tiles in the Mirror Window → does not affect the original bank.  
- Duplicating tiles in the Mirror Window → allowed; all instances stay linked to the same original tile.  
- Deleting a tile in the Mirror Window → removes only the reference.  

---

## 5. Interface
- **Button “Open Mirror”** in the main toolbar.  
- **Button “Copy all tiles”** inside the Mirror Window.  
- Controls: zoom, pan, drag, copy/paste, delete, flip, rotate.  
- The grid always matches the number of columns of the main editor.  

---

## 6. Export Options
- **Export layout (JSON)**: saves the arrangement of tiles in the Mirror Window.  
- **Export sprite (PNG)**: renders the assembled sprite exactly as arranged in the Mirror Window.  

---

## 7. Use Cases
- Assemble large sprites from multiple tiles.  
- Rearrange tiles for readability while keeping live editing.  
- Export visual arrangements for documentation or sharing.  

---

## 8. Acceptance Criteria
- [ ] Mirror Window opens only when requested.  
- [ ] When closed, no additional processing is running.  
- [ ] Always uses the dimensions and columns of the main window.  
- [ ] Edits in the Mirror Window are reflected in the original in real time.  
- [ ] Rearranging does not alter the original bank.  
- [ ] “Copy all tiles” populates the Mirror Window correctly.  
- [ ] Export options (JSON and PNG) function correctly.  

---

## 9. Future Extensions
- Export/Import layout
