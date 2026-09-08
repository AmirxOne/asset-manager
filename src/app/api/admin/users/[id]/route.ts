import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { writeAudit } from "@/server/audit/log";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

const userPatchSchema = z.object({
  fullName: z.string().trim().min(3).max(80).optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(72).nullable().optional(),
  roleKeys: z.array(z.string().min(1)).min(1).max(5).optional(),
  employeeId: z.string().min(1).nullable().optional(),
});

/** PATCH /api/admin/users/{id} */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const actor = await requirePerm(req, "user:manage");
    const { id } = await params;
    const parsed = userPatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new ApiError(404, "NOT_FOUND", "کاربر یافت نشد");
    if (target.isSuperAdmin && d.isActive === false)
      throw new ApiError(409, "FORBIDDEN_SELF", "ابرمدیر قابل غیرفعال‌سازی نیست");
    // غیرفعال‌سازی خودش؟
    if (id === actor.id && d.isActive === false)
      throw new ApiError(409, "FORBIDDEN_SELF", "نمی‌توانید خودتان را غیرفعال کنید");

    if (d.roleKeys) {
      const roles = await prisma.role.findMany({ where: { key: { in: d.roleKeys } } });
      if (roles.length !== d.roleKeys.length) throw new ApiError(400, "VALIDATION", "نقش نامعتبر");
      await prisma.userRole.deleteMany({ where: { userId: id } });
      await prisma.userRole.createMany({ data: roles.map((r) => ({ userId: id, roleId: r.id })) });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(d.fullName !== undefined ? { fullName: d.fullName } : {}),
        ...(d.phone !== undefined ? { phone: d.phone ?? null } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 12) } : {}),
        ...(d.employeeId !== undefined ? { employeeId: d.employeeId ?? null } : {}),
      },
      select: { id: true, fullName: true, email: true, isActive: true },
    });
    // اگر غیرفعال شد، نشست‌هایش را ببند
    if (d.isActive === false) {
      await prisma.session.deleteMany({ where: { userId: id } });
    }
    await writeAudit({ actorId: actor.id, action: "UPDATE", entity: "User", entityId: id, newValue: { ...d, password: d.password ? "***" : undefined }, req });
    return ok({ user });
  } catch (err) {
    return fail(err);
  }
}
