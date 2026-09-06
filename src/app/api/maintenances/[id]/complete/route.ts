import type { NextRequest } from "next/server";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { maintenanceCompleteSchema } from "@/server/modules/maintenance-service";
import { completeMaintenance } from "@/server/modules/maintenance-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** POST /api/maintenances/{id}/complete — تکمیل تعمیر + برگشت دارایی */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "maintenance:manage");
    const { id } = await params;
    const parsed = maintenanceCompleteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;

    const result = await completeMaintenance({
      maintenanceId: id,
      cost: d.cost,
      notes: d.notes,
      returnTo: d.returnTo,
      condition: d.condition,
      actorId: user.id,
    });

    await writeAudit({
      actorId: user.id, action: "MAINTENANCE", entity: "MaintenanceRecord", entityId: id,
      newValue: { done: true, totalCost: result.totalCost }, req,
    });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
