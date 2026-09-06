import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { fail, requirePerm } from "@/server/auth/guards";
import { qrSvg, qrContent, code39Svg } from "@/server/modules/qr";

export const dynamic = "force-dynamic";

/**
 * GET /api/labels/print?ids=a,b,c — HTML آماده چاپ (A4، شبکه برچسب)
 * qr=1 barcode=1 کنترل محتوا
 */
export async function GET(req: NextRequest) {
  try {
    await requirePerm(req, "asset:view");
    const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 60);
    const withQr = req.nextUrl.searchParams.get("qr") !== "0";
    const withBarcode = req.nextUrl.searchParams.get("barcode") !== "0";

    if (ids.length === 0) {
      return new Response("ids لازم است", { status: 400 });
    }

    const assets = await prisma.asset.findMany({
      where: { id: { in: ids }, isDeleted: false },
      include: { assetType: { include: { category: true } } },
    });
    const byId = new Map(assets.map((a) => [a.id, a]));

    const baseUrl = req.nextUrl.origin;
    const cards: string[] = [];
    for (const id of ids) {
      const a = byId.get(id);
      if (!a) continue;
      const qr = withQr ? await qrSvg(qrContent(baseUrl, a.code), 120) : "";
      let barcode = "";
      try {
        barcode = withBarcode ? code39Svg(a.code, 30) : "";
      } catch {
        barcode = "";
      }
      cards.push(`
        <div class="label">
          <div class="qr">${qr}</div>
          <div class="meta">
            <div class="name">${escapeHtml(a.name)}</div>
            <div class="code">${a.code}</div>
            <div class="type">${escapeHtml(a.assetType.category.name)} / ${escapeHtml(a.assetType.name)}</div>
            <div class="barcode">${barcode}</div>
          </div>
        </div>`);
    }

    const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>برچسب دارایی‌ها</title>
<style>
  body { font-family: Tahoma, sans-serif; margin: 0; padding: 12mm; background: #fff; color: #0d0d0d; }
  .grid { display: flex; flex-wrap: wrap; gap: 6mm; }
  .label {
    width: 64mm; height: 30mm;
    border: 1px solid #d4d4d8; border-radius: 2mm;
    display: flex; align-items: center; gap: 3mm; padding: 2mm;
    box-sizing: border-box; page-break-inside: avoid;
  }
  .qr svg { width: 24mm; height: 24mm; display: block; }
  .meta { flex: 1; min-width: 0; direction: rtl; }
  .name { font-size: 10pt; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .code { font-family: monospace; font-size: 11pt; direction: ltr; text-align: right; letter-spacing: 1px; margin-top: 1mm; }
  .type { font-size: 7.5pt; color: #6e6e80; margin-top: 0.5mm; }
  .barcode { margin-top: 1mm; }
  .barcode svg { width: 100%; height: 8mm; display: block; }
  @media print { body { padding: 8mm; } .label { border-color: #a1a1aa; } }
</style>
</head>
<body>
  <div class="grid">${cards.join("")}</div>
  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body>
</html>`;

    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    return fail(err);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
