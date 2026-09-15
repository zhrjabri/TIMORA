import { qrMatrix, qrPath } from "@/lib/qr";

/** QR code rendered as React SVG elements from a module matrix — no injected markup. */
export function QrCode({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const matrix = qrMatrix(value);
  const quiet = 2;
  const total = matrix.size + quiet * 2;
  return (
    <svg viewBox={`0 0 ${total} ${total}`} role="img" aria-label={label} className={className} shapeRendering="crispEdges">
      <rect width={total} height={total} fill="#FFFFFF" />
      <path d={qrPath(matrix, quiet)} fill="#111111" />
    </svg>
  );
}
