import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requireAuth } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

/** GET /api/notifications — لیست + شمارش نخوانده */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return ok({ notifications, unreadCount });
  } catch (err) {
    return fail(err);
  }
}

/** POST /api/notifications — علامت‌گذاری همه به‌عنوان خوانده */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return ok({ read: true });
  } catch (err) {
    return fail(err);
  }
}
