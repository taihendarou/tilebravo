"use client";
type Props = {
  tileOffsetHex?: string | null;
  pixelOffsetHex?: string | null;
  selectionSize?: string | null;
};

export default function StatusBar({ tileOffsetHex, pixelOffsetHex, selectionSize }: Props) {
  return (
    <footer className="h-8 border-t px-3 flex items-center gap-6 text-xs">
      <div className="min-w-[140px]">Tile offset: {tileOffsetHex ?? "—"}</div>
      <div className="min-w-[140px]">Pixel offset: {pixelOffsetHex ?? "—"}</div>
      {selectionSize && <div>Selection: {selectionSize} tiles</div>}
    </footer>
  );
}
