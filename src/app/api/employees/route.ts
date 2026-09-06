import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, requireAuth, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { employeeSchema } from "@/server/modules/assignment-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** GET /api/employees — لیست کامل (employee:manage) یا سبک با ?options=1 (asset:assign) */
export async function GET(req: NextRequest) {
  try {
    const isOptions = req.nextUrl.searchParams.get("options") === "1";
    const user = await requirePerm(req, isOptions ? "asset:assign" : "employee:manage");

    if (isOptions) {
      const employees = await prisma.employee.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          fullName: true,
          personnelCode: true,
          department: { select: { name: true } },
        },
        orderBy: { fullName: "asc" },
        take: 200,
      });
      return ok({ employees });
    }
    void user;
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const departmentId = req.nextUrl.searchParams.get("departmentId");
    const employees = await prisma.employee.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { personnelCode: { contains: q, mode: "insensitive" } },
                { position: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(departmentId ? { departmentId } : {}),
      },
      include: {
        department: { select: { name: true } },
        _count: { select: { heldAssets: { where: { status: { in: ["ASSIGNED", "IN_USE"] } } } } },
      },
      orderBy: { fullName: "asc" },
      take: 100,
    });
    return ok({ employees });
  } catch (err) {
    return fail(err);
  }
}

/** POST /api/employees */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "employee:manage");
    const parsed = employeeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;

    const dup = await prisma.employee.findUnique({ where: { personnelCode: d.personnelCode } });
    if (dup) throw new ApiError(409, "DUPLICATE", "کد پرسنلی تکراری است");

    const emp = await prisma.employee.create({
      data: {
        fullName: d.fullName,
        personnelCode: d.personnelCode,
        departmentId: d.departmentId ?? null,
        position: d.position ?? null,
        managerId: d.managerId ?? null,
        email: d.email ?? null,
        phone: d.phone ?? null,
        hireDate: d.hireDate ? new Date(d.hireDate) : null,
        notes: d.notes ?? null,
      },
      include: { department: { select: { name: true } } },
    });
    await writeAudit({
      actorId: user.id, action: "CREATE", entity: "Employee", entityId: emp.id,
      newValue: { personnelCode: emp.personnelCode, fullName: emp.fullName }, req,
    });
    return ok({ employee: emp }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
