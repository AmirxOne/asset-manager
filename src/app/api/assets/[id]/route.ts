import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, requireAuth, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { assetUpdateSchema } from "@/server/modules/asset-validations";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

async function getAssetOr404(id: string) {
  const asset = await prisma.asset.findFirst({
    where: { id, isDeleted: false },
    include: { assetType: { include: { category: true } } },
  });
  if (!asset) throw new ApiError(404, "NOT_FOUND", "دارایی یافت نشد");
  return asset;
}

/** GET /api/assets/{id} — با رویدادها */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePerm(req, "asset:view");
    const { id } = await params;
    const asset = await prisma.asset.findFirst({
      where: { id, isDeleted: false },
      include: {
        assetType: { include: { category: true } },
        events: {
          orderBy: { occurredAt: "desc" },
          take: 100,
          include: { actor: { select: { fullName: true } } },
        },
        createdBy: { select: { fullName: true } },
      },
    });
    if (!asset) throw new ApiError(404, "NOT_FOUND", "دارایی یافت نشد");
    return ok({ asset });
  } catch (err) {
    return fail(err);
  }
}

/** PATCH /api/assets/{id} — ویرایش فیلدهای غیرحساس (بدون status — آن از طریق transition است) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "asset:update");
    const { id } = await params;
    const existing = await getAssetOr404(id);

    const parsed = assetUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const data = parsed.data;

    if (data.serialNumber && data.serialNumber !== existing.serialNumber) {
      const dup = await prisma.asset.findUnique({ where: { serialNumber: data.serialNumber } });
      if (dup) throw new ApiError(409, "DUPLICATE_SERIAL", "شماره سریال قبلاً ثبت شده است");
    }
    if (data.assetTypeId && data.assetTypeId !== existing.assetTypeId) {
      const t = await prisma.assetType.findUnique({ where: { id: data.assetTypeId } });
      if (!t) throw new ApiError(404, "NOT_FOUND", "نوع دارایی یافت نشد");
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.assetTypeId !== undefined ? { assetTypeId: data.assetTypeId } : {}),
        ...(data.brand !== undefined ? { brand: data.brand ?? null } : {}),
        ...(data.model !== undefined ? { model: data.model ?? null } : {}),
        ...(data.serialNumber !== undefined ? { serialNumber: data.serialNumber ?? null } : {}),
        ...(data.purchaseDate !== undefined ? { purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null } : {}),
        ...(data.purchasePrice !== undefined ? { purchasePrice: data.purchasePrice ? new Prisma.Decimal(data.purchasePrice) : null } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.supplierId !== undefined ? { supplierId: data.supplierId ?? null } : {}),
        ...(data.warrantyStart !== undefined ? { warrantyStart: data.warrantyStart ? new Date(data.warrantyStart) : null } : {}),
        ...(data.warrantyEnd !== undefined ? { warrantyEnd: data.warrantyEnd ? new Date(data.warrantyEnd) : null } : {}),
        ...(data.locationId !== undefined ? { locationId: data.locationId ?? null } : {}),
        ...(data.departmentId !== undefined ? { departmentId: data.departmentId ?? null } : {}),
        ...(data.condition !== undefined ? { condition: data.condition } : {}),
        ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
      },
      include: { assetType: { include: { category: true } } },
    });

    // diff برای AuditLog
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [k, v] of Object.entries(data)) {
      const before = (existing as unknown as Record<string, unknown>)[k];
      if (JSON.stringify(before) !== JSON.stringify(v)) {
        changes[k] = { from: before, to: v };
      }
    }

    await writeAudit({
      actorId: user.id, action: "UPDATE", entity: "Asset", entityId: id,
      oldValue: { code: existing.code, changes }, newValue: { code: asset.code }, req,
    });

    if (Object.keys(changes).length > 0) {
      await prisma.assetEvent.create({
        data: {
          assetId: id,
          type: "UPDATED",
          actorId: user.id,
          metadata: changes as object,
          note: `ویرایش: ${Object.keys(changes).join("، ")}`,
        },
      });
    }

    return ok({ asset });
  } catch (err) {
    return fail(err);
  }
}

/** DELETE /api/assets/{id} — همیشه soft (retire)؛ حذف فیزیکی ممنوع */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "asset:retire");
    const { id } = await params;
    const existing = await getAssetOr404(id);

    if (existing.status === "RETIRED" || existing.status === "DISPOSED") {
      throw new ApiError(409, "ALREADY_RETIRED", "دارایی از قبل بازنشسته/اسقاط شده است");
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        status: "RETIRED",
        lifecycleStage: "RETIRED",
        retiredAt: new Date(),
      },
    });

    await prisma.assetEvent.create({
      data: {
        assetId: id,
        type: "RETIRED",
        fromStatus: existing.status,
        toStatus: "RETIRED",
        actorId: user.id,
        note: "بازنشسته‌سازی (حذف نرم)",
      },
    });

    await writeAudit({
      actorId: user.id, action: "STATUS_CHANGE", entity: "Asset", entityId: id,
      oldValue: { status: existing.status }, newValue: { status: "RETIRED" }, req,
    });

    void asset;
    return ok({ retired: true });
  } catch (err) {
    return fail(err);
  }
}
