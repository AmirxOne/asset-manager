import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

/** GET /api/audit-logs?action=&entity=&actorId=&page= — لاگ عملیات */
export async function GET(req: NextRequest) {
  try {
    await requirePerm(req, "audit-log:view");
    const sp = req.nextUrl.searchParams;
    const action = sp.get("action") ?? undefined;
    const entity = sp.get("entity") ?? undefined;
    const actorId = sp.get("actorId") ?? undefined;
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(50, Math.max(10, Number(sp.get("pageSize") ?? 30)));

    const where = {
      ...(action ? { action } : {}),
      ...(entity ? { entity } : {}),
      ...(actorId ? { actorId } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // فهرست action/entityهای موجود برای فیلترها
    const [actions, entities] = await Promise.all([
      prisma.auditLog.groupBy({ by: ["action"], _count: { _all: true } }),
      prisma.auditLog.groupBy({ by: ["entity"], _count: { _all: true } }),
    ]);

    return ok({
      logs,
      total,
      page,
      pageCount: Math.ceil(total / pageSize),
      filters: {
        actions: actions.map((a) => ({ value: a.action, count: a._count._all })).sort((a, b) => b.count - a.count),
        entities: entities.map((e) => ({ value: e.entity ?? "?", count: e._count._all })).sort((a, b) => b.count - a.count),
      },
    });
  } catch (err) {
    return fail(err);
  }
}
