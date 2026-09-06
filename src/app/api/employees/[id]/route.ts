import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { employeeSchema } from "@/server/modules/assignment-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** GET /api/employees/{id} — با دارایی‌های فعال و تاریخچه */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePerm(req, "employee:manage");
    const { id } = await params;
    const emp = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: { select: { name: true } },
        manager: { select: { fullName: true } },
        assignments: {
          orderBy: { assignedAt: "desc" },
          take: 50,
          include: { asset: { select: { id: true, code: true, name: true, status: true } } },
        },
      },
    });
    if (!emp) throw new ApiError(404, "NOT_FOUND", "کارمند یافت نشد");
    return ok({ employee: emp });
  } catch (err) {
    return fail(err);
  }
}

/** PATCH /api/employees/{id} */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "employee:manage");
    const { id } = await params;
    const parsed = employeeSchema.partial().safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "کارمند یافت نشد");

    const d = parsed.data;
    if (d.personnelCode && d.personnelCode !== existing.personnelCode) {
      const dup = await prisma.employee.findUnique({ where: { personnelCode: d.personnelCode } });
      if (dup) throw new ApiError(409, "DUPLICATE", "کد پرسنلی تکراری است");
    }

    const emp = await prisma.employee.update({
      where: { id },
      data: {
        ...(d.fullName !== undefined ? { fullName: d.fullName } : {}),
        ...(d.personnelCode !== undefined ? { personnelCode: d.personnelCode } : {}),
        ...(d.departmentId !== undefined ? { departmentId: d.departmentId ?? null } : {}),
        ...(d.position !== undefined ? { position: d.position ?? null } : {}),
        ...(d.managerId !== undefined ? { managerId: d.managerId ?? null } : {}),
        ...(d.email !== undefined ? { email: d.email ?? null } : {}),
        ...(d.phone !== undefined ? { phone: d.phone ?? null } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(d.notes !== undefined ? { notes: d.notes ?? null } : {}),
      },
    });
    await writeAudit({
      actorId: user.id, action: "UPDATE", entity: "Employee", entityId: id, req,
    });
    return ok({ employee: emp });
  } catch (err) {
    return fail(err);
  }
}
