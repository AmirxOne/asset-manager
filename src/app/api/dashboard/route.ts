import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

/** GET /api/dashboard — آمار کلی + رویدادهای اخیر + درخواست‌های باز */
export async function GET(req: NextRequest) {
  try {
    await requirePerm(req, "dashboard:view");
    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 86400000);

    const [
      total, byStatusRaw, conditionBroken, totalValueRaw, warrantyExpiring,
      recentEvents, recentAssignments, openRequests, maintenanceOpen,
    ] = await Promise.all([
      prisma.asset.count({ where: { isDeleted: false } }),
      prisma.asset.groupBy({
        by: ["status"],
        where: { isDeleted: false },
        _count: { _all: true },
      }),
      prisma.asset.count({ where: { isDeleted: false, condition: "BROKEN" } }),
      prisma.asset.aggregate({
        where: { isDeleted: false },
        _sum: { purchasePrice: true },
      }),
      prisma.asset.count({
        where: { isDeleted: false, warrantyEnd: { gte: now, lte: in90 } },
      }),
      prisma.assetEvent.findMany({
        take: 12,
        orderBy: { occurredAt: "desc" },
        include: {
          asset: { select: { id: true, code: true, name: true } },
          actor: { select: { fullName: true } },
        },
      }),
      prisma.assignment.findMany({
        take: 6,
        where: { returnedAt: null },
        orderBy: { assignedAt: "desc" },
        include: {
          asset: { select: { id: true, code: true, name: true } },
          employee: { select: { fullName: true } },
        },
      }),
      prisma.assetRequest.findMany({
        take: 6,
        where: { status: { in: ["PENDING", "MANAGER_APPROVED", "IT_APPROVED"] } },
        orderBy: { createdAt: "desc" },
        include: {
          requester: { select: { fullName: true } },
        },
      }),
      prisma.maintenanceRecord.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    ]);

    const status: Record<string, number> = {};
    for (const s of byStatusRaw) status[s.status] = s._count._all;

    return ok({
      stats: {
        total,
        status,
        broken: conditionBroken,
        totalValue: totalValueRaw._sum.purchasePrice?.toString() ?? "0",
        warrantyExpiring,
        openRequests: openRequests.length,
        maintenanceOpen,
      },
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        type: e.type,
        note: e.note,
        createdAt: e.occurredAt,
        asset: e.asset,
        actor: e.actor?.fullName ?? "سیستم",
      })),
      recentAssignments: recentAssignments.map((a) => ({
        id: a.id,
        assignedAt: a.assignedAt,
        asset: a.asset,
        employee: a.employee,
      })),
      openRequests: openRequests.map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title,
        status: r.status,
        createdAt: r.createdAt,
        requester: r.requester.fullName,
      })),
    });
  } catch (err) {
    return fail(err);
  }
}
