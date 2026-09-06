import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { canTransition, type AssetStatus } from "@/server/modules/asset-lifecycle";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  assetId: z.string().min(1),
  note: z.string().trim().max(300).optional(),
});

/** POST /api/warehouse/stock-out — خروج از انبار (IN_STOCK → AVAILABLE) */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "warehouse:manage");
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const { assetId, note } = parsed.data;

    const asset = await prisma.asset.findFirst({ where: { id: assetId, isDeleted: false } });
    if (!asset) throw new ApiError(404, "NOT_FOUND", "دارایی یافت نشد");

    const from = asset.status as AssetStatus;
    const to: AssetStatus = "AVAILABLE";
    if (!canTransition(from, to))
      throw new ApiError(409, "ASSET_INVALID_TRANSITION", `خروج از انبار از وضعیت «${from}» مجاز نیست`);

    const [updated] = await prisma.$transaction([
      prisma.asset.update({ where: { id: assetId }, data: { status: to } }),
      prisma.assetEvent.create({
        data: {
          assetId,
          type: "AVAILABLE",
          fromStatus: from,
          toStatus: to,
          actorId: user.id,
          note: note ?? "خروج از انبار",
        },
      }),
    ]);

    await writeAudit({
      actorId: user.id, action: "STATUS_CHANGE", entity: "Asset", entityId: assetId,
      oldValue: { status: from }, newValue: { status: to }, req,
    });
    return ok({ asset: updated });
  } catch (err) {
    return fail(err);
  }
}
