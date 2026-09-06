import type { NextRequest } from "next/server";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { auditScanSchema, scanAsset } from "@/server/modules/audit-service";

export const dynamic = "force-dynamic";

/** POST /api/audits/{id}/scan — ثبت یک اسکن */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "audit:scan");
    const { id } = await params;
    const parsed = auditScanSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const result = await scanAsset({
      sessionId: id,
      actorId: user.id,
      code: parsed.data.code,
      note: parsed.data.note,
    });
    return ok(result, { status: result.result === "DUPLICATE" ? 200 : 201 });
  } catch (err) {
    return fail(err);
  }
}
