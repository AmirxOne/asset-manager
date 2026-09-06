import type { NextRequest } from "next/server";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { returnAsset, returnSchema } from "@/server/modules/assignment-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** POST /api/assets/{id}/return — عودت دارایی */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "asset:return");
    const { id } = await params;
    const parsed = returnSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const result = await returnAsset({
      assetId: id,
      actorId: user.id,
      toStatus: parsed.data.toStatus,
      condition: parsed.data.condition,
      toLocationId: parsed.data.toLocationId,
      note: parsed.data.note,
    });
    await writeAudit({ actorId: user.id, action: "RETURN", entity: "Asset", entityId: id, req });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
