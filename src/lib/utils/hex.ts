export function toHex(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  return "0x" + n.toString(16).toUpperCase().padStart(6, "0");
}
