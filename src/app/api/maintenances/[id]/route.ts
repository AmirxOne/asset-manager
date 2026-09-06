import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { maintenanceUpdateSchema } from "@/server/modules/maintenance-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** GET /api/maintenances/{id} */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePerm(req, "maintenance:view");
    const { id } = await params;
    const record = await prisma.maintenanceRecord.findUnique({
      where: { id },
      include: {
        asset: { select: { id: true, code: true, name: true } },
        technician: { select: { fullName: true, personnelCode: true } },
        parts: true,
        createdBy: { select: { fullName: true } },
      },
    });
    if (!record) throw new ApiError(404, "NOT_FOUND", "تعمیر یافت نشد");
    return ok({ maintenance: record });
  } catch (err) {
    return fail(err);
  }
}

/** PATCH /api/maintenances/{id} — ویرایش + افزودن قطعات + شروع کار */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "maintenance:manage");
    const { id } = await params;
    const parsed = maintenanceUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const existing = await prisma.maintenanceRecord.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "تعمیر یافت نشد");
    if (existing.status === "DONE" || existing.status === "CANCELLED")
      throw new ApiError(409, "MAINTENANCE_CLOSED", "تعمیر بسته‌شده قابل ویرایش نیست");

    const d = parsed.data;

    // لغو = بستن رکورد + بازگرداندن دارایی از تعمیر (اگر مجاز)
    if (d.status === "CANCELLED") {
      const { cancelMaintenance } = await import("@/server/modules/maintenance-service");
      const result = await cancelMaintenance({ maintenanceId: id, actorId: user.id });
      await writeAudit({ actorId: user.id, action: "MAINTENANCE", entity: "MaintenanceRecord", entityId: id, newValue: result, req });
      const closed = await prisma.maintenanceRecord.findUnique({
        where: { id },
        include: { parts: true, asset: { select: { code: true } } },
      });
      return ok({ maintenance: closed });
    }

    await prisma.$transaction([
      prisma.maintenanceRecord.update({
        where: { id },
        data: {
          ...(d.status !== undefined ? { status: d.status } : {}),
          ...(d.problem !== undefined ? { problem: d.problem } : {}),
          ...(d.description !== undefined ? { description: d.description ?? null } : {}),
          ...(d.technicianId !== undefined ? { technicianId: d.technicianId ?? null } : {}),
          ...(d.technicianName !== undefined ? { technicianName: d.technicianName ?? null } : {}),
          ...(d.notes !== undefined ? { notes: d.notes ?? null } : {}),
        },
      }),
      ...(d.parts
        ? [
            prisma.maintenancePart.deleteMany({ where: { maintenanceId: id } }),
            prisma.maintenancePart.createMany({
              data: d.parts.map((p) => ({
                maintenanceId: id,
                name: p.name,
                quantity: p.quantity,
                unitCost: p.unitCost ?? null,
              })),
            }),
          ]
        : []),
    ]);

    await writeAudit({ actorId: user.id, action: "UPDATE", entity: "MaintenanceRecord", entityId: id, req });
    const record = await prisma.maintenanceRecord.findUnique({
      where: { id },
      include: { parts: true, asset: { select: { code: true } } },
    });
    return ok({ maintenance: record });
  } catch (err) {
    return fail(err);
  }
}
