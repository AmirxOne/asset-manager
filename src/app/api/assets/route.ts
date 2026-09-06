import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { ok, fail, requirePerm, requireAuth, ApiError, assertSameOrigin } from "@/server/auth/guards";
import { assetCreateSchema, assetListQuerySchema } from "@/server/modules/asset-validations";
import { generateAssetCode } from "@/server/modules/code-generator";
import { writeAudit } from "@/server/audit/log";

export const dynamic = "force-dynamic";

/** GET /api/assets — لیست با فیلترهای ترکیبی + pagination */
export async function GET(req: NextRequest) {
  try {
    await requirePerm(req, "asset:view");
    const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = assetListQuerySchema.safeParse(sp);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "پارامترها نامعتبرند", parsed.error.flatten().fieldErrors);
    }
    const q = parsed.data;

    const where: Prisma.AssetWhereInput = {
      isDeleted: false,
      ...(q.q
        ? {
            OR: [
              { code: { contains: q.q, mode: "insensitive" } },
              { name: { contains: q.q, mode: "insensitive" } },
              { brand: { contains: q.q, mode: "insensitive" } },
              { model: { contains: q.q, mode: "insensitive" } },
              { serialNumber: { contains: q.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.condition ? { condition: q.condition } : {}),
      ...(q.assetTypeId ? { assetTypeId: q.assetTypeId } : {}),
      ...(q.locationId ? { locationId: q.locationId } : {}),
      ...(q.departmentId ? { departmentId: q.departmentId } : {}),
      ...(q.supplierId ? { supplierId: q.supplierId } : {}),
      ...(q.brand ? { brand: { contains: q.brand, mode: "insensitive" } } : {}),
      ...(q.categoryId ? { assetType: { categoryId: q.categoryId } } : {}),
      ...(q.warrantyExpiringBefore ? { warrantyEnd: { lte: new Date(q.warrantyExpiringBefore) } } : {}),
    };

    const orderBy: Prisma.AssetOrderByWithRelationInput = {
      [q.sort]: q.order,
    };

    const [total, assets] = await prisma.$transaction([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        include: {
          assetType: { include: { category: { select: { name: true, code: true } } } },
        },
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);

    return ok({ data: assets, total, page: q.page, pageSize: q.pageSize });
  } catch (err) {
    return fail(err);
  }
}

/** POST /api/assets — ایجاد دارایی + کد خودکار + رویداد CREATED */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requirePerm(req, "asset:create");
    const parsed = assetCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "داده ورودی نامعتبر است", parsed.error.flatten().fieldErrors);
    }
    const data = parsed.data;

    // نوع دارایی باید معتبر و فعال باشد
    const type = await prisma.assetType.findUnique({
      where: { id: data.assetTypeId },
      include: { category: true },
    });
    if (!type || !type.isActive)
      throw new ApiError(404, "NOT_FOUND", "نوع دارایی یافت نشد یا غیرفعال است");

    // سریال یکتا
    if (data.serialNumber) {
      const dupSerial = await prisma.asset.findUnique({
        where: { serialNumber: data.serialNumber },
      });
      if (dupSerial) throw new ApiError(409, "DUPLICATE_SERIAL", "شماره سریال قبلاً ثبت شده است");
    }

    // کد: دستی یا خودکار
    let code: string;
    if (data.code) {
      const dup = await prisma.asset.findUnique({ where: { code: data.code.toUpperCase() } });
      if (dup) throw new ApiError(409, "DUPLICATE_CODE", "کد دارایی تکراری است");
      code = data.code.toUpperCase();
    } else {
      code = await generateAssetCode(type.category.code, type.code);
    }

    const status = data.status ?? "IN_STOCK";

    const asset = await prisma.asset.create({
      data: {
        code,
        name: data.name,
        assetTypeId: data.assetTypeId,
        brand: data.brand ?? null,
        model: data.model ?? null,
        serialNumber: data.serialNumber ?? null,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        purchasePrice: data.purchasePrice ? new Prisma.Decimal(data.purchasePrice) : null,
        currency: data.currency ?? "IRR",
        supplierId: data.supplierId ?? null,
        warrantyStart: data.warrantyStart ? new Date(data.warrantyStart) : null,
        warrantyEnd: data.warrantyEnd ? new Date(data.warrantyEnd) : null,
        locationId: data.locationId ?? null,
        departmentId: data.departmentId ?? null,
        condition: data.condition ?? "GOOD",
        status,
        lifecycleStage: status,
        notes: data.notes ?? null,
        createdById: user.id,
      },
      include: { assetType: { include: { category: true } } },
    });

    // رویداد CREATED — هیچ دارایی بدون تاریخچه متولد نمی‌شود
    await prisma.assetEvent.create({
      data: {
        assetId: asset.id,
        type: "CREATED",
        toStatus: status,
        actorId: user.id,
        note: data.code ? "ایجاد با کد دستی" : "ایجاد با کد خودکار",
      },
    });

    await writeAudit({
      actorId: user.id, action: "CREATE", entity: "Asset", entityId: asset.id,
      newValue: { code: asset.code, name: asset.name }, req,
    });

    return ok({ asset }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
