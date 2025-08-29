"use client";
type Props = {
  tileOffsetHex?: string | null;
  pixelOffsetHex?: string | null;
};

export default function StatusBar({ tileOffsetHex, pixelOffsetHex }: Props) {
  return (
    <footer className="h-8 border-t px-3 flex items-center gap-6 text-xs">
      <div>Tile offset: {tileOffsetHex ?? "—"}</div>
      <div>Pixel offset: {pixelOffsetHex ?? "—"}</div>
    </footer>
  );
}
