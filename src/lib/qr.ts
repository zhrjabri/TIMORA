import QRCode from "qrcode";

export type QrMatrix = { size: number; modules: boolean[] };

/** Absolute scan URL. The token is random and only resolves for the owner after sign-in. */
export function qrUrl(siteUrl: string, token: string): string {
  return `${siteUrl}/q/${token}`;
}

/** Module matrix for rendering the QR code as React SVG elements (no raw HTML injection). */
export function qrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const modules: boolean[] = [];
  for (let i = 0; i < size * size; i += 1) modules.push(Boolean(qr.modules.data[i]));
  return { size, modules };
}

/** One compact SVG path covering all dark modules, merged per row run. */
export function qrPath({ size, modules }: QrMatrix, offset = 0): string {
  let d = "";
  for (let y = 0; y < size; y += 1) {
    let x = 0;
    while (x < size) {
      if (!modules[y * size + x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < size && modules[y * size + x]) x += 1;
      d += `M${start + offset} ${y + offset}h${x - start}v1h${start - x}z`;
    }
  }
  return d;
}

/** Standalone SVG file content. Contains only generated geometry — no user-supplied text. */
export function qrSvg(text: string, { quietZone = 4, dark = "#111111", light = "#FFFFFF" } = {}): string {
  const matrix = qrMatrix(text);
  const total = matrix.size + quietZone * 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="${light}"/>` +
    `<path d="${qrPath(matrix, quietZone)}" fill="${dark}"/></svg>\n`
  );
}

export async function qrPng(text: string, width = 1024): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 4,
    width,
    color: { dark: "#111111ff", light: "#ffffffff" },
  });
}
