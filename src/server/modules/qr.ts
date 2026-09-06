import QRCode from "qrcode";

/**
 * QR — محتوا همیشه URL مطلق /a/{code} است (ADR-007):
 * اسکن با هر دوربینی → مرورگر → ریدایرکت به صفحه دارایی.
 */

export async function qrSvg(content: string, size = 240): Promise<string> {
  return QRCode.toString(content, {
    type: "svg",
    margin: 1,
    width: size,
    errorCorrectionLevel: "M",
    color: { dark: "#0d0d0d", light: "#ffffff" },
  });
}

export async function qrPngBuffer(content: string, size = 240): Promise<Buffer> {
  return QRCode.toBuffer(content, {
    type: "png",
    margin: 1,
    width: size,
    errorCorrectionLevel: "M",
    color: { dark: "#0d0d0d", light: "#ffffff" },
  });
}

export function qrContent(baseUrl: string, assetCode: string): string {
  return `${baseUrl.replace(/\/$/, "")}/a/${encodeURIComponent(assetCode)}`;
}

// =====================================================================
// Code39 barcode — encoder خالص و قابل‌راستی‌آزمایی
// دارایی‌کدها فقط A-Z 0-9 '-' دارند که همگی در Code39 پشتیبانی می‌شوند.
// =====================================================================

/** ۹ عنصر (میله/فاصله متناوب، شروع با میله) — w=پهن n=باریک */
const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn",
  "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw",
  "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw",
  E: "wnnnwwnnn", F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn",
  I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww",
  O: "wnnnwnnwn", P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn",
  S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw",
  Y: "wwnnwnnnn", Z: "nwwnwnnnn",
  "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn",
  $: "nwnwnwnnn", "/": "nwnwnnnwn", "+": "nwnnnwnwn", "%": "nnnwnwnwn",
  "*": "nwnnwnwnn", // start/stop
};

const NARROW = 2;
const WIDE = 5;
const CHAR_GAP = NARROW; // فاصله بین نویسه‌ها

export function code39Chars(text: string): boolean {
  return text.split("").every((c) => CODE39[c] !== undefined);
}

/** SVG Code39 — viewBox مبتنی، مقیاس‌پذیر در چاپ */
export function code39Svg(text: string, height = 48): string {
  const normalized = text.toUpperCase();
  if (!code39Chars(normalized)) {
    throw new Error(`نویسه ناسازگار با Code39: ${text}`);
  }

  const chars = ["*", ...normalized.split(""), "*"];
  const bars: { x: number; w: number }[] = [];
  let x = 0;

  for (let ci = 0; ci < chars.length; ci++) {
    const pattern = CODE39[chars[ci]];
    for (let i = 0; i < 9; i++) {
      const w = pattern[i] === "w" ? WIDE : NARROW;
      const isBar = i % 2 === 0;
      if (isBar) bars.push({ x, w });
      x += w;
    }
    if (ci < chars.length - 1) x += CHAR_GAP;
  }

  const totalW = x;
  const svgBars = bars
    .map((b) => `<rect x="${b.x}" y="0" width="${b.w}" height="${height}" fill="#0d0d0d"/>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${height + 14}" width="${totalW}" height="${height + 14}">${svgBars}<text x="${totalW / 2}" y="${height + 11}" text-anchor="middle" font-family="monospace" font-size="11" fill="#0d0d0d" letter-spacing="2">${normalized}</text></svg>`;
}
