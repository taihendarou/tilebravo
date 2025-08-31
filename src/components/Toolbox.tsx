// src/components/Toolbox.tsx
import { MousePointer, Pencil, Pipette, ZoomIn, ZoomOut, Slash, PaintBucket } from "lucide-react";

type ToolId = "select" | "pencil" | "eyedropper" | "line" | "bucket";

interface Props {
  tool: ToolId;
  onSelectTool: (t: ToolId) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  palette: string[];
  currentColor: number;
}

export default function Toolbox({
  tool,
  onSelectTool,
  onZoomIn,
  onZoomOut,
  palette,
  currentColor,
}: Props) {
  const btn = (active: boolean) =>
    `w-10 h-10 border border-border rounded flex items-center justify-center ${active ? "bg-muted" : "bg-surface hover:bg-muted"}`;

  const currentHex = palette[currentColor] ?? "#000000";
  const textOn = (() => {
    // Compute relative luminance to pick black/white text
    const m = /^#?([0-9a-fA-F]{6})$/.exec(currentHex);
    const hex = m ? m[1] : "000000";
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b; // 0..255
    return luminance > 140 ? "#000000" : "#FFFFFF";
  })();

  return (
    <aside className="border-r border-border p-2 flex flex-col items-center gap-2 bg-background text-foreground">
      <button
        onClick={() => onSelectTool("select")}
        className={btn(tool === "select")}
        title="Selector (V)"
        aria-label="Selector"
      >
        <MousePointer size={18} />
      </button>

      <button
        onClick={() => onSelectTool("pencil")}
        className={btn(tool === "pencil")}
        title="Pencil (B)"
        aria-label="Pencil"
      >
        <Pencil size={18} />
      </button>

      <button
        onClick={() => onSelectTool("line")}
        className={btn(tool === "line")}
        title="Line (L)"
        aria-label="Line"
      >
        <Slash size={18} />
      </button>

      <button
        onClick={() => onSelectTool("bucket")}
        className={btn(tool === "bucket")}
        title="Paint Bucket (G)"
        aria-label="Paint Bucket"
      >
        <PaintBucket size={18} />
      </button>

      <button
        onClick={onZoomIn}
        className="w-10 h-10 border border-border rounded flex items-center justify-center bg-surface hover:bg-muted"
        title="Zoom in (+ / =)"
        aria-label="Zoom in"
      >
        <ZoomIn size={18} />
      </button>

      <button
        onClick={onZoomOut}
        className="w-10 h-10 border border-border rounded flex items-center justify-center bg-surface hover:bg-muted"
        title="Zoom out (-)"
        aria-label="Zoom out"
      >
        <ZoomOut size={18} />
      </button>

      <button
        onClick={() => onSelectTool("eyedropper")}
        className={btn(tool === "eyedropper")}
        title="Eyedropper (I)"
        aria-label="Eyedropper"
      >
        <Pipette size={18} />
      </button>

      {/* Current color preview with index */}
      <div
        className="w-10 h-10 border border-border rounded flex items-center justify-center"
        title={`Current color: ${currentHex}`}
        style={{ backgroundColor: currentHex, color: textOn }}
        aria-label="Current color preview"
      >
        <span className="text-[10px] leading-none font-medium select-none">{currentColor}</span>
      </div>
    </aside>
  );
}
