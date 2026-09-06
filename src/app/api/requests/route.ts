import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requireAuth, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { requestCreateSchema, createRequest } from "@/server/modules/request-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/requests — درخواست‌های خودم (همه) یا همه (request:viewAll)
 * ?scope=mine|all&status=
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const scope = req.nextUrl.searchParams.get("scope") ?? "mine";
    const status = req.nextUrl.searchParams.get("status");

    const viewAll =
      (user.isSuperAdmin || user.permissions.includes("request:viewAll")) && scope === "all";

    let requesterEmployeeId: string | null = null;
    if (!viewAll) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { employeeId: true },
      });
      requesterEmployeeId = dbUser?.employeeId ?? null;
      if (!requesterEmployeeId)
        return ok({ requests: [], hasEmployee: false });
    }

    const requests = await prisma.assetRequest.findMany({
      where: {
        ...(viewAll ? {} : { requesterId: requesterEmployeeId! }),
        ...(status ? { status } : {}),
      },
      include: {
        requester: { select: { fullName: true, personnelCode: true } },
        department: { select: { name: true } },
        assetType: { select: { name: true, code: true } },
        approvals: {
          include: { approver: { select: { fullName: true } } },
          orderBy: { decidedAt: "asc" },
        },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok({ requests, viewAll });
  } catch (err) {
    return fail(err);
  }
}

/** POST /api/requests — ثبت درخواست (request:create) */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    await requirePerm(req, "request:create");
    const parsed = requestCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;

    // درخواست‌دهنده = پرونده لینک‌شده به کاربر
    const actor = await requireAuth(req);
    const dbUser = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { employeeId: true },
    });
    if (!dbUser?.employeeId)
      throw new ApiError(409, "NO_EMPLOYEE", "حساب شما به پرونده پرسنلی متصل نیست");

    const created = await createRequest({
      requesterEmployeeId: dbUser.employeeId,
      actorUserId: actor.id,
      title: d.title,
      assetTypeId: d.assetTypeId,
      quantity: d.quantity,
      reason: d.reason,
      urgency: d.urgency,
    });
    return ok({ request: created }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
