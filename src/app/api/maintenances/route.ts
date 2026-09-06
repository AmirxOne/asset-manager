import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { maintenanceCreateSchema } from "@/server/modules/maintenance-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** GET /api/maintenances?status=&assetId= — لیست تعمیرات */
export async function GET(req: NextRequest) {
  try {
    await requirePerm(req, "maintenance:view");
    const status = req.nextUrl.searchParams.get("status");
    const assetId = req.nextUrl.searchParams.get("assetId");

    const records = await prisma.maintenanceRecord.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(assetId ? { assetId } : {}),
      },
      include: {
        asset: { select: { id: true, code: true, name: true } },
        technician: { select: { fullName: true } },
        _count: { select: { parts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok({ maintenances: records });
  } catch (err) {
    return fail(err);
  }
}

/** POST /api/maintenances — ثبت تعمیر جدید (دارایی → MAINTENANCE) */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "maintenance:manage");
    const parsed = maintenanceCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;

    const { openMaintenance } = await import("@/server/modules/maintenance-service");
    const record = await openMaintenance({
      assetId: d.assetId,
      problem: d.problem,
      description: d.description,
      technicianId: d.technicianId,
      technicianName: d.technicianName,
      notes: d.notes,
      actorId: user.id,
    });

    await writeAudit({
      actorId: user.id, action: "MAINTENANCE", entity: "MaintenanceRecord", entityId: record.id,
      newValue: { asset: record.asset.code, problem: d.problem }, req,
    });
    return ok({ maintenance: record }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
