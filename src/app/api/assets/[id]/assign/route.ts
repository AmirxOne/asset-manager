import type { NextRequest } from "next/server";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { assignAsset, assignSchema } from "@/server/modules/assignment-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** POST /api/assets/{id}/assign — تحویل دارایی */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "asset:assign");
    const { id } = await params;
    const parsed = assignSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const assignment = await assignAsset({
      assetId: id,
      employeeId: parsed.data.employeeId,
      actorId: user.id,
      note: parsed.data.note,
      dueAt: parsed.data.dueAt,
    });
    await writeAudit({
      actorId: user.id, action: "ASSIGN", entity: "Asset", entityId: id,
      newValue: { to: assignment.employee.fullName }, req,
    });
    return ok({ assignment }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
