import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { fail, requirePerm, ApiError } from "@/server/auth/guards";
import { qrSvg, qrContent } from "@/server/modules/qr";

export const dynamic = "force-dynamic";

/** GET /api/assets/{id}/qr — SVG با URL کامل /a/{code} */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePerm(req, "asset:view");
    const { id } = await params;
    const asset = await prisma.asset.findFirst({ where: { id, isDeleted: false } });
    if (!asset) throw new ApiError(404, "NOT_FOUND", "دارایی یافت نشد");

    const baseUrl = req.nextUrl.origin;
    const content = qrContent(baseUrl, asset.code);
    const svg = await qrSvg(content, 240);

    // ثبت اولین تولید QR
    if (!asset.qrGeneratedAt) {
      await prisma.asset.update({ where: { id }, data: { qrGeneratedAt: new Date() } });
    }

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    return fail(err);
  }
}
