import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, requireAuth, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { categorySchema } from "@/server/modules/asset-validations";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** PATCH /api/categories/{id} */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "category:manage");
    const { id } = await params;
    const parsed = categorySchema.partial().safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const existing = await prisma.assetCategory.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "دسته یافت نشد");

    const data = parsed.data;
    if (data.code && data.code.toUpperCase() !== existing.code) {
      const dup = await prisma.assetCategory.findUnique({ where: { code: data.code.toUpperCase() } });
      if (dup) throw new ApiError(409, "DUPLICATE", "کد دسته تکراری است");
    }
    // چرخه در درخت ممنوع
    if (data.parentId) {
      if (data.parentId === id) throw new ApiError(400, "INVALID_PARENT", "دسته نمی‌تواند والد خودش باشد");
      let p = await prisma.assetCategory.findUnique({ where: { id: data.parentId } });
      while (p?.parentId) {
        if (p.parentId === id) throw new ApiError(400, "CYCLE", "درخت دسته‌ها دچار چرخه می‌شود");
        p = await prisma.assetCategory.findUnique({ where: { id: p.parentId } });
      }
    }

    const cat = await prisma.assetCategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
        ...(data.parentId !== undefined ? { parentId: data.parentId ?? null } : {}),
        ...(data.description !== undefined ? { description: data.description ?? null } : {}),
        ...(data.defaultWarrantyMonths !== undefined ? { defaultWarrantyMonths: data.defaultWarrantyMonths ?? null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    await writeAudit({
      actorId: user.id, action: "UPDATE", entity: "AssetCategory", entityId: id,
      oldValue: existing, newValue: cat, req,
    });
    return ok({ category: cat });
  } catch (err) {
    return fail(err);
  }
}

/** DELETE /api/categories/{id} — فقط وقتی نوع/فرزندی ندارد */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "category:manage");
    const { id } = await params;
    const existing = await prisma.assetCategory.findUnique({
      where: { id },
      include: { _count: { select: { types: true, children: true } } },
    });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "دسته یافت نشد");
    if (existing._count.types > 0)
      throw new ApiError(409, "IN_USE", "این دسته دارای نوع دارایی است و حذف نمی‌شود");
    if (existing._count.children > 0)
      throw new ApiError(409, "IN_USE", "این دسته دارای زیردسته است و حذف نمی‌شود");

    await prisma.assetCategory.delete({ where: { id } });
    await writeAudit({
      actorId: user.id, action: "DELETE", entity: "AssetCategory", entityId: id,
      oldValue: existing, req,
    });
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
