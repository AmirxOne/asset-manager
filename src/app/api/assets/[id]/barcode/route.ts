import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { fail, requirePerm, ApiError } from "@/server/auth/guards";
import { code39Svg } from "@/server/modules/qr";

export const dynamic = "force-dynamic";

/** GET /api/assets/{id}/barcode — SVG Code39 از کد دارایی */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePerm(req, "asset:view");
    const { id } = await params;
    const asset = await prisma.asset.findFirst({ where: { id, isDeleted: false } });
    if (!asset) throw new ApiError(404, "NOT_FOUND", "دارایی یافت نشد");

    const svg = code39Svg(asset.code, 44);
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
