import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requireAuth } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

/** GET /api/my-assets — دارایی‌های کاربر لاگین‌شده (از طریق employee لینک‌شده) */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { employeeId: true },
    });
    if (!dbUser?.employeeId) {
      return ok({ assets: [], hasEmployee: false });
    }

    const assets = await prisma.asset.findMany({
      where: {
        holderEmployeeId: dbUser.employeeId,
        isDeleted: false,
        status: { in: ["ASSIGNED", "IN_USE"] },
      },
      include: { assetType: { include: { category: { select: { name: true } } } } },
      orderBy: { code: "asc" },
    });

    return ok({ assets, hasEmployee: true });
  } catch (err) {
    return fail(err);
  }
}
