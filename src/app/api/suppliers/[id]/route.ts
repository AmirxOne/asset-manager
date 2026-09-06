import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { supplierSchema } from "@/server/modules/maintenance-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** GET /api/suppliers/{id} — با تاریخچه خرید */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePerm(req, "supplier:manage");
    const { id } = await params;
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        assets: {
          select: {
            id: true, code: true, name: true,
            purchaseDate: true, purchasePrice: true, currency: true,
            assetType: { select: { name: true } },
          },
          orderBy: { purchaseDate: "desc" },
        },
        _count: { select: { assets: true } },
      },
    });
    if (!supplier) throw new ApiError(404, "NOT_FOUND", "تأمین‌کننده یافت نشد");
    return ok({ supplier });
  } catch (err) {
    return fail(err);
  }
}

/** PATCH /api/suppliers/{id} */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "supplier:manage");
    const { id } = await params;
    const parsed = supplierSchema.partial().safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "تأمین‌کننده یافت نشد");

    const d = parsed.data;
    if (d.name && d.name !== existing.name) {
      const dup = await prisma.supplier.findUnique({ where: { name: d.name } });
      if (dup) throw new ApiError(409, "DUPLICATE", "تأمین‌کننده‌ای با این نام وجود دارد");
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.contactName !== undefined ? { contactName: d.contactName ?? null } : {}),
        ...(d.phone !== undefined ? { phone: d.phone ?? null } : {}),
        ...(d.email !== undefined ? { email: d.email ?? null } : {}),
        ...(d.address !== undefined ? { address: d.address ?? null } : {}),
        ...(d.taxId !== undefined ? { taxId: d.taxId ?? null } : {}),
        ...(d.notes !== undefined ? { notes: d.notes ?? null } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      },
      include: { _count: { select: { assets: true } } },
    });
    await writeAudit({ actorId: user.id, action: "UPDATE", entity: "Supplier", entityId: id, req });
    return ok({ supplier });
  } catch (err) {
    return fail(err);
  }
}
