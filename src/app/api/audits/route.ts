import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { auditCreateSchema, createAudit } from "@/server/modules/audit-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** GET /api/audits — لیست نشست‌ها */
export async function GET(req: NextRequest) {
  try {
    await requirePerm(req, "audit:view");
    const sessions = await prisma.auditSession.findMany({
      include: {
        createdBy: { select: { fullName: true } },
        _count: { select: { scans: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return ok({ audits: sessions });
  } catch (err) {
    return fail(err);
  }
}

/** POST /api/audits — شروع ممیزی جدید (snapshot) */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "audit:manage");
    const parsed = auditCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;
    const session = await createAudit({
      actorId: user.id,
      title: d.title,
      scope: d.scope,
      scopeId: d.scopeId,
    });
    await writeAudit({
      actorId: user.id, action: "AUDIT", entity: "AuditSession", entityId: session.id,
      newValue: { code: session.code, expected: session.expectedTotal }, req,
    });
    return ok({ audit: session }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
