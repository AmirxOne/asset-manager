import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

/** GET /api/warehouse/summary — شمارش‌ها + ارزش کل (فاز ۴) */
export async function GET(req: NextRequest) {
  try {
    await requirePerm(req, "asset:view");

    const [statusCounts, conditionCounts, totalValue, perLocation] = await Promise.all([
      prisma.asset.groupBy({
        by: ["status"],
        where: { isDeleted: false },
        _count: { _all: true },
      }),
      prisma.asset.groupBy({
        by: ["condition"],
        where: { isDeleted: false },
        _count: { _all: true },
      }),
      prisma.asset.aggregate({
        where: { isDeleted: false, status: { notIn: ["RETIRED", "DISPOSED"] } },
        _sum: { purchasePrice: true },
      }),
      prisma.asset.groupBy({
        by: ["locationId"],
        where: { isDeleted: false },
        _count: { _all: true },
      }),
    ]);

    const status: Record<string, number> = {};
    let total = 0;
    for (const row of statusCounts) {
      status[row.status] = row._count._all;
      total += row._count._all;
    }
    const condition: Record<string, number> = {};
    for (const row of conditionCounts) condition[row.condition] = row._count._all;

    // موجودی هر محل (فقط محل‌هایی که دارایی دارند)
    const locationIds = perLocation.map((l) => l.locationId).filter((x): x is string => Boolean(x));
    const locations = await prisma.location.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true, type: true },
    });
    const locById = new Map(locations.map((l) => [l.id, l]));

    const byLocation = perLocation
      .filter((l) => l.locationId && locById.has(l.locationId))
      .map((l) => ({
        location: locById.get(l.locationId!)!,
        count: l._count._all,
      }));

    return ok({
      summary: {
        total,
        status,
        condition,
        totalValue: totalValue._sum.purchasePrice?.toString() ?? "0",
        byLocation,
      },
    });
  } catch (err) {
    return fail(err);
  }
}
