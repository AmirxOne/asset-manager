import type { NextRequest } from "next/server";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { transferAsset, transferSchema } from "@/server/modules/assignment-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** POST /api/assets/{id}/transfer — انتقال دارایی بین کارمندان */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "asset:transfer");
    const { id } = await params;
    const parsed = transferSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const result = await transferAsset({
      assetId: id,
      toEmployeeId: parsed.data.toEmployeeId,
      actorId: user.id,
      note: parsed.data.note,
    });
    await writeAudit({ actorId: user.id, action: "TRANSFER", entity: "Asset", entityId: id, req });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
