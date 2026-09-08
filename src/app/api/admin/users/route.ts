import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { writeAudit } from "@/server/audit/log";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

/** GET /api/admin/users — لیست کاربران با نقش‌ها */
export async function GET(req: NextRequest) {
  try {
    await requirePerm(req, "user:manage");
    const users = await prisma.user.findMany({
      select: {
        id: true, fullName: true, email: true, phone: true, isActive: true, isSuperAdmin: true,
        createdAt: true, updatedAt: true,
        roles: { include: { role: { select: { id: true, key: true, name: true } } } },
        employee: { select: { id: true, fullName: true, personnelCode: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok({ users });
  } catch (err) {
    return fail(err);
  }
}

const userCreateSchema = z.object({
  fullName: z.string().trim().min(3, "نام حداقل ۳ نویسه است").max(80),
  email: z.string().email("ایمیل نامعتبر است"),
  phone: z.string().trim().max(20).nullable().optional(),
  password: z.string().min(8, "رمز حداقل ۸ نویسه است").max(72),
  roleKeys: z.array(z.string().min(1)).min(1, "حداقل یک نقش لازم است").max(5),
  employeeId: z.string().min(1).nullable().optional(),
});

/** POST /api/admin/users — کاربر جدید */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const actor = await requirePerm(req, "user:manage");
    const parsed = userCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;

    const dup = await prisma.user.findUnique({ where: { email: d.email } });
    if (dup) throw new ApiError(409, "DUPLICATE", "کاربری با این ایمیل وجود دارد");

    const roles = await prisma.role.findMany({ where: { key: { in: d.roleKeys } } });
    if (roles.length === 0) throw new ApiError(400, "VALIDATION", "نقش نامعتبر");

    const user = await prisma.user.create({
      data: {
        fullName: d.fullName,
        email: d.email,
        phone: d.phone ?? null,
        passwordHash: await bcrypt.hash(d.password, 12),
        ...(d.employeeId ? { employee: { connect: { id: d.employeeId } } } : {}),
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
      },
      select: { id: true, fullName: true, email: true },
    });
    await writeAudit({ actorId: actor.id, action: "CREATE", entity: "User", entityId: user.id, newValue: { email: d.email, roles: d.roleKeys }, req });
    return ok({ user }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
