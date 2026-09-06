import type { NextRequest } from "next/server";
import { ok, fail, requirePerm, requireAuth, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { requestDecisionSchema, requestFulfillSchema, decideRequest, fulfillRequest, cancelRequest } from "@/server/modules/request-service";
import { prisma } from "@/server/db";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** POST /api/requests/{id}/approve — تأیید/رد (level از permission کاربر) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // مسیرهای خاص
    if (action === "CANCEL") {
      const user = await requireAuth(req);
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { employeeId: true },
      });
      if (!dbUser?.employeeId)
        throw new ApiError(403, "FORBIDDEN", "پرونده پرسنلی متصل نیست");
      const result = await cancelRequest({ requestId: id, requesterEmployeeId: dbUser.employeeId });
      return ok(result);
    }

    if (action === "FULFILL") {
      const user = await requirePerm(req, "request:fulfill");
      const parsed = requestFulfillSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
      }
      const result = await fulfillRequest({
        requestId: id,
        actorId: user.id,
        assetIds: parsed.data.assetIds,
      });
      await writeAudit({
        actorId: user.id, action: "UPDATE", entity: "AssetRequest", entityId: id,
        newValue: result, req,
      });
      return ok(result);
    }

    // تصمیم: MANAGER یا IT — بر اساس permission
    const parsed = requestDecisionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }

    // کدام level؟ اول manager اگر permission دارد و stage مناسب است؛ بعد IT
    const reqRow = await prisma.assetRequest.findUnique({ where: { id }, select: { status: true } });
    if (!reqRow) throw new ApiError(404, "NOT_FOUND", "درخواست یافت نشد");

    let level: "MANAGER" | "IT";
    if (reqRow.status === "PENDING") {
      await requirePerm(req, "request:approve:manager");
      level = "MANAGER";
    } else if (reqRow.status === "MANAGER_APPROVED") {
      await requirePerm(req, "request:approve:it");
      level = "IT";
    } else {
      throw new ApiError(409, "REQUEST_CLOSED", "این درخواست در مرحله تصمیم‌گیری نیست");
    }

    const user = await requireAuth(req);
    const result = await decideRequest({
      requestId: id,
      actorId: user.id,
      level,
      decision: parsed.data.decision,
      note: parsed.data.note,
    });
    await writeAudit({
      actorId: user.id, action: "UPDATE", entity: "AssetRequest", entityId: id,
      newValue: { level, decision: parsed.data.decision }, req,
    });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
