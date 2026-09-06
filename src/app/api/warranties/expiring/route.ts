import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

/** GET /api/warranties/expiring?withinDays=90 — گارانتی‌های در حال انقضا */
export async function GET(req: NextRequest) {
  try {
    await requirePerm(req, "asset:view");
    const withinDays = Math.min(Math.max(Number(req.nextUrl.searchParams.get("withinDays") ?? 90), 1), 365);
    const now = new Date();
    const until = new Date(now.getTime() + withinDays * 86400000);

    const assets = await prisma.asset.findMany({
      where: {
        isDeleted: false,
        warrantyEnd: { gte: now, lte: until },
      },
      select: {
        id: true, code: true, name: true,
        warrantyEnd: true, warrantyStart: true,
        supplier: { select: { name: true } },
        assetType: { select: { name: true } },
      },
      orderBy: { warrantyEnd: "asc" },
    });

    // منقضی‌شده‌ها هم جدا
    const expired = await prisma.asset.findMany({
      where: { isDeleted: false, warrantyEnd: { lt: now } },
      select: { id: true, code: true, name: true, warrantyEnd: true },
      orderBy: { warrantyEnd: "desc" },
      take: 50,
    });

    return ok({ expiring: assets, expired, withinDays });
  } catch (err) {
    return fail(err);
  }
}
