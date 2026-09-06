import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { canTransition, ASSET_STATUSES, ASSET_CONDITIONS, type AssetStatus } from "@/server/modules/asset-lifecycle";
import { assignAsset } from "@/server/modules/assignment-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

const bulkSchema = z.object({
  action: z.enum(["STATUS", "ASSIGN", "UPDATE"]),
  ids: z.array(z.string().min(1)).min(1, "حداقل یک دارایی انتخاب کنید").max(200),
  // STATUS
  to: z.enum(ASSET_STATUSES).optional(),
  // ASSIGN
  employeeId: z.string().min(1).optional(),
  // UPDATE
  patch: z
    .object({
      condition: z.enum(ASSET_CONDITIONS).optional(),
      locationId: z.string().min(1).nullable().optional(),
      departmentId: z.string().min(1).nullable().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
    })
    .optional(),
  note: z.string().trim().max(300).optional(),
});

/** POST /api/assets/bulk — عملیات گروهی با گزارش per-item (اتمیک per item) */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "asset:bulk");
    const parsed = bulkSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const { action, ids, note } = parsed.data;

    if (action === "STATUS" && !parsed.data.to)
      throw new ApiError(400, "VALIDATION", "وضعیت مقصد لازم است");
    if (action === "ASSIGN" && !parsed.data.employeeId)
      throw new ApiError(400, "VALIDATION", "کارمند مقصد لازم است");

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const id of ids) {
      try {
        if (action === "STATUS") {
          const asset = await prisma.asset.findFirst({ where: { id, isDeleted: false } });
          if (!asset) throw new ApiError(404, "NOT_FOUND", "دارایی یافت نشد");
          const from = asset.status as AssetStatus;
          const to = parsed.data.to as AssetStatus;
          if (!canTransition(from, to))
            throw new ApiError(409, "ASSET_INVALID_TRANSITION", `گذار ${from}→${to} مجاز نیست`);
          await prisma.$transaction([
            prisma.asset.update({
              where: { id },
              data: {
                status: to,
                ...(to === "RETIRED" ? { retiredAt: new Date() } : {}),
                ...(to === "LOST" || to === "RETIRED" || to === "DISPOSED" ? { holderEmployeeId: null } : {}),
              },
            }),
            prisma.assetEvent.create({
              data: { assetId: id, type: "STATUS_CHANGE", fromStatus: from, toStatus: to, actorId: user.id, note },
            }),
          ]);
        } else if (action === "ASSIGN") {
          await assignAsset({
            assetId: id,
            employeeId: parsed.data.employeeId!,
            actorId: user.id,
            note,
          });
        } else if (action === "UPDATE") {
          const patch = parsed.data.patch ?? {};
          if (Object.keys(patch).length === 0)
            throw new ApiError(400, "VALIDATION", "فیلدی برای ویرایش داده نشده");
          await prisma.asset.update({
            where: { id },
            data: {
              ...(patch.condition !== undefined ? { condition: patch.condition } : {}),
              ...(patch.locationId !== undefined ? { locationId: patch.locationId ?? null } : {}),
              ...(patch.departmentId !== undefined ? { departmentId: patch.departmentId ?? null } : {}),
              ...(patch.notes !== undefined ? { notes: patch.notes ?? null } : {}),
            },
          });
          await prisma.assetEvent.create({
            data: { assetId: id, type: "UPDATED", actorId: user.id, metadata: patch, note: "ویرایش گروهی" },
          });
        }
        results.push({ id, ok: true });
      } catch (err) {
        results.push({
          id,
          ok: false,
          error: err instanceof ApiError ? err.message : "خطای نامشخص",
        });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    await writeAudit({
      actorId: user.id, action: "BULK", entity: "Asset", entityId: "bulk",
      newValue: { action, total: ids.length, succeeded }, req,
    });

    return ok({ results, succeeded, failed: ids.length - succeeded });
  } catch (err) {
    return fail(err);
  }
}
