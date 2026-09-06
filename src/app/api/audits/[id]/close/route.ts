import type { NextRequest } from "next/server";
import { ok, fail, requirePerm, assertSameOrigin } from "@/server/auth/guards";
import { closeAudit } from "@/server/modules/audit-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** POST /api/audits/{id}/close — بستن ممیزی + گزارش نهایی */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "audit:manage");
    const { id } = await params;
    const result = await closeAudit({ sessionId: id, actorId: user.id });
    await writeAudit({
      actorId: user.id, action: "AUDIT", entity: "AuditSession", entityId: id,
      newValue: result, req,
    });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
