import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { departmentSchema } from "@/server/modules/assignment-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "department:manage");
    const { id } = await params;
    const parsed = departmentSchema.partial().safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "بخش یافت نشد");

    const d = parsed.data;
    if (d.name && d.name !== existing.name) {
      const dup = await prisma.department.findUnique({ where: { name: d.name } });
      if (dup) throw new ApiError(409, "DUPLICATE", "بخشی با این نام وجود دارد");
    }

    const dept = await prisma.department.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.code !== undefined ? { code: d.code ?? null } : {}),
        ...(d.description !== undefined ? { description: d.description ?? null } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      },
      include: { _count: { select: { employees: true } } },
    });
    await writeAudit({ actorId: user.id, action: "UPDATE", entity: "Department", entityId: id, req });
    return ok({ department: dept });
  } catch (err) {
    return fail(err);
  }
}

/** DELETE — فقط وقتی کارمندی ندارد (soft: غیرفعال کردن) */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "department:manage");
    const { id } = await params;
    const existing = await prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "بخش یافت نشد");
    if (existing._count.employees > 0) {
      // غیرفعال کردن به جای حذف
      await prisma.department.update({ where: { id }, data: { isActive: false } });
      await writeAudit({ actorId: user.id, action: "UPDATE", entity: "Department", entityId: id, req });
      return ok({ deactivated: true });
    }
    await prisma.department.delete({ where: { id } });
    await writeAudit({ actorId: user.id, action: "DELETE", entity: "Department", entityId: id, req });
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
