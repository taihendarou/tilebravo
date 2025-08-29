// src/components/Toolbox.tsx
import { MousePointer, Pencil, Pipette, ZoomIn, ZoomOut } from "lucide-react";

type ToolId = "select" | "pencil" | "eyedropper";

interface Props {
  tool: ToolId;
  onSelectTool: (t: ToolId) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export default function Toolbox({ tool, onSelectTool, onZoomIn, onZoomOut }: Props) {
  const btn = (active: boolean) =>
    `w-10 h-10 border rounded flex items-center justify-center ${
      active ? "bg-gray-200" : "bg-white hover:bg-gray-100"
    }`;

  return (
    <aside className="border-r p-2 flex flex-col items-center gap-2">
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
        onClick={() => onSelectTool("eyedropper")}
        className={btn(tool === "eyedropper")}
        title="Eyedropper (I)"
        aria-label="Eyedropper"
      >
        <Pipette size={18} />
      </button>

      {/* Zoom In */}
      <button
        onClick={onZoomIn}
        className="w-10 h-10 border rounded flex items-center justify-center bg-white hover:bg-gray-100"
        title="Zoom in"
        aria-label="Zoom in"
      >
        <ZoomIn size={18} />
      </button>

      {/* Zoom Out */}
      <button
        onClick={onZoomOut}
        className="w-10 h-10 border rounded flex items-center justify-center bg-white hover:bg-gray-100"
        title="Zoom out"
        aria-label="Zoom out"
      >
        <ZoomOut size={18} />
      </button>
    </aside>
  );
}
