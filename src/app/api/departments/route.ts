import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, requireAuth, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { departmentSchema } from "@/server/modules/assignment-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: "asc" },
    });
    return ok({ departments });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "department:manage");
    const parsed = departmentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;
    if (d.name) {
      const dup = await prisma.department.findUnique({ where: { name: d.name } });
      if (dup) throw new ApiError(409, "DUPLICATE", "بخشی با این نام وجود دارد");
    }
    const dept = await prisma.department.create({
      data: { name: d.name, code: d.code ?? null, description: d.description ?? null },
      include: { _count: { select: { employees: true } } },
    });
    await writeAudit({ actorId: user.id, action: "CREATE", entity: "Department", entityId: dept.id, newValue: dept, req });
    return ok({ department: dept }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
