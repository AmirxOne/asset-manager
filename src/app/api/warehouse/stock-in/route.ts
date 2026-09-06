import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { canTransition, type AssetStatus } from "@/server/modules/asset-lifecycle";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  assetId: z.string().min(1),
  locationId: z.string().min(1).optional(), // محل انبار
  note: z.string().trim().max(300).optional(),
});

/** POST /api/warehouse/stock-in — ورود به انبار (AVAILABLE → IN_STOCK) */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "warehouse:manage");
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const { assetId, locationId, note } = parsed.data;

    const asset = await prisma.asset.findFirst({ where: { id: assetId, isDeleted: false } });
    if (!asset) throw new ApiError(404, "NOT_FOUND", "دارایی یافت نشد");

    const from = asset.status as AssetStatus;
    const to: AssetStatus = "IN_STOCK";
    if (!canTransition(from, to))
      throw new ApiError(409, "ASSET_INVALID_TRANSITION", `ورود به انبار از وضعیت «${from}» مجاز نیست`);

    const [updated] = await prisma.$transaction([
      prisma.asset.update({
        where: { id: assetId },
        data: { status: to, ...(locationId ? { locationId } : {}) },
      }),
      prisma.assetEvent.create({
        data: {
          assetId,
          type: "IN_STOCK",
          fromStatus: from,
          toStatus: to,
          ...(locationId ? { toLocationId: locationId } : {}),
          actorId: user.id,
          note: note ?? "ورود به انبار",
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
