import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

/** GET /api/admin/roles — نقش‌ها با مجوزها و شمار کاربر */
export async function GET(req: NextRequest) {
  try {
    await requirePerm(req, "role:manage");
    const roles = await prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: "asc" },
    });
    const allPerms = await prisma.permission.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] });
    return ok({ roles, permissions: allPerms });
  } catch (err) {
    return fail(err);
  }
}
