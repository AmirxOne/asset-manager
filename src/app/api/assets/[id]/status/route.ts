import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { canTransition, eventOfTransition, ASSET_STATUSES, type AssetStatus } from "@/server/modules/asset-lifecycle";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  to: z.enum(ASSET_STATUSES),
  note: z.string().trim().max(500).optional(),
});

/** POST /api/assets/{id}/status — گذار وضعیت با اعمال ماتریس + رویداد */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "asset:update");
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }

    const asset = await prisma.asset.findFirst({ where: { id, isDeleted: false } });
    if (!asset) throw new ApiError(404, "NOT_FOUND", "دارایی یافت نشد");

    const from = asset.status as AssetStatus;
    const to = parsed.data.to;

    if (!canTransition(from, to)) {
      throw new ApiError(
        409,
        "ASSET_INVALID_TRANSITION",
        `گذار وضعیت از «${from}» به «${to}» مجاز نیست`,
      );
    }

    const eventType = eventOfTransition(from, to);

    const [updated] = await prisma.$transaction([
      prisma.asset.update({
        where: { id },
        data: {
          status: to,
          lifecycleStage: eventType,
          ...(to === "RETIRED" ? { retiredAt: new Date() } : {}),
          ...(to === "DISPOSED" ? { disposedAt: new Date() } : {}),
          // تحویل‌گیرنده هنگام خروج از چرخه تخصیص پاک شود
          ...(to === "LOST" || to === "RETIRED" || to === "DISPOSED" ? { holderEmployeeId: null } : {}),
        },
      }),
      prisma.assetEvent.create({
        data: {
          assetId: id,
          type: eventType,
          fromStatus: from,
          toStatus: to,
          actorId: user.id,
          note: parsed.data.note,
        },
      }),
    ]);

    await writeAudit({
      actorId: user.id, action: "STATUS_CHANGE", entity: "Asset", entityId: id,
      oldValue: { status: from }, newValue: { status: to }, req,
    });

    return ok({ asset: updated });
  } catch (err) {
    return fail(err);
  }
}
