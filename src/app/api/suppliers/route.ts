import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, requireAuth, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { supplierSchema } from "@/server/modules/maintenance-service";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** GET /api/suppliers — لیست (هر کاربر لاگین‌شده برای Select فرم دارایی) */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const withPurchases = req.nextUrl.searchParams.get("withPurchases") === "1";
    if (withPurchases) {
      await requirePerm(req, "supplier:manage");
      const suppliers = await prisma.supplier.findMany({
        include: { _count: { select: { assets: true } } },
        orderBy: { name: "asc" },
      });
      return ok({ suppliers });
    }
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, contactName: true, phone: true },
      orderBy: { name: "asc" },
    });
    return ok({ suppliers });
  } catch (err) {
    return fail(err);
  }
}

/** POST /api/suppliers */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "supplier:manage");
    const parsed = supplierSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;
    const dup = await prisma.supplier.findUnique({ where: { name: d.name } });
    if (dup) throw new ApiError(409, "DUPLICATE", "تأمین‌کننده‌ای با این نام وجود دارد");

    const supplier = await prisma.supplier.create({
      data: {
        name: d.name,
        contactName: d.contactName ?? null,
        phone: d.phone ?? null,
        email: d.email ?? null,
        address: d.address ?? null,
        taxId: d.taxId ?? null,
        notes: d.notes ?? null,
      },
      include: { _count: { select: { assets: true } } },
    });
    await writeAudit({
      actorId: user.id, action: "CREATE", entity: "Supplier", entityId: supplier.id, newValue: supplier, req,
    });
    return ok({ supplier }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
